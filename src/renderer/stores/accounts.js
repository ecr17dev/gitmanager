import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useAccountsStore = defineStore('accounts', () => {
  const accounts = ref([]);
  const loading = ref(false);
  const error = ref(null);

  const byId = computed(() => {
    const map = new Map();
    for (const a of accounts.value) map.set(a.id, a);
    return map;
  });

  const sortedAccounts = computed(() =>
    [...accounts.value].sort((a, b) => a.id - b.id)
  );

  async function load() {
    loading.value = true;
    error.value = null;
    try {
      const res = await window.api.accounts.list();
      if (res.success) {
        accounts.value = res.data || [];
      } else {
        error.value = res.error?.message || 'Error cargando cuentas';
      }
    } catch (err) {
      error.value = err.message;
    } finally {
      loading.value = false;
    }
  }

  async function add({ profileName, username, email, token }) {
    const res = await window.api.accounts.add({ profileName, username, email, token });
    if (!res.success) {
      const field = res.error?.field;
      const msg = res.error?.message || 'No se pudo crear la cuenta';
      const err = new Error(msg);
      if (field) err.field = field;
      throw err;
    }
    await load();
    return res.data;
  }

  async function remove(id) {
    const res = await window.api.accounts.remove(id);
    if (!res.success) {
      throw new Error(res.error?.message || 'No se pudo eliminar la cuenta');
    }
    await load();
    return res.data;
  }

  return { accounts, loading, error, byId, sortedAccounts, load, add, remove };
});
