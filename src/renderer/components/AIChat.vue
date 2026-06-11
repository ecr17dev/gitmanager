<script setup>
import { ref, nextTick, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useWorkflowStore } from '../stores/workflow.js';
import { useRepositoriesStore } from '../stores/repositories.js';
import { useToast } from '../composables/useToast.js';

const { t } = useI18n();
const workflow = useWorkflowStore();
const repositories = useRepositoriesStore();
const { toast } = useToast();

const messages = ref([]);
const input = ref('');
const busy = ref(false);
const messagesRef = ref(null);

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatText(text) {
  let s = escapeHtml(text || '');
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-slate-900/60 text-sky-300">$1</code>');
  s = s.replace(/\n/g, '<br>');
  return s;
}

function pushMessage(role, text) {
  messages.value.push({
    id: Date.now() + Math.floor(Math.random() * 1000),
    role,
    text
  });
  nextTick(() => {
    if (messagesRef.value) {
      messagesRef.value.scrollTop = messagesRef.value.scrollHeight;
    }
  });
}

async function send() {
  const text = input.value.trim();
  if (!text || busy.value) return;
  input.value = '';
  pushMessage('user', text);
  busy.value = true;
  try {
    const ctx = {
      stderr: workflow.lastError?.stderr || '',
      statusText: workflow.status ? JSON.stringify(workflow.status, null, 2) : '',
      recentLog: (workflow.log || [])
        .slice(0, 5)
        .map((c) => `${(c.hash || '').slice(0, 7)} ${c.subject}`)
        .join('\n')
    };
    const res = await window.api.ai.diagnose({
      repoPath: repositories.activeRepo?.localPath,
      accountId: repositories.activeRepo?.accountId,
      ...ctx
    });
    if (!res.success) {
      throw new Error(res.error?.message || 'Error');
    }
    const steps = (res.data.pasos || [])
      .map((p, i) => `${i + 1}. **${p.label}**\n   \`${p.command}\``)
      .join('\n\n');
    pushMessage(
      'assistant',
      `${res.data.explicacion}\n\n**Pasos sugeridos:**\n${steps}`
    );
  } catch (err) {
    pushMessage('assistant', `❌ ${err.message}`);
    toast.error(err.message);
  } finally {
    busy.value = false;
  }
}

const roleLabel = computed(() => ({
  user: t('chat.roleUser'),
  assistant: t('chat.roleAssistant'),
  system: t('chat.roleSystem')
}));

const roleClass = computed(() => ({
  user: 'bg-slate-800/70 text-slate-200',
  assistant: 'bg-sky-900/30 border border-sky-500/20 text-slate-200',
  system: 'bg-amber-900/20 border border-amber-500/20 text-amber-100'
}));

watch(
  () => workflow.lastError,
  (err) => {
    if (err) {
      pushMessage(
        'system',
        t('chat.systemDetected', { title: err.title, hint: err.hint })
      );
    }
  },
  { immediate: true, deep: true }
);
</script>

<template>
  <div class="h-full flex flex-col">
    <div class="px-3 py-2 border-b border-slate-800 flex items-center gap-2">
      <div class="w-6 h-6 rounded-md bg-gradient-to-br from-sky-500 to-violet-500 flex items-center justify-center text-xs">
        🤖
      </div>
      <div class="flex-1">
        <h2 class="text-sm font-semibold text-slate-100">{{ t('chat.title') }}</h2>
        <p class="text-[10px] text-slate-500">{{ t('chat.subtitle') }}</p>
      </div>
    </div>

    <div ref="messagesRef" class="flex-1 overflow-y-auto p-3 space-y-2">
      <div
        v-if="messages.length === 0"
        class="text-slate-500 text-xs text-center py-8"
      >
        {{ t('chat.empty') }}
      </div>
      <div
        v-for="m in messages"
        :key="m.id"
        class="rounded-md px-3 py-2 text-xs leading-relaxed animate-fade-in"
        :class="roleClass[m.role] || roleClass.user"
      >
        <div class="font-semibold mb-1 text-[10px] uppercase tracking-wider opacity-70">
          {{ roleLabel[m.role] || m.role }}
        </div>
        <div class="whitespace-pre-wrap font-mono" v-html="formatText(m.text)"></div>
      </div>
      <div v-if="busy" class="text-slate-500 text-xs px-3 py-2 italic">
        {{ t('chat.thinking') }}
      </div>
    </div>

    <form class="p-3 border-t border-slate-800 flex gap-2" @submit.prevent="send">
      <input
        v-model="input"
        class="input text-xs"
        :placeholder="t('chat.placeholder')"
        :disabled="busy"
      />
      <button
        type="submit"
        class="btn-primary text-xs px-3"
        :disabled="busy || !input.trim()"
      >
        {{ t('chat.send') }}
      </button>
    </form>
  </div>
</template>
