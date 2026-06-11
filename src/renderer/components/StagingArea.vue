<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useWorkflowStore } from '../stores/workflow.js';
import { useRepositoriesStore } from '../stores/repositories.js';
import { useToast } from '../composables/useToast.js';
import DiffViewer from './DiffViewer.vue';
import VirtualList from './VirtualList.vue';

const { t } = useI18n();
const workflow = useWorkflowStore();
const repositories = useRepositoriesStore();
const { toast } = useToast();

const status = computed(() => workflow.status);

const unstagedFiles = computed(() => {
  if (!status.value) return [];
  return [
    ...(status.value.modified || []).map((f) => ({ file: f, kind: 'modified' })),
    ...(status.value.deleted || []).map((f) => ({ file: f, kind: 'deleted' })),
    ...(status.value.untracked || []).map((f) => ({ file: f, kind: 'untracked' }))
  ];
});

const stagedFiles = computed(() => {
  if (!status.value) return [];
  return [
    ...(status.value.staged || []).map((f) => ({ file: f, kind: 'staged' })),
    ...(status.value.created || []).map((f) => ({ file: f, kind: 'created' }))
  ];
});

const VIRTUALIZE_THRESHOLD = 100;
const useVirtualUnstaged = computed(() => unstagedFiles.value.length > VIRTUALIZE_THRESHOLD);
const useVirtualStaged = computed(() => stagedFiles.value.length > VIRTUALIZE_THRESHOLD);

const kindBadge = {
  modified: { class: 'badge-warn', label: 'M' },
  deleted: { class: 'badge-error', label: 'D' },
  untracked: { class: 'badge-info', label: '?' },
  staged: { class: 'badge-accent', label: 'S' },
  created: { class: 'badge-accent', label: 'A' }
};

async function withToast(fn, successMsg) {
  try {
    await fn();
    if (successMsg) toast.success(successMsg);
  } catch (err) {
    toast.error(err.message);
  }
}

async function onCommit() {
  if (!repositories.activeRepo?.accountId) {
    toast.error(t('staging.error.noAccount'));
    return;
  }
  await withToast(() => workflow.commit(), t('staging.success.commit'));
}

async function onPush() {
  if (!repositories.activeRepo?.accountId) {
    toast.error(t('staging.error.noAccountShort'));
    return;
  }
  await withToast(() => workflow.push(), t('staging.success.push'));
}

async function onPull() {
  if (!repositories.activeRepo?.accountId) {
    toast.error(t('staging.error.noAccountShort'));
    return;
  }
  await withToast(() => workflow.pullRebase(), t('staging.success.pull'));
}

async function onGenerateAI() {
  if (!repositories.activeRepo?.accountId) {
    toast.error(t('staging.error.noAccountShort'));
    return;
  }
  if (!workflow.hasStaged) {
    toast.warning(t('staging.noStagedWarning'));
    return;
  }
  try {
    await workflow.generateAICommit();
    toast.success(t('staging.success.ai'));
  } catch (err) {
    toast.error(err.message);
  }
}
</script>

<template>
  <div class="h-full flex flex-col">
    <div class="grid grid-cols-2 gap-2 px-3 py-2 border-b border-slate-800 text-xs flex-none">
      <div class="card p-2 max-h-32 overflow-hidden flex flex-col">
        <div class="flex items-center justify-between mb-1">
          <span class="text-slate-400 font-semibold">{{ t('staging.unstaged') }}</span>
          <button
            v-if="unstagedFiles.length > 0"
            class="text-sky-400 hover:text-sky-300"
            :disabled="workflow.busy"
            @click="workflow.stageAll()"
          >
            {{ t('staging.stageAll') }}
          </button>
        </div>
        <div v-if="unstagedFiles.length > 0" class="flex-1 min-h-0">
          <ul v-if="!useVirtualUnstaged" class="space-y-0.5 overflow-auto max-h-28">
            <li
              v-for="item in unstagedFiles"
              :key="item.file"
              class="flex items-center gap-2 hover:bg-slate-800/50 rounded px-1 py-0.5 group"
            >
              <span :class="kindBadge[item.kind].class + ' !text-[9px] !py-0'">
                {{ kindBadge[item.kind].label }}
              </span>
              <span class="font-mono text-slate-200 text-[11px] truncate flex-1" :title="item.file">
                {{ item.file }}
              </span>
              <button
                class="opacity-0 group-hover:opacity-100 text-sky-400 text-[10px]"
                @click="workflow.stage([item.file])"
                :title="t('staging.staged')"
              >
                +
              </button>
            </li>
          </ul>
          <VirtualList
            v-else
            :items="unstagedFiles"
            :item-height="20"
            class="h-28"
          >
            <template #default="{ item }">
              <div class="flex items-center gap-2 hover:bg-slate-800/50 rounded px-1 group h-full">
                <span :class="kindBadge[item.kind].class + ' !text-[9px] !py-0'">
                  {{ kindBadge[item.kind].label }}
                </span>
                <span class="font-mono text-slate-200 text-[11px] truncate flex-1" :title="item.file">
                  {{ item.file }}
                </span>
                <button
                  class="opacity-0 group-hover:opacity-100 text-sky-400 text-[10px]"
                  @click="workflow.stage([item.file])"
                >
                  +
                </button>
              </div>
            </template>
          </VirtualList>
        </div>
        <p v-else class="text-slate-600 italic text-[10px]">{{ t('staging.empty') }}</p>
      </div>

      <div class="card p-2 max-h-32 overflow-hidden flex flex-col">
        <div class="flex items-center justify-between mb-1">
          <span class="text-slate-400 font-semibold">{{ t('staging.staged') }}</span>
          <button
            v-if="stagedFiles.length > 0"
            class="text-amber-400 hover:text-amber-300"
            :disabled="workflow.busy"
            @click="workflow.unstageAll()"
          >
            {{ t('staging.unstageAll') }}
          </button>
        </div>
        <div v-if="stagedFiles.length > 0" class="flex-1 min-h-0">
          <ul v-if="!useVirtualStaged" class="space-y-0.5 overflow-auto max-h-28">
            <li
              v-for="item in stagedFiles"
              :key="item.file"
              class="flex items-center gap-2 hover:bg-slate-800/50 rounded px-1 py-0.5 group"
            >
              <span :class="kindBadge[item.kind].class + ' !text-[9px] !py-0'">
                {{ kindBadge[item.kind].label }}
              </span>
              <span class="font-mono text-slate-200 text-[11px] truncate flex-1" :title="item.file">
                {{ item.file }}
              </span>
              <button
                class="opacity-0 group-hover:opacity-100 text-amber-400 text-[10px]"
                @click="workflow.unstage([item.file])"
                :title="t('staging.unstaged')"
              >
                −
              </button>
            </li>
          </ul>
          <VirtualList
            v-else
            :items="stagedFiles"
            :item-height="20"
            class="h-28"
          >
            <template #default="{ item }">
              <div class="flex items-center gap-2 hover:bg-slate-800/50 rounded px-1 group h-full">
                <span :class="kindBadge[item.kind].class + ' !text-[9px] !py-0'">
                  {{ kindBadge[item.kind].label }}
                </span>
                <span class="font-mono text-slate-200 text-[11px] truncate flex-1" :title="item.file">
                  {{ item.file }}
                </span>
                <button
                  class="opacity-0 group-hover:opacity-100 text-amber-400 text-[10px]"
                  @click="workflow.unstage([item.file])"
                >
                  −
                </button>
              </div>
            </template>
          </VirtualList>
        </div>
        <p v-else class="text-slate-600 italic text-[10px]">{{ t('staging.emptyStaged') }}</p>
      </div>
    </div>

    <div class="flex-1 min-h-0 border-b border-slate-800">
      <DiffViewer />
    </div>

    <div class="p-3 space-y-2 flex-none bg-slate-900/60">
      <input
        v-model="workflow.commitTitle"
        class="input font-semibold"
        :placeholder="t('staging.commitPlaceholder')"
        maxlength="120"
        @keydown.meta.enter="onCommit"
        @keydown.ctrl.enter="onCommit"
        @keydown.meta.z.prevent="workflow.undo()"
        @keydown.ctrl.z.prevent="workflow.undo()"
        @keydown.meta.shift.z.prevent="workflow.redo()"
        @keydown.ctrl.shift.z.prevent="workflow.redo()"
      />
      <textarea
        v-model="workflow.commitBody"
        class="input min-h-[60px] resize-y"
        :placeholder="t('staging.bodyPlaceholder')"
        rows="3"
        @keydown.meta.z.prevent="workflow.undo()"
        @keydown.ctrl.z.prevent="workflow.undo()"
        @keydown.meta.shift.z.prevent="workflow.redo()"
        @keydown.ctrl.shift.z.prevent="workflow.redo()"
      />
      <div class="flex items-center gap-1.5 text-[10px] text-slate-500">
        <span
          v-if="workflow.canUndo"
          class="text-sky-400 cursor-pointer hover:text-sky-300"
          @click="workflow.undo()"
          :title="t('common.refresh')"
        >↶ Undo</span>
        <span
          v-if="workflow.canRedo"
          class="text-sky-400 cursor-pointer hover:text-sky-300"
          @click="workflow.redo()"
          :title="t('common.refresh')"
        >↷ Redo</span>
        <span class="ml-auto">{{ t('shortcuts.commitHint') }} · ⌘Z/⇧⌘Z</span>
      </div>
      <div class="flex flex-wrap gap-1.5">
        <button
          class="btn-secondary"
          :disabled="workflow.aiBusy || !workflow.hasStaged"
          @click="onGenerateAI"
        >
          <span v-if="workflow.aiBusy" class="inline-block animate-spin">⟳</span>
          <span v-else>✨</span>
          {{ workflow.aiBusy ? t('staging.aiBusy') : t('staging.aiTitle') }}
        </button>
        <button
          class="btn-primary"
          :disabled="workflow.busy || !workflow.commitTitle.trim() || !repositories.activeRepo?.accountId"
          @click="onCommit"
        >
          💾 {{ t('staging.commit') }}
        </button>
        <button
          class="btn-success"
          :disabled="workflow.busy || !repositories.activeRepo?.accountId"
          @click="onPush"
        >
          ⬆ {{ t('staging.push') }}
        </button>
        <button
          class="btn-ghost"
          :disabled="workflow.busy || !repositories.activeRepo?.accountId"
          @click="onPull"
        >
          ⬇ {{ t('staging.pull') }}
        </button>
      </div>
      <p v-if="!repositories.activeRepo" class="text-[10px] text-slate-500">
        {{ t('staging.selectRepoHint') }}
      </p>
      <p v-else-if="!repositories.activeRepo.accountId" class="text-[10px] text-amber-400">
        {{ t('staging.noAccountHint') }}
      </p>
    </div>
  </div>
</template>
