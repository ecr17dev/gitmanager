<script setup>
import { onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAccountsStore } from './stores/accounts.js';
import { useRepositoriesStore } from './stores/repositories.js';
import { useWorkflowStore } from './stores/workflow.js';
import { setLocale } from './i18n/index.js';
import RepositorySidebar from './components/RepositorySidebar.vue';
import CommitGraph from './components/CommitGraph.vue';
import StagingArea from './components/StagingArea.vue';
import AIChat from './components/AIChat.vue';
import ErrorWizard from './components/ErrorWizard.vue';
import ProfileBadge from './components/ProfileBadge.vue';
import ToastContainer from './components/ToastContainer.vue';
import LanguageSwitcher from './components/LanguageSwitcher.vue';

const { t } = useI18n();
const accounts = useAccountsStore();
const repositories = useRepositoriesStore();
const workflow = useWorkflowStore();

const locale = ref(typeof localStorage !== 'undefined' ? localStorage.getItem('gitnexus.locale') || 'es' : 'es');

watch(locale, (v) => setLocale(v));

onMounted(async () => {
  try {
    const stored = await window.api.settings.get('locale');
    if (stored?.success && stored.data && (stored.data === 'en' || stored.data === 'es')) {
      locale.value = stored.data;
      setLocale(stored.data);
    }
  } catch {}
  await accounts.load();
  await repositories.load();
  if (repositories.activeRepo) {
    await workflow.refreshAll();
  }
});
</script>

<template>
  <div class="h-full flex flex-col bg-slate-900 text-slate-100">
    <header class="flex items-center justify-between px-4 h-12 border-b border-slate-800 bg-slate-900/80 backdrop-blur">
      <div class="flex items-center gap-3">
        <div class="w-7 h-7 rounded-md bg-gradient-to-br from-sky-500 to-emerald-500 flex items-center justify-center font-bold text-white text-sm">
          G
        </div>
        <div>
          <h1 class="text-sm font-semibold tracking-tight">{{ t('app.name') }}</h1>
          <p class="text-[10px] text-slate-500 -mt-0.5">{{ t('app.tagline') }}</p>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <LanguageSwitcher v-model="locale" />
        <ProfileBadge />
      </div>
    </header>

    <main class="flex-1 grid grid-cols-[280px_1fr_360px] overflow-hidden">
      <aside class="border-r border-slate-800 overflow-y-auto">
        <RepositorySidebar />
      </aside>

      <section class="flex flex-col overflow-hidden">
        <div class="h-1/2 border-b border-slate-800 overflow-auto p-4">
          <CommitGraph />
        </div>
        <div class="h-1/2 overflow-hidden">
          <StagingArea />
        </div>
      </section>

      <aside class="border-l border-slate-800 overflow-hidden">
        <AIChat />
      </aside>
    </main>

    <ErrorWizard />
    <ToastContainer />
  </div>
</template>
