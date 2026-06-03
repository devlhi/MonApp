<template>
  <Teleport to="body">
    <div class="toast-container">
      <TransitionGroup name="toast">
        <div v-for="t in toasts" :key="t.id" class="toast" :class="t.type" @click="removeToast(t.id)">
          <span class="toast-icon">{{ icon(t.type) }}</span>
          <span class="toast-msg">{{ t.message }}</span>
          <span class="toast-close">×</span>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup>
import { useToast } from '../composables/useToast.js';
const { toasts, removeToast } = useToast();

function icon(type) {
  return { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' }[type] || 'ℹ';
}
</script>
