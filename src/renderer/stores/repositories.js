import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useAccountsStore } from './accounts.js';
import { useWorkflowStore } from './workflow.js';

function handleError(err, fallback) {
  const msg = err?.message || fallback;
  const e = new Error(msg);
  if (err?.field) e.field = err.field;
  return e;
}

export const useRepositoriesStore = defineStore('repositories', () => {
  const repositories = ref([]);
  const activeRepoId = ref(null);
  const loading = ref(false);

  const activeRepo = computed(() =>
    repositories.value.find((r) => r.id === activeRepoId.value) || null
  );

  const activeAccount = computed(() => {
    if (!activeRepo.value || !activeRepo.value.accountId) return null;
    const accountsStore = useAccountsStore();
    return accountsStore.byId.get(activeRepo.value.accountId) || null;
  });

  async function load() {
    loading.value = true;
    try {
      const res = await window.api.repositories.list();
      if (res.success) {
        repositories.value = res.data || [];
        if (!activeRepoId.value && repositories.value.length > 0) {
          activeRepoId.value = repositories.value[0].id;
        }
      }
    } finally {
      loading.value = false;
    }
  }

  function setActive(id) {
    if (activeRepoId.value === id) return;
    activeRepoId.value = id;
    const workflow = useWorkflowStore();
    workflow.refreshAll();
  }

  async function add({ name, localPath, accountId }) {
    const res = await window.api.repositories.add({ name, localPath, accountId });
    if (!res.success) {
      throw handleError(res.error, 'No se pudo añadir el repositorio');
    }
    await load();
    setActive(res.data.id);
    return res.data;
  }

  async function setAccount(repoId, accountId) {
    const res = await window.api.repositories.setAccount(repoId, accountId);
    if (!res.success) {
      throw handleError(res.error, 'No se pudo reasignar la cuenta');
    }
    await load();
    const workflow = useWorkflowStore();
    if (activeRepoId.value === repoId) {
      await workflow.refreshStatus();
    }
    return res.data;
  }

  async function remove(id) {
    const res = await window.api.repositories.remove(id);
    if (!res.success) {
      throw handleError(res.error, 'No se pudo eliminar el repositorio');
    }
    if (activeRepoId.value === id) {
      activeRepoId.value = null;
    }
    await load();
    return res.data;
  }

  return {
    repositories,
    activeRepoId,
    activeRepo,
    activeAccount,
    loading,
    load,
    setActive,
    add,
    setAccount,
    remove
  };
});
