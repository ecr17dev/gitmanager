<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useWorkflowStore } from '../stores/workflow.js';
import { useRepositoriesStore } from '../stores/repositories.js';
import { useToast } from '../composables/useToast.js';

const { t } = useI18n();
const workflow = useWorkflowStore();
const repositories = useRepositoriesStore();
const { toast } = useToast();

const executing = ref(false);

const suggestion = computed(() => workflow.pendingSuggestion);

const severityClass = computed(() => {
  const s = suggestion.value?.severity;
  if (s === 'error') return 'border-rose-500/40 bg-rose-500/5';
  if (s === 'warning') return 'border-amber-500/40 bg-amber-500/5';
  if (s === 'info') return 'border-sky-500/40 bg-sky-500/5';
  return 'border-slate-700 bg-slate-800/40';
});

const severityBadge = computed(() => {
  const s = suggestion.value?.severity;
  if (s === 'error') return { class: 'badge-error', label: t('errorWizard.severityError') };
  if (s === 'warning') return { class: 'badge-warn', label: t('errorWizard.severityWarning') };
  if (s === 'info') return { class: 'badge-info', label: t('errorWizard.severityInfo') };
  return { class: 'badge-muted', label: t('errorWizard.severityMuted') };
});

const levelBadge = computed(() => {
  if (suggestion.value?.level === 'ai') return { class: 'badge-accent', label: t('errorWizard.levelAI') };
  if (suggestion.value?.level === 'local') return { class: 'badge-info', label: t('errorWizard.levelLocal') };
  return { class: 'badge-muted', label: t('errorWizard.levelManual') };
});

async function executeAction(action) {
  if (!action) return;
  executing.value = true;
  try {
    if (action.kind === 'pull-rebase') {
      await workflow.pullRebase();
      toast.success(t('staging.success.pull'));
    } else if (action.kind === 'reassign-account') {
      toast.info(t('errorWizard.actions.reassign'));
    } else if (action.kind === 'run-command' && action.command) {
      await navigator.clipboard.writeText(action.command);
      toast.info(t('errorWizard.actions.copyHint'));
    } else if (action.kind === 'multi-step' && action.steps) {
      toast.info(t('errorWizard.actions.steps'));
    } else if (action.kind === 'copy-command' && action.command) {
      await navigator.clipboard.writeText(action.command);
      toast.success(t('errorWizard.actions.copy'));
    } else if (action.kind === 'refresh') {
      await workflow.refreshAll();
    } else if (action.kind === 'list-conflicted') {
      toast.info(t('errorWizard.actions.openFiles'));
    } else if (action.kind === 'configure-remote') {
      toast.warning(t('errorWizard.actions.configureRemote'));
    } else {
      toast.info(t('errorWizard.actions.notImplemented'));
    }
    workflow.dismissSuggestion();
  } catch (err) {
    toast.error(err.message);
  } finally {
    executing.value = false;
  }
}
</script>

<template>
  <transition name="modal">
    <div
      v-if="suggestion"
      class="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      @click.self="workflow.dismissSuggestion()"
    >
      <div
        class="max-w-lg w-full rounded-lg border shadow-2xl animate-slide-up"
        :class="severityClass"
      >
        <div class="p-4 border-b border-slate-700/50 flex items-start justify-between gap-3">
          <div>
            <div class="flex items-center gap-2 mb-1">
              <span :class="severityBadge.class + ' text-[10px]'">{{ severityBadge.label }}</span>
              <span :class="levelBadge.class + ' text-[10px]'">{{ levelBadge.label }}</span>
            </div>
            <h2 class="text-base font-semibold text-slate-100">
              {{ suggestion.title }}
            </h2>
          </div>
          <button
            class="text-slate-500 hover:text-slate-300 text-lg leading-none"
            @click="workflow.dismissSuggestion()"
            :title="t('common.close')"
          >
            ×
          </button>
        </div>

        <div class="p-4 space-y-3 text-sm">
          <p class="text-slate-300 leading-relaxed">{{ suggestion.hint }}</p>

          <div
            v-if="suggestion.action?.kind === 'multi-step'"
            class="space-y-2"
          >
            <div
              v-for="(step, i) in suggestion.action.steps"
              :key="i"
              class="bg-slate-900/60 border border-slate-700/60 rounded-md p-2.5"
            >
              <div class="text-xs text-slate-300 font-medium mb-1">
                {{ i + 1 }}. {{ step.label }}
              </div>
              <code class="block text-[11px] text-sky-300 font-mono break-all">
                {{ step.command }}
              </code>
            </div>
          </div>

          <div
            v-else-if="suggestion.action?.command"
            class="bg-slate-900/60 border border-slate-700/60 rounded-md p-2.5"
          >
            <code class="block text-[11px] text-sky-300 font-mono break-all">
              {{ suggestion.action.command }}
            </code>
          </div>

          <details
            v-if="suggestion.stderr"
            class="bg-slate-950/60 border border-slate-800 rounded p-2"
          >
            <summary class="text-[10px] text-slate-500 cursor-pointer hover:text-slate-300">
              {{ t('errorWizard.seeStderr') }}
            </summary>
            <pre class="mt-2 text-[10px] text-rose-300/80 font-mono whitespace-pre-wrap">{{ suggestion.stderr }}</pre>
          </details>
        </div>

        <div class="p-4 border-t border-slate-700/50 flex justify-end gap-2">
          <button class="btn-ghost" @click="workflow.dismissSuggestion()">
            {{ t('common.close') }}
          </button>
          <button
            v-if="suggestion.action && suggestion.action.kind !== 'multi-step'"
            class="btn-primary"
            :disabled="executing"
            @click="executeAction(suggestion.action)"
          >
            {{ executing ? t('common.loading') : (suggestion.action.label || t('common.open')) }}
          </button>
          <button
            v-else
            class="btn-primary"
            @click="executeAction(suggestion.action)"
          >
            {{ t('common.close') }}
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.modal-enter-active, .modal-leave-active { transition: opacity 0.18s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
</style>
