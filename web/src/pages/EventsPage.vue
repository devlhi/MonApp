<template>
  <section class="card">
    <div class="row" style="justify-content:space-between;margin-bottom:14px">
      <div>
        <strong style="display:flex;align-items:center;gap:8px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg> Events Timeline</strong>
        <div class="muted">All status change events across monitors</div>
      </div>
      <div class="row">
        <input class="input" v-model="search" placeholder="Filter events..." style="width:260px" />
        <button class="btn" @click="load">Refresh</button>
        <button class="btn" @click="exportPdf" style="margin-left: 10px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          Export PDF
        </button>
      </div>
    </div>

    <div v-if="filtered.length === 0" class="empty-state">
      <div class="empty-icon"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></div>
      <div class="empty-title">{{ search ? 'No Matching Events' : 'No Events Yet' }}</div>
      <div class="empty-desc">{{ search ? 'Try a different search term.' : 'Events appear when monitors change status (up/down).' }}</div>
    </div>

    <div v-else class="table-wrap">
      <table>
        <thead><tr><th>Time</th><th>Target</th><th>Status</th><th>Message</th></tr></thead>
        <tbody>
          <tr v-for="e in filtered" :key="e.id">
            <td style="white-space:nowrap">{{ new Date(e.ts).toLocaleString() }}</td>
            <td><strong>{{ e.target_name }}</strong></td>
            <td><span class="badge" :class="e.status">{{ e.status }}</span></td>
            <td>{{ e.message }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-if="events.length > 0" class="row" style="margin-top:10px;justify-content:space-between">
      <span class="muted">Showing {{ filtered.length }} of {{ events.length }} events</span>
    </div>
  </section>
</template>

<script setup>
import { onMounted, ref, computed } from 'vue';
import { api } from '../services/api.js';

const events = ref([]);
const search = ref('');

const filtered = computed(() => {
  if (!search.value.trim()) return events.value;
  const q = search.value.toLowerCase();
  return events.value.filter(e =>
    (e.target_name || '').toLowerCase().includes(q) ||
    (e.status || '').toLowerCase().includes(q) ||
    (e.message || '').toLowerCase().includes(q)
  );
});

async function load() {
  events.value = await api('/events?limit=200');
}

function exportPdf() {
  window.print();
}

onMounted(load);
</script>
