<script setup>
import { ref, watch, onMounted, onBeforeUnmount, computed, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { useWorkflowStore } from '../stores/workflow.js';
import { useRepositoriesStore } from '../stores/repositories.js';

const { t } = useI18n();
const workflow = useWorkflowStore();
const repositories = useRepositoriesStore();

const diffContainer = ref(null);
let diffEditor = null;
let originalModel = null;
let modifiedModel = null;
let monaco = null;
let pendingContent = null;
let updateTimer = null;
let initPromise = null;

const EXT_LANG_MAP = {
  js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'javascript',
  ts: 'typescript', tsx: 'typescript', mts: 'typescript', cts: 'typescript',
  json: 'json', jsonc: 'json',
  vue: 'html', svelte: 'html',
  css: 'css', scss: 'scss', sass: 'scss', less: 'less',
  html: 'html', htm: 'html', xml: 'xml', svg: 'xml',
  md: 'markdown', mdx: 'markdown', markdown: 'markdown',
  py: 'python', pyi: 'python', pyx: 'python',
  rb: 'ruby', rake: 'ruby',
  go: 'go', golang: 'go',
  rs: 'rust',
  java: 'java', kt: 'kotlin', kts: 'kotlin',
  sh: 'shell', bash: 'shell', zsh: 'shell',
  yml: 'yaml', yaml: 'yaml',
  toml: 'ini', ini: 'ini', cfg: 'ini',
  sql: 'sql',
  php: 'php',
  swift: 'swift',
  c: 'c', h: 'c',
  cpp: 'cpp', cxx: 'cpp', cc: 'cpp', hpp: 'cpp',
  cs: 'csharp',
  dockerfile: 'dockerfile',
  makefile: 'makefile',
  graphql: 'graphql', gql: 'graphql',
  txt: 'plaintext', log: 'plaintext'
};

const NAME_LANG_MAP = {
  dockerfile: 'dockerfile',
  makefile: 'makefile',
  '.gitignore': 'plaintext',
  '.env': 'plaintext',
  '.editorconfig': 'ini',
  '.eslintrc': 'json',
  '.prettierrc': 'json'
};

function detectLanguage(filePath) {
  if (!filePath) return 'plaintext';
  const basename = filePath.split('/').pop() || filePath;
  if (NAME_LANG_MAP[basename.toLowerCase()]) return NAME_LANG_MAP[basename.toLowerCase()];
  const dotIndex = basename.lastIndexOf('.');
  if (dotIndex <= 0 || dotIndex === basename.length - 1) {
    return 'plaintext';
  }
  const ext = basename.slice(dotIndex + 1).toLowerCase();
  return EXT_LANG_MAP[ext] || 'plaintext';
}

function parseFilePatches(diffText) {
  if (!diffText) return [];
  const lines = diffText.split('\n');
  const patches = [];
  let current = null;
  for (const line of lines) {
    if (line.startsWith('diff --git ')) {
      if (current) patches.push(current);
      current = { header: line, left: [], right: [], filePath: '' };
    } else if (current && line.startsWith('+++ b/')) {
      current.filePath = line.replace('+++ b/', '').trim();
    } else if (!current || line.startsWith('index ') || line.startsWith('--- ')) {
      continue;
    } else if (line.startsWith('@@')) {
      current.hunk = line;
    } else if (line.startsWith('\\ No newline')) {
      continue;
    } else if (line.startsWith('+')) {
      current.right.push(line.slice(1));
    } else if (line.startsWith('-')) {
      current.left.push(line.slice(1));
    } else {
      const content = line.startsWith(' ') ? line.slice(1) : line;
      current.left.push(content);
      current.right.push(content);
    }
  }
  if (current) patches.push(current);
  return patches;
}

function buildCombinedDiff(diffText) {
  const patches = parseFilePatches(diffText);
  if (patches.length === 0) {
    return { left: '', right: '', lang: 'plaintext' };
  }
  if (patches.length === 1) {
    const p = patches[0];
    return {
      left: p.left.join('\n'),
      right: p.right.join('\n'),
      lang: detectLanguage(p.filePath)
    };
  }
  const left = [];
  const right = [];
  for (const p of patches) {
    left.push(`--- ${p.filePath} ---`);
    right.push(`--- ${p.filePath} ---`);
    left.push(p.left.join('\n'));
    right.push(p.right.join('\n'));
    left.push('');
    right.push('');
  }
  return { left: left.join('\n'), right: right.join('\n'), lang: 'plaintext' };
}

function initEditor() {
  if (initPromise) return initPromise;
  if (!diffContainer.value) return Promise.resolve();
  initPromise = import('monaco-editor/esm/vs/editor/editor.api.js').then((m) => {
    monaco = m;
    if (!diffContainer.value) return;
    diffEditor = monaco.editor.createDiffEditor(diffContainer.value, {
      theme: 'vs-dark',
      automaticLayout: true,
      readOnly: true,
      renderSideBySide: true,
      fontSize: 12,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      fontFamily: 'JetBrains Mono, SF Mono, Menlo, monospace',
      renderWhitespace: 'selection',
      renderLineHighlight: 'none',
      ignoreTrimWhitespace: false
    });
    const { left, right, lang } = buildCombinedDiff(workflow.diffContent || '');
    originalModel = monaco.editor.createModel(left, lang);
    modifiedModel = monaco.editor.createModel(right, lang);
    diffEditor.setModel({ original: originalModel, modified: modifiedModel });
    if (pendingContent !== null) {
      applyContent(pendingContent);
      pendingContent = null;
    }
  });
  return initPromise;
}

function applyContent(diffText) {
  if (!diffEditor || !monaco) {
    pendingContent = diffText;
    return;
  }
  const { left, right, lang } = buildCombinedDiff(diffText || '');
  if (originalModel && modifiedModel) {
    const origLang = originalModel.getLanguageId();
    if (origLang !== lang) {
      monaco.editor.setModelLanguage(originalModel, lang);
      monaco.editor.setModelLanguage(modifiedModel, lang);
    }
    originalModel.setValue(left);
    modifiedModel.setValue(right);
  }
}

function scheduleUpdate(diffText) {
  if (updateTimer) clearTimeout(updateTimer);
  updateTimer = setTimeout(() => {
    updateTimer = null;
    applyContent(diffText);
  }, 80);
}

watch(
  () => workflow.diffContent,
  (val) => {
    if (diffEditor) {
      scheduleUpdate(val);
    } else if (monaco) {
      applyContent(val);
    } else {
      pendingContent = val;
    }
  }
);

watch(
  () => repositories.activeRepoId,
  async (id) => {
    if (!id) return;
    if (!diffEditor) {
      await initEditor();
    } else {
      applyContent(workflow.diffContent);
    }
  }
);

onMounted(async () => {
  await nextTick();
  if (repositories.activeRepoId && workflow.diffContent) {
    await initEditor();
    applyContent(workflow.diffContent);
  }
});

onBeforeUnmount(() => {
  if (updateTimer) clearTimeout(updateTimer);
  originalModel?.dispose();
  modifiedModel?.dispose();
  diffEditor?.dispose();
  diffEditor = null;
  initPromise = null;
});

const totalChanges = computed(() => {
  const s = workflow.status;
  if (!s) return 0;
  return (
    (s.staged?.length || 0) +
    (s.modified?.length || 0) +
    (s.created?.length || 0) +
    (s.deleted?.length || 0) +
    (s.untracked?.length || 0)
  );
});
</script>

<template>
  <div class="h-full flex flex-col bg-slate-900/40">
    <div class="flex items-center justify-between px-3 py-2 border-b border-slate-800">
      <div class="flex items-center gap-2">
        <h3 class="text-sm font-semibold text-slate-200">{{ t('diff.title') }}</h3>
        <span v-if="totalChanges > 0" class="badge-accent text-[10px]">
          {{ t('diff.files', { count: totalChanges }) }}
        </span>
      </div>
      <div class="inline-flex rounded-md border border-slate-700 overflow-hidden">
        <button
          class="px-2.5 py-1 text-xs"
          :class="workflow.diffStaged ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'"
          @click="workflow.setDiffMode(true)"
        >
          {{ t('diff.staged') }}
        </button>
        <button
          class="px-2.5 py-1 text-xs"
          :class="!workflow.diffStaged ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'"
          @click="workflow.setDiffMode(false)"
        >
          {{ t('diff.working') }}
        </button>
      </div>
    </div>
    <div
      v-if="!repositories.activeRepo"
      class="flex-1 flex items-center justify-center text-slate-500 text-sm"
    >
      {{ t('staging.selectRepo') }}
    </div>
    <div v-else ref="diffContainer" class="flex-1 min-h-0"></div>
  </div>
</template>
