<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRepositoriesStore } from '../stores/repositories.js';
import { useAccountsStore } from '../stores/accounts.js';
import { useToast } from '../composables/useToast.js';
import AccountManager from './AccountManager.vue';

const { t } = useI18n();
const repositories = useRepositoriesStore();
const accounts = useAccountsStore();
const { toast } = useToast();

const addOpen = ref(false);
const form = ref({ name: '', localPath: '', accountId: null });
const errors = ref({});
const submitting = ref(false);
const reassignFor = ref(null);

const accountsList = computed(() => accounts.sortedAccounts);

function reset() {
  form.value = { name: '', localPath: '', accountId: null };
  errors.value = {};
}

async function pickDir() {
  try {
    const res = await window.api.dialog.openDir();
    if (res.canceled) return;
    form.value.localPath = res.path;
    if (!form.value.name) {
      const segs = res.path.replace(/\\/g, '/').split('/').filter(Boolean);
      form.value.name = segs[segs.length - 1] || 'repositorio';
    }
    errors.value = { ...errors.value, localPath: null };
  } catch (err) {
    toast.error(err.message);
  }
}

async function submit() {
  errors.value = {};
  if (!form.value.name.trim()) errors.value.name = t('accounts.errors.required');
  if (!form.value.localPath.trim()) errors.value.localPath = t('accounts.errors.required');
  if (Object.keys(errors.value).length > 0) return;

  submitting.value = true;
  try {
    await repositories.add({ ...form.value, accountId: form.value.accountId || null });
    toast.success(t('repositories.addSuccess', { name: form.value.name }));
    reset();
    addOpen.value = false;
  } catch (err) {
    const field = err.field;
    if (field === 'localPath') {
      errors.value = { localPath: err.message };
    } else {
      toast.error(err.message);
    }
  } finally {
    submitting.value = false;
  }
}

async function remove(repo) {
  const ok = confirm(t('repositories.removeConfirm', { name: repo.name }));
  if (!ok) return;
  try {
    await repositories.remove(repo.id);
    toast.info(t('repositories.removeSuccess'));
  } catch (err) {
    toast.error(err.message);
  }
}

async function reassign(repoId, accountId) {
  if (!accountId) return;
  try {
    await repositories.setAccount(repoId, Number(accountId));
    reassignFor.value = null;
    toast.success(t('repositories.assignSuccess'));
  } catch (err) {
    toast.error(err.message);
  }
}

function onKey(e) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'o' && !e.shiftKey) {
    e.preventDefault();
    addOpen.value = true;
  }
  if (e.key === 'Escape' && addOpen.value) {
    addOpen.value = false;
    reset();
  }
}

onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<template>
  <div class="flex flex-col h-full">
    <AccountManager />

    <div class="px-3 py-2 border-b border-slate-800 flex items-center justify-between">
      <h3 class="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
        {{ t('repositories.title') }}
      </h3>
      <button
        class="text-sky-400 hover:text-sky-300 text-xs"
        @click="addOpen = !addOpen; if (addOpen) reset()"
      >
        {{ addOpen ? t('repositories.close') : t('repositories.add') }}
      </button>
    </div>

    <form
      v-if="addOpen"
      class="px-3 py-2 space-y-2 border-b border-slate-800 animate-slide-up"
      @submit.prevent="submit"
    >
      <div>
        <input
          v-model="form.name"
          class="input"
          :class="errors.name && 'border-rose-500/50'"
          :placeholder="t('repositories.fields.name')"
          maxlength="80"
        />
        <p v-if="errors.name" class="text-rose-400 text-[10px] mt-0.5">{{ errors.name }}</p>
      </div>
      <div>
        <div class="flex gap-1">
          <input
            v-model="form.localPath"
            class="input font-mono text-[11px]"
            :class="errors.localPath && 'border-rose-500/50'"
            :placeholder="t('repositories.fields.localPath')"
          />
          <button type="button" class="btn-secondary px-2" @click="pickDir" :title="t('common.open')">
            📁
          </button>
        </div>
        <p v-if="errors.localPath" class="text-rose-400 text-[10px] mt-0.5">{{ errors.localPath }}</p>
      </div>
      <select v-model="form.accountId" class="input">
        <option :value="null">{{ t('repositories.fields.account') }}</option>
        <option v-for="a in accountsList" :key="a.id" :value="a.id">
          {{ a.profileName }} ({{ a.username }})
        </option>
      </select>
      <div class="flex gap-2">
        <button type="submit" class="btn-primary flex-1" :disabled="submitting">
          {{ submitting ? t('repositories.submitBusy') : t('repositories.submit') }}
        </button>
        <button type="button" class="btn-ghost" @click="addOpen = false; reset()">
          {{ t('common.cancel') }}
        </button>
      </div>
      <p class="text-[10px] text-slate-500" v-html="t('repositories.mustHaveGit')" />
    </form>

    <ul class="flex-1 overflow-y-auto py-1">
      <li
        v-if="repositories.repositories.length === 0"
        class="text-xs text-slate-500 px-3 py-4 text-center"
      >
        {{ t('repositories.empty') }}
      </li>
      <li
        v-for="repo in repositories.repositories"
        :key="repo.id"
        class="px-3 py-2 cursor-pointer border-l-2 transition-colors group"
        :class="repo.id === repositories.activeRepoId
          ? 'bg-slate-800/70 border-sky-500'
          : 'border-transparent hover:bg-slate-800/40'"
        @click="repositories.setActive(repo.id)"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0 flex-1">
            <div class="text-sm font-medium text-slate-100 truncate">{{ repo.name }}</div>
            <div class="text-[10px] text-slate-500 font-mono truncate" :title="repo.localPath">
              {{ repo.localPath }}
            </div>
            <div class="mt-1 flex items-center gap-1">
              <span
                v-if="repo.accountId"
                class="badge-muted text-[10px]"
              >
                {{ repo.accountProfileName || repo.accountUsername }}
                <span v-if="repo.accountAuthMethod === 'ssh'" class="ml-1 text-amber-300">🔑</span>
              </span>
              <span v-else class="badge-warn text-[10px]">{{ t('repositories.noAccount') }}</span>
            </div>
          </div>
          <div class="opacity-0 group-hover:opacity-100 flex flex-col gap-1">
            <button
              class="text-slate-500 hover:text-sky-400 text-xs"
              :title="t('repositories.notInList')"
              @click.stop="reassignFor = reassignFor === repo.id ? null : repo.id"
            >
              ⚙
            </button>
            <button
              class="text-slate-500 hover:text-rose-400 text-xs"
              :title="t('common.remove')"
              @click.stop="remove(repo)"
            >
              ×
            </button>
          </div>
        </div>
        <div v-if="reassignFor === repo.id" class="mt-2" @click.stop>
          <select
            class="input text-xs"
            :value="repo.accountId || ''"
            @change="(e) => reassign(repo.id, e.target.value)"
          >
            <option value="" disabled>— {{ t('common.refresh') }} —</option>
            <option v-for="a in accountsList" :key="a.id" :value="a.id">
              {{ a.profileName }} ({{ a.username }})
            </option>
          </select>
        </div>
      </li>
    </ul>
  </div>
</template>
