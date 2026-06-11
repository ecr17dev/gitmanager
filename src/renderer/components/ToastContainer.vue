<script setup>
import { useToast } from '../composables/useToast.js';
const { toasts, dismiss } = useToast();

const typeClass = {
  info: 'border-sky-500/40 bg-sky-500/10 text-sky-100',
  success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100',
  error: 'border-rose-500/40 bg-rose-500/10 text-rose-100',
  warning: 'border-amber-500/40 bg-amber-500/10 text-amber-100'
};
</script>

<template>
  <div class="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
    <transition-group name="toast">
      <div
        v-for="t in toasts"
        :key="t.id"
        class="border rounded-md px-3 py-2 text-xs shadow-lg backdrop-blur animate-slide-up"
        :class="typeClass[t.type] || typeClass.info"
      >
        <div class="flex items-start gap-2">
          <div class="flex-1">
            <div v-if="t.title" class="font-semibold text-[11px] mb-0.5">{{ t.title }}</div>
            <div class="leading-snug">{{ t.message }}</div>
          </div>
          <button
            class="opacity-50 hover:opacity-100 text-base leading-none"
            @click="dismiss(t.id)"
          >
            ×
          </button>
        </div>
      </div>
    </transition-group>
  </div>
</template>

<style scoped>
.toast-enter-active, .toast-leave-active { transition: all 0.22s ease; }
.toast-enter-from { opacity: 0; transform: translateX(20px); }
.toast-leave-to { opacity: 0; transform: translateX(20px); }
</style>
