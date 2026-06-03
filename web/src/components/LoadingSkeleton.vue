<template>
  <div class="skeleton-wrapper">
    <template v-if="type === 'cards'">
      <div class="grid4">
        <div class="skeleton skeleton-card" v-for="i in count" :key="i"></div>
      </div>
    </template>
    <template v-else-if="type === 'table'">
      <div class="skeleton-table">
        <div class="skeleton skeleton-row" v-for="i in count" :key="i" :style="{ animationDelay: `${i * 0.1}s` }"></div>
      </div>
    </template>
    <template v-else-if="type === 'text'">
      <div class="skeleton-text-group">
        <div class="skeleton skeleton-text w-75" v-for="i in count" :key="i" :style="{ animationDelay: `${i * 0.08}s`, width: `${60 + Math.random() * 30}%` }"></div>
      </div>
    </template>
    <template v-else>
      <div class="skeleton" :style="{ height: height || '80px', borderRadius: 'var(--radius-lg)' }"></div>
    </template>
  </div>
</template>

<script setup>
defineProps({
  type: { type: String, default: 'cards' }, // 'cards' | 'table' | 'text' | 'block'
  count: { type: Number, default: 4 },
  height: { type: String, default: null },
});
</script>

<style scoped>
.skeleton-wrapper { width: 100%; }
.skeleton-table { display: grid; gap: 8px; }
.skeleton-text-group { display: grid; gap: 10px; padding: 4px 0; }
</style>
