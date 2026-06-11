import { reactive, readonly } from 'vue';

let nextId = 1;
const state = reactive({
  toasts: []
});

function push(toast) {
  const id = nextId++;
  const item = {
    id,
    type: toast.type || 'info',
    title: toast.title || '',
    message: toast.message || '',
    timeout: toast.timeout ?? 4500
  };
  state.toasts.push(item);
  if (item.timeout > 0) {
    setTimeout(() => dismiss(id), item.timeout);
  }
  return id;
}

function dismiss(id) {
  const idx = state.toasts.findIndex((t) => t.id === id);
  if (idx >= 0) state.toasts.splice(idx, 1);
}

const toast = {
  info: (message, title = '') => push({ type: 'info', message, title }),
  success: (message, title = 'Éxito') => push({ type: 'success', message, title }),
  error: (message, title = 'Error') => push({ type: 'error', message, title, timeout: 6500 }),
  warning: (message, title = 'Atención') => push({ type: 'warning', message, title })
};

export function useToast() {
  return {
    toast,
    toasts: readonly(state).toasts,
    dismiss
  };
}
