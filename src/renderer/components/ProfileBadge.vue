<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRepositoriesStore } from '../stores/repositories.js';
import { useAccountsStore } from '../stores/accounts.js';

const { t } = useI18n();
const repositories = useRepositoriesStore();
const accounts = useAccountsStore();

const account = computed(() => repositories.activeAccount);
const repo = computed(() => repositories.activeRepo);

const initials = computed(() => {
  const name = account.value?.profileName || account.value?.username;
  if (!name) return '–';
  return name
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
});

const color = computed(() => {
  const name = account.value?.username || 'guest';
  const palette = ['bg-sky-500', 'bg-emerald-500', 'bg-violet-500', 'bg-rose-500', 'bg-amber-500', 'bg-teal-500'];
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  return palette[hash % palette.length];
});
</script>

<template>
  <div class="flex items-center gap-2 text-xs">
    <div v-if="!repo" class="text-slate-500">
      {{ t('header.noRepo') }}
    </div>
    <template v-else>
      <div
        class="w-6 h-6 rounded-full flex items-center justify-center font-semibold text-white text-[10px]"
        :class="color"
      >
        {{ initials }}
      </div>
      <div v-if="account" class="flex flex-col leading-tight">
        <span class="text-slate-200 font-medium">
          {{ account.profileName }}
          <span v-if="account.authMethod === 'ssh'" class="text-amber-300 ml-1">🔑</span>
        </span>
        <span class="text-slate-500 text-[10px]">{{ account.email }}</span>
      </div>
      <div v-else class="flex flex-col leading-tight">
        <span class="text-amber-300 font-medium">{{ t('errors.noAccount') }}</span>
        <span class="text-slate-500 text-[10px]">{{ repo.name }}</span>
      </div>
    </template>
  </div>
</template>
