<script setup>
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAccountsStore } from '../stores/accounts.js';
import { useToast } from '../composables/useToast.js';

const { t } = useI18n();
const accounts = useAccountsStore();
const { toast } = useToast();

const open = ref(false);
const form = ref({
  profileName: '',
  username: '',
  email: '',
  token: '',
  authMethod: 'https',
  sshKeyPath: ''
});
const submitting = ref(false);
const showToken = ref(false);
const errors = ref({});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GITHUB_USER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38}[A-Za-z0-9])?$/;

function reset() {
  form.value = {
    profileName: '',
    username: '',
    email: '',
    token: '',
    authMethod: 'https',
    sshKeyPath: ''
  };
  errors.value = {};
}

function validateLocal() {
  const e = {};
  if (!form.value.profileName.trim()) e.profileName = t('accounts.errors.required');
  if (!form.value.username.trim()) {
    e.username = t('accounts.errors.required');
  } else if (!GITHUB_USER_RE.test(form.value.username)) {
    e.username = t('accounts.errors.usernameInvalid');
  }
  if (!form.value.email.trim()) {
    e.email = t('accounts.errors.required');
  } else if (!EMAIL_RE.test(form.value.email)) {
    e.email = t('accounts.errors.emailInvalid');
  }
  if (form.value.authMethod === 'https' && !form.value.token) {
    e.token = t('accounts.errors.tokenRequired');
  }
  if (form.value.authMethod === 'ssh' && !form.value.sshKeyPath.trim()) {
    e.sshKeyPath = t('accounts.errors.sshKeyRequired');
  }
  errors.value = e;
  return Object.keys(e).length === 0;
}

async function pickSshKey() {
  try {
    const res = await window.api.dialog.openFile();
    if (res.canceled) return;
    form.value.sshKeyPath = res.path;
    errors.value = { ...errors.value, sshKeyPath: null };
  } catch (err) {
    toast.error(err.message);
  }
}

async function submit() {
  if (!validateLocal()) return;
  submitting.value = true;
  try {
    const payload = { ...form.value };
    if (payload.authMethod === 'ssh') {
      payload.token = '';
    } else {
      payload.sshKeyPath = '';
    }
    await accounts.add(payload);
    toast.success(t('accounts.addSuccess', { name: form.value.profileName }));
    reset();
    open.value = false;
  } catch (err) {
    const field = err.field;
    if (field) {
      errors.value = { [field]: err.message };
    } else {
      toast.error(err.message);
    }
  } finally {
    submitting.value = false;
  }
}

async function remove(id, name) {
  const ok = confirm(t('accounts.removeConfirm', { name }));
  if (!ok) return;
  try {
    await accounts.remove(id);
    toast.info(t('accounts.removeSuccess', { name }));
  } catch (err) {
    toast.error(err.message);
  }
}
</script>

<template>
  <div class="px-3 py-2 border-b border-slate-800">
    <div class="flex items-center justify-between mb-2">
      <h3 class="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
        {{ t('accounts.title') }}
      </h3>
      <button
        class="text-sky-400 hover:text-sky-300 text-xs"
        @click="open = !open; if (open) reset()"
      >
        {{ open ? t('accounts.close') : t('accounts.add') }}
      </button>
    </div>

    <div
      v-if="accounts.sortedAccounts.length === 0"
      class="text-xs text-slate-500 py-2"
    >
      {{ t('accounts.empty') }}
    </div>

    <ul v-else class="space-y-1">
      <li
        v-for="a in accounts.sortedAccounts"
        :key="a.id"
        class="flex items-center justify-between text-xs py-1 px-2 rounded hover:bg-slate-800/60 group"
      >
        <div class="flex flex-col min-w-0">
          <span class="text-slate-200 font-medium truncate">
            {{ a.profileName }}
            <span
              v-if="a.authMethod === 'ssh'"
              class="badge-muted ml-1 text-[9px] !py-0"
            >SSH</span>
          </span>
          <span class="text-slate-500 truncate">{{ a.username }} · {{ a.email }}</span>
        </div>
        <button
          class="text-slate-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
          @click="remove(a.id, a.profileName)"
          :title="t('common.remove')"
        >
          ×
        </button>
      </li>
    </ul>

    <form
      v-if="open"
      class="mt-2 space-y-2 animate-slide-up"
      @submit.prevent="submit"
    >
      <div>
        <input
          v-model="form.profileName"
          class="input"
          :class="errors.profileName && 'border-rose-500/50'"
          :placeholder="t('accounts.fields.profileName')"
          maxlength="80"
          autocomplete="off"
        />
        <p v-if="errors.profileName" class="text-rose-400 text-[10px] mt-0.5">{{ errors.profileName }}</p>
      </div>
      <div>
        <input
          v-model="form.username"
          class="input"
          :class="errors.username && 'border-rose-500/50'"
          :placeholder="t('accounts.fields.username')"
          maxlength="100"
          autocomplete="off"
        />
        <p v-if="errors.username" class="text-rose-400 text-[10px] mt-0.5">{{ errors.username }}</p>
      </div>
      <div>
        <input
          v-model="form.email"
          class="input"
          :class="errors.email && 'border-rose-500/50'"
          :placeholder="t('accounts.fields.email')"
          type="email"
          maxlength="254"
          autocomplete="off"
        />
        <p v-if="errors.email" class="text-rose-400 text-[10px] mt-0.5">{{ errors.email }}</p>
      </div>
      <div>
        <label class="text-[10px] text-slate-500 mb-1 block">
          {{ t('accounts.auth.method') }}
        </label>
        <div class="flex gap-1">
          <button
            type="button"
            class="flex-1 px-2 py-1.5 rounded text-xs border transition-colors"
            :class="form.authMethod === 'https'
              ? 'bg-sky-600/20 border-sky-500/50 text-sky-200'
              : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'"
            @click="form.authMethod = 'https'"
          >
            🔒 HTTPS
          </button>
          <button
            type="button"
            class="flex-1 px-2 py-1.5 rounded text-xs border transition-colors"
            :class="form.authMethod === 'ssh'
              ? 'bg-amber-600/20 border-amber-500/50 text-amber-200'
              : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'"
            @click="form.authMethod = 'ssh'"
          >
            🔑 SSH
          </button>
        </div>
      </div>
      <div v-if="form.authMethod === 'https'">
        <div class="relative">
          <input
            v-model="form.token"
            :type="showToken ? 'text' : 'password'"
            class="input pr-16 font-mono"
            :class="errors.token && 'border-rose-500/50'"
            :placeholder="t('accounts.fields.token')"
            autocomplete="off"
            maxlength="500"
          />
          <button
            type="button"
            class="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 hover:text-slate-200 px-2 py-1"
            @click="showToken = !showToken"
          >
            {{ showToken ? t('accounts.close') : t('common.open') }}
          </button>
        </div>
        <p v-if="errors.token" class="text-rose-400 text-[10px] mt-0.5">{{ errors.token }}</p>
        <p
          class="text-[10px] text-slate-500 mt-1"
          v-html="t('accounts.auth.tokenInfo')"
        />
      </div>
      <div v-else>
        <div class="flex gap-1">
          <input
            v-model="form.sshKeyPath"
            class="input font-mono text-[11px]"
            :class="errors.sshKeyPath && 'border-rose-500/50'"
            :placeholder="t('accounts.fields.sshKey')"
            autocomplete="off"
          />
          <button type="button" class="btn-secondary px-2" @click="pickSshKey" :title="t('common.open')">
            📁
          </button>
        </div>
        <p v-if="errors.sshKeyPath" class="text-rose-400 text-[10px] mt-0.5">{{ errors.sshKeyPath }}</p>
        <p class="text-[10px] text-slate-500 mt-1">
          Ej: <code class="text-slate-400">~/.ssh/id_ed25519</code>
        </p>
      </div>
      <div class="flex gap-2">
        <button type="submit" class="btn-primary flex-1" :disabled="submitting">
          {{ submitting ? t('accounts.submitBusy') : t('accounts.submit') }}
        </button>
        <button type="button" class="btn-ghost" @click="open = false; reset()">
          {{ t('common.cancel') }}
        </button>
      </div>
    </form>
  </div>
</template>
