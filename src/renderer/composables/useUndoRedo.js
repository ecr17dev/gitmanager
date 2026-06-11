import { ref, computed, watch } from 'vue';

const MAX_HISTORY = 50;
const DEBOUNCE_MS = 400;

export function useUndoRedo(initial = { title: '', body: '' }) {
  const state = ref({ ...initial });
  const past = ref([]);
  const future = ref([]);
  let lastSnapshotAt = 0;
  let timer = null;

  function snapshot(force = false) {
    const now = Date.now();
    if (!force && now - lastSnapshotAt < DEBOUNCE_MS) return;
    lastSnapshotAt = now;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    const last = past.value[past.value.length - 1];
    if (last && last.title === state.value.title && last.body === state.value.body) return;
    past.value.push({ ...state.value });
    if (past.value.length > MAX_HISTORY) past.value.shift();
    future.value = [];
  }

  function scheduleSnapshot() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      snapshot(true);
    }, DEBOUNCE_MS);
  }

  watch(
    () => ({ ...state.value }),
    () => {
      scheduleSnapshot();
    },
    { deep: false }
  );

  function setTitle(v) {
    state.value.title = v;
  }
  function setBody(v) {
    state.value.body = v;
  }
  function set(newState) {
    snapshot();
    state.value = { ...newState };
  }
  function reset() {
    snapshot();
    state.value = { ...initial };
  }
  function undo() {
    if (past.value.length === 0) return false;
    const prev = past.value.pop();
    future.value.push({ ...state.value });
    state.value = prev;
    return true;
  }
  function redo() {
    if (future.value.length === 0) return false;
    const next = future.value.pop();
    past.value.push({ ...state.value });
    state.value = next;
    return true;
  }
  function clear() {
    past.value = [];
    future.value = [];
    state.value = { ...initial };
  }

  const canUndo = computed(() => past.value.length > 0);
  const canRedo = computed(() => future.value.length > 0);
  const title = computed({
    get: () => state.value.title,
    set: setTitle
  });
  const body = computed({
    get: () => state.value.body,
    set: setBody
  });

  return {
    title,
    body,
    canUndo,
    canRedo,
    set,
    reset,
    clear,
    undo,
    redo,
    snapshot: () => snapshot(true)
  };
}
