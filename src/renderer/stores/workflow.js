import { defineStore } from 'pinia';
import { ref, computed, watch, onScopeDispose } from 'vue';
import { useRepositoriesStore } from './repositories.js';
import { useUndoRedo } from '../composables/useUndoRedo.js';

let errorUnsub = null;

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export const useWorkflowStore = defineStore('workflow', () => {
  const status = ref(null);
  const log = ref([]);
  const diffContent = ref('');
  const diffStaged = ref(true);
  const aiBusy = ref(false);
  const busy = ref(false);
  const lastError = ref(null);
  const pendingSuggestion = ref(null);
  const lastResult = ref(null);
  const branch = ref(null);
  const branches = ref([]);
  const statusLoading = ref(false);
  const logLoading = ref(false);

  const undo = useUndoRedo({ title: '', body: '' });
  const commitTitle = undo.title;
  const commitBody = undo.body;
  const canUndo = undo.canUndo;
  const canRedo = undo.canRedo;

  const reposStoreRef = () => useRepositoriesStore();
  const activeRepo = computed(() => reposStoreRef().activeRepo);
  const activeRepoId = computed(() => reposStoreRef().activeRepoId);

  const hasStaged = computed(() => {
    if (!status.value) return false;
    return (status.value.staged?.length || 0) + (status.value.created?.length || 0) > 0;
  });

  const hasChanges = computed(() => {
    if (!status.value) return false;
    const s = status.value;
    return (
      (s.staged?.length || 0) +
        (s.modified?.length || 0) +
        (s.created?.length || 0) +
        (s.deleted?.length || 0) +
        (s.untracked?.length || 0) >
      0
    );
  });

  function attachErrorListener() {
    if (errorUnsub || !window.api?.onGitError) return;
    errorUnsub = window.api.onGitError((payload) => {
      pendingSuggestion.value = payload;
      lastError.value = {
        title: payload.title,
        hint: payload.hint,
        code: payload.code,
        stderr: payload.stderr,
        timestamp: Date.now()
      };
    });
  }

  function detachErrorListener() {
    if (errorUnsub) {
      errorUnsub();
      errorUnsub = null;
    }
  }

  attachErrorListener();

  async function refreshStatus() {
    if (!activeRepo.value) {
      status.value = null;
      return;
    }
    statusLoading.value = true;
    try {
      const [s, br] = await Promise.all([
        window.api.git.status(activeRepo.value.localPath),
        window.api.git.currentBranch(activeRepo.value.localPath)
      ]);
      if (s.success) status.value = s.data;
      if (br.success) branch.value = br.data?.branch || null;
    } finally {
      statusLoading.value = false;
    }
  }

  async function refreshLog() {
    if (!activeRepo.value) {
      log.value = [];
      return;
    }
    logLoading.value = true;
    try {
      const l = await window.api.git.log(activeRepo.value.localPath, 50);
      if (l.success) log.value = l.data?.commits || [];
    } finally {
      logLoading.value = false;
    }
  }

  async function refreshDiff() {
    if (!activeRepo.value) {
      diffContent.value = '';
      return;
    }
    const d = await window.api.git.diff(activeRepo.value.localPath, diffStaged.value);
    if (d.success) diffContent.value = d.data?.content || '';
  }

  async function refreshAll() {
    if (!activeRepo.value) {
      status.value = null;
      log.value = [];
      diffContent.value = '';
      branch.value = null;
      return;
    }
    busy.value = true;
    try {
      await Promise.all([refreshStatus(), refreshLog(), refreshDiff()]);
    } finally {
      busy.value = false;
    }
  }

  const debouncedRefreshDiff = debounce(() => refreshDiff(), 120);

  async function setDiffMode(staged) {
    diffStaged.value = staged;
    await refreshDiff();
  }

  async function stage(files) {
    if (!activeRepo.value) return;
    busy.value = true;
    try {
      await window.api.git.stage(activeRepo.value.localPath, files);
      await Promise.all([refreshStatus(), refreshDiff()]);
    } finally {
      busy.value = false;
    }
  }

  async function unstage(files) {
    if (!activeRepo.value) return;
    busy.value = true;
    try {
      await window.api.git.unstage(activeRepo.value.localPath, files);
      await Promise.all([refreshStatus(), refreshDiff()]);
    } finally {
      busy.value = false;
    }
  }

  async function stageAll() {
    if (!status.value) return;
    const all = [
      ...(status.value.modified || []),
      ...(status.value.deleted || []),
      ...(status.value.untracked || [])
    ];
    await stage(all);
  }

  async function unstageAll() {
    await unstage([]);
  }

  async function generateAICommit() {
    if (!activeRepo.value || !activeRepo.value.accountId) {
      throw new Error('Selecciona un repositorio con cuenta asignada.');
    }
    aiBusy.value = true;
    try {
      const res = await window.api.ai.generateCommit(
        activeRepo.value.localPath,
        activeRepo.value.accountId
      );
      if (!res.success) {
        throw new Error(res.error?.message || 'La IA no pudo generar el mensaje');
      }
      undo.set({ title: res.data.title, body: res.data.body });
      lastResult.value = { kind: 'ai-commit', at: Date.now() };
    } finally {
      aiBusy.value = false;
    }
  }

  async function commit() {
    if (!activeRepo.value) throw new Error('No hay repositorio activo');
    if (!commitTitle.value.trim()) throw new Error('El título no puede estar vacío');
    const message = commitBody.value
      ? `${commitTitle.value}\n\n${commitBody.value}`
      : commitTitle.value;
    busy.value = true;
    try {
      const res = await window.api.git.commit(
        activeRepo.value.localPath,
        message,
        activeRepo.value.accountId
      );
      if (!res.success) {
        if (res.error?.suggestion) {
          pendingSuggestion.value = res.error.suggestion;
        }
        throw new Error(res.error?.message || 'Commit falló');
      }
      undo.reset();
      lastResult.value = { kind: 'commit', at: Date.now() };
      await Promise.all([refreshStatus(), refreshLog(), refreshDiff()]);
    } finally {
      busy.value = false;
    }
  }

  async function push() {
    if (!activeRepo.value) throw new Error('No hay repositorio activo');
    busy.value = true;
    try {
      const res = await window.api.git.push(
        activeRepo.value.localPath,
        activeRepo.value.accountId
      );
      if (!res.success) {
        if (res.error?.suggestion) {
          pendingSuggestion.value = res.error.suggestion;
        }
        throw new Error(res.error?.message || 'Push falló');
      }
      lastResult.value = { kind: 'push', at: Date.now() };
      await refreshStatus();
    } finally {
      busy.value = false;
    }
  }

  async function pullRebase() {
    if (!activeRepo.value) throw new Error('No hay repositorio activo');
    busy.value = true;
    try {
      const res = await window.api.git.pullRebase(
        activeRepo.value.localPath,
        activeRepo.value.accountId
      );
      if (!res.success) {
        if (res.error?.suggestion) {
          pendingSuggestion.value = res.error.suggestion;
        }
        throw new Error(res.error?.message || 'Pull --rebase falló');
      }
      lastResult.value = { kind: 'pull-rebase', at: Date.now() };
      await refreshAll();
    } finally {
      busy.value = false;
    }
  }

  function dismissSuggestion() {
    pendingSuggestion.value = null;
  }

  watch(activeRepoId, async (id) => {
    if (id) {
      await refreshAll();
    } else {
      status.value = null;
      log.value = [];
      diffContent.value = '';
      branch.value = null;
    }
  });

  onScopeDispose(() => {
    detachErrorListener();
  });

  return {
    status,
    log,
    diffContent,
    diffStaged,
    commitTitle,
    commitBody,
    canUndo,
    canRedo,
    undo: undo.undo,
    redo: undo.redo,
    aiBusy,
    busy,
    statusLoading,
    logLoading,
    lastError,
    lastResult,
    pendingSuggestion,
    branch,
    branches,
    activeRepo,
    activeRepoId,
    hasStaged,
    hasChanges,
    refreshAll,
    refreshStatus,
    refreshLog,
    refreshDiff,
    debouncedRefreshDiff,
    setDiffMode,
    stage,
    unstage,
    stageAll,
    unstageAll,
    generateAICommit,
    commit,
    push,
    pullRebase,
    dismissSuggestion
  };
});
