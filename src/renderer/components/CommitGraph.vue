<script setup>
import { ref, watch, onMounted, onBeforeUnmount, nextTick, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { createGitgraph, templateExtend, TemplateName } from '@gitgraph/js';
import { useWorkflowStore } from '../stores/workflow.js';
import { useRepositoriesStore } from '../stores/repositories.js';

const { t } = useI18n();
const workflow = useWorkflowStore();
const repositories = useRepositoriesStore();

const containerRef = ref(null);
let graph = null;
let pendingRender = null;
let resizeObserver = null;
let renderScheduled = false;

const palette = ['#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#f43f5e'];

function colorFromAuthor(author) {
  let hash = 0;
  for (const c of author || '') hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  return palette[hash % palette.length];
}

function shortHash(h) {
  return (h || '').slice(0, 7);
}

function formatDate(d) {
  if (!d) return '';
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return d;
    return date.toLocaleString();
  } catch {
    return d;
  }
}

function buildGraph() {
  if (!containerRef.value) return;
  containerRef.value.innerHTML = '';
  const isDark = document.documentElement.classList.contains('dark');
  const template = templateExtend(TemplateName.Metro, {
    colors: palette,
    branch: {
      lineWidth: 2,
      spacing: 28,
      label: { font: '11px monospace', color: isDark ? '#cbd5e1' : '#1e293b' }
    },
    commit: {
      spacing: 36,
      message: {
        font: '12px -apple-system, sans-serif',
        color: isDark ? '#e2e8f0' : '#0f172a'
      }
    },
    author: ''
  });
  graph = createGitgraph({ container: containerRef.value, template });
  renderCommits(workflow.log || []);
}

function renderCommits(commits) {
  if (!graph) return;
  if (!commits || commits.length === 0) {
    const master = graph.branch('main');
    master.commit(t('graph.noCommits'));
    return;
  }
  const main = graph.branch('main');
  for (const c of commits) {
    const subject = c.subject || '(no message)';
    main.commit({
      subject: subject.length > 60 ? subject.slice(0, 60) + '…' : subject,
      author: `${c.author || 'Anónimo'} · ${formatDate(c.date)}`,
      hash: shortHash(c.hash),
      style: { dot: { color: colorFromAuthor(c.author) } }
    });
  }
}

function scheduleRender() {
  if (renderScheduled) return;
  renderScheduled = true;
  requestAnimationFrame(() => {
    renderScheduled = false;
    if (pendingRender) {
      clearTimeout(pendingRender);
      pendingRender = null;
    }
    pendingRender = setTimeout(() => {
      buildGraph();
    }, 50);
  });
}

watch(() => workflow.log, () => scheduleRender(), { deep: false });
watch(() => repositories.activeRepoId, () => scheduleRender());

onMounted(() => {
  nextTick(() => {
    buildGraph();
    if (containerRef.value && 'ResizeObserver' in window) {
      resizeObserver = new ResizeObserver(() => {
        if (containerRef.value && graph) {
          scheduleRender();
        }
      });
      resizeObserver.observe(containerRef.value);
    }
  });
});

onBeforeUnmount(() => {
  if (pendingRender) clearTimeout(pendingRender);
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  if (containerRef.value) containerRef.value.innerHTML = '';
  graph = null;
});

const branchLabel = computed(() => workflow.branch || 'main');
</script>

<template>
  <div class="h-full flex flex-col">
    <div class="flex items-center justify-between mb-2">
      <div class="flex items-center gap-2">
        <h2 class="text-sm font-semibold text-slate-200">{{ t('graph.title') }}</h2>
        <span class="badge-muted text-[10px]">{{ branchLabel }}</span>
        <span v-if="workflow.logLoading" class="text-[10px] text-slate-500">{{ t('graph.loading') }}</span>
      </div>
      <button
        class="btn-ghost text-xs"
        :disabled="workflow.busy"
        @click="workflow.refreshAll()"
      >
        ↻ {{ t('common.refresh') }}
      </button>
    </div>
    <div
      v-if="!repositories.activeRepo"
      class="flex-1 flex items-center justify-center text-slate-500 text-sm"
    >
      {{ t('graph.select') }}
    </div>
    <div
      v-else
      ref="containerRef"
      class="flex-1 overflow-auto bg-slate-900/40 rounded-md border border-slate-800/60 p-3"
    ></div>
  </div>
</template>
