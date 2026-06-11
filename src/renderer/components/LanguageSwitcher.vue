<script setup>
import { useI18n } from 'vue-i18n';

const { t, locale } = useI18n();

function setLocale(v) {
  locale.value = v;
  try {
    window.api?.settings?.set?.('locale', v);
  } catch {}
}
</script>

<template>
  <div class="inline-flex rounded-md border border-slate-700 overflow-hidden text-[10px]">
    <button
      class="px-2 py-1"
      :class="locale === 'es' ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'"
      @click="setLocale('es')"
      :title="t('settings.languages.es')"
    >
      ES
    </button>
    <button
      class="px-2 py-1"
      :class="locale === 'en' ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'"
      @click="setLocale('en')"
      :title="t('settings.languages.en')"
    >
      EN
    </button>
  </div>
</template>
