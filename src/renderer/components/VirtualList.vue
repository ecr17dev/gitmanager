<script setup>
import { computed, ref, onMounted, onBeforeUnmount, nextTick } from 'vue';

const props = defineProps({
  items: { type: Array, required: true },
  itemHeight: { type: Number, default: 22 },
  overscan: { type: Number, default: 8 },
  buffer: { type: Number, default: 200 }
});

const containerRef = ref(null);
const scrollTop = ref(0);
const viewportHeight = ref(300);

let raf = null;

function onScroll() {
  if (raf) cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() => {
    if (containerRef.value) {
      scrollTop.value = containerRef.value.scrollTop;
    }
  });
}

let ro = null;
onMounted(() => {
  nextTick(() => {
    if (containerRef.value) {
      viewportHeight.value = containerRef.value.clientHeight;
      ro = new ResizeObserver((entries) => {
        for (const e of entries) {
          viewportHeight.value = e.contentRect.height;
        }
      });
      ro.observe(containerRef.value);
    }
  });
});

onBeforeUnmount(() => {
  if (ro) ro.disconnect();
  if (raf) cancelAnimationFrame(raf);
});

const totalHeight = computed(() => props.items.length * props.itemHeight);

const startIndex = computed(() => {
  const i = Math.floor(scrollTop.value / props.itemHeight) - props.overscan;
  return Math.max(0, i);
});

const endIndex = computed(() => {
  const i = Math.ceil((scrollTop.value + viewportHeight.value) / props.itemHeight) + props.overscan;
  return Math.min(props.items.length, i);
});

const visibleItems = computed(() =>
  props.items.slice(startIndex.value, endIndex.value).map((item, idx) => ({
    item,
    index: startIndex.value + idx
  }))
);

const offsetY = computed(() => startIndex.value * props.itemHeight);
</script>

<template>
  <div
    ref="containerRef"
    class="relative overflow-auto"
    @scroll="onScroll"
  >
    <div :style="{ height: totalHeight + 'px', position: 'relative' }">
      <div :style="{ transform: `translateY(${offsetY}px)`, position: 'absolute', top: 0, left: 0, right: 0 }">
        <div
          v-for="{ item, index } in visibleItems"
          :key="index"
          :style="{ height: itemHeight + 'px' }"
        >
          <slot :item="item" :index="index" />
        </div>
      </div>
    </div>
  </div>
</template>
