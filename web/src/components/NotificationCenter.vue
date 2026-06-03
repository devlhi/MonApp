<template>
  <div class="notif-center" ref="wrapper">
    <button class="notif-bell" @click="open = !open" :class="{ 'has-unread': unread > 0 }">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
      <span v-if="unread > 0" class="notif-badge">{{ unread > 9 ? '9+' : unread }}</span>
    </button>
    <Transition name="dropdown">
      <div v-if="open" class="notif-dropdown">
        <div class="notif-header">
          <strong>Notifications</strong>
          <button v-if="items.length" class="btn-link" @click="clearAll">Clear all</button>
        </div>
        <div v-if="items.length === 0" class="notif-empty">
          <div style="margin-bottom:8px"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></div>
          <div>No notifications yet</div>
        </div>
        <div v-else class="notif-list">
          <div v-for="n in items" :key="n.id" class="notif-item" :class="n.type">
            <span class="notif-dot" :class="n.type"></span>
            <div class="notif-content">
              <div class="notif-title">{{ n.title }}</div>
              <div class="notif-desc">{{ n.message }}</div>
              <div class="notif-time">{{ timeAgo(n.ts) }}</div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { onSocketEvent } from '../services/socket.js';

const open = ref(false);
const items = ref([]);
let notifId = 0;
let unsubEvent = null;

const unread = computed(() => items.value.length);

function addNotif(title, message, type = 'info') {
  items.value.unshift({ id: ++notifId, title, message, type, ts: Date.now() });
  if (items.value.length > 30) items.value.pop();
}

function clearAll() { items.value = []; }

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

// Close on outside click
const wrapper = ref(null);
function handleClickOutside(e) {
  if (wrapper.value && !wrapper.value.contains(e.target)) open.value = false;
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
  // Subscribe to events using shared socket (no duplicate connection)
  unsubEvent = onSocketEvent('event', (ev) => {
    const type = ev.status === 'down' ? 'error' : ev.status === 'up' ? 'success' : 'warning';
    addNotif(`${ev.target_name} ${ev.status}`, ev.message || `Status changed to ${ev.status}`, type);
  });
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
  // Unsubscribe from socket event (does NOT disconnect socket)
  if (unsubEvent) unsubEvent();
});
</script>
