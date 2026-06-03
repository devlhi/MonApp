<template>
  <div class="audit-page">
    <!-- Action Buttons -->
    <div class="row" style="justify-content:flex-end">
      <button class="btn" @click="exportCSV" style="display:inline-flex;align-items:center;gap:6px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Export CSV</button>
      <button class="btn" @click="fetchLogs" style="display:inline-flex;align-items:center;gap:6px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg> Refresh</button>
    </div>

    <!-- Filters -->
    <div class="card audit-filters">
      <div class="audit-filter-grid">
        <label>
          <span>Search</span>
          <input class="input" v-model="search" placeholder="Search actions, details..." @input="debouncedFetch" />
        </label>
        <label>
          <span>Action</span>
          <select v-model="actionFilter" @change="fetchLogs">
            <option value="">All Actions</option>
            <option v-for="a in actions" :key="a" :value="a">{{ formatAction(a) }}</option>
          </select>
        </label>
        <label>
          <span>Entity</span>
          <select v-model="entityFilter" @change="fetchLogs">
            <option value="">All Entities</option>
            <option value="device">Device</option>
            <option value="target">Target</option>
            <option value="settings">Settings</option>
          </select>
        </label>
      </div>
      <div class="audit-summary">
        <span>{{ total }} records found</span>
        <span v-if="actionFilter || entityFilter || search" class="btn-link" @click="clearFilters">Clear filters</span>
      </div>
    </div>

    <!-- Table -->
    <div class="card" style="padding: 0">
      <div class="table-wrap" v-if="logs.length">
        <table>
          <thead>
            <tr>
              <th style="width: 160px">Time</th>
              <th style="width: 100px">User</th>
              <th style="width: 140px">Action</th>
              <th style="width: 90px">Entity</th>
              <th>Details</th>
              <th style="width: 120px">IP Address</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="log in logs" :key="log.id">
              <td><span class="audit-time">{{ formatTime(log.ts) }}</span></td>
              <td><span class="audit-user">{{ log.user_name || '—' }}</span></td>
              <td><span class="badge" :class="actionBadgeClass(log.action)">{{ formatAction(log.action) }}</span></td>
              <td><span class="muted">{{ log.entity || '—' }}</span></td>
              <td><span class="audit-detail">{{ log.detail || '—' }}</span></td>
              <td><code class="audit-ip">{{ log.ip || '—' }}</code></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="empty-state">
        <div class="empty-icon"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg></div>
        <div class="empty-title">No audit records</div>
        <div class="empty-desc">System activities will appear here as they occur</div>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="total > limit" class="audit-pagination">
      <button class="btn" :disabled="offset === 0" @click="prevPage">← Previous</button>
      <span class="muted">Showing {{ offset + 1 }}–{{ Math.min(offset + limit, total) }} of {{ total }}</span>
      <button class="btn" :disabled="offset + limit >= total" @click="nextPage">Next →</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { api } from '../services/api.js';

const logs = ref([]);
const actions = ref([]);
const total = ref(0);
const search = ref('');
const actionFilter = ref('');
const entityFilter = ref('');
const limit = 100;
const offset = ref(0);

let debounceTimer = null;
function debouncedFetch() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(fetchLogs, 300);
}

async function fetchLogs() {
  const params = new URLSearchParams({ limit, offset: offset.value });
  if (search.value) params.set('search', search.value);
  if (actionFilter.value) params.set('action', actionFilter.value);
  if (entityFilter.value) params.set('entity', entityFilter.value);
  try {
    const data = await api(`/audit-log?${params}`);
    logs.value = data.rows || [];
    total.value = data.total || 0;
  } catch (e) {
    console.error('Failed to fetch audit logs', e);
  }
}

async function fetchActions() {
  try {
    actions.value = await api('/audit-log/actions');
  } catch {}
}

function clearFilters() {
  search.value = '';
  actionFilter.value = '';
  entityFilter.value = '';
  offset.value = 0;
  fetchLogs();
}

function prevPage() {
  offset.value = Math.max(0, offset.value - limit);
  fetchLogs();
}
function nextPage() {
  offset.value += limit;
  fetchLogs();
}

function formatTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts + (ts.endsWith('Z') ? '' : 'Z'));
  return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatAction(action) {
  if (!action) return '—';
  return action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function actionBadgeClass(action) {
  if (!action) return '';
  if (action.includes('login_failed') || action.includes('delete')) return 'down';
  if (action.includes('login') || action.includes('create')) return 'up';
  if (action.includes('update') || action.includes('settings')) return 'warn';
  return 'unknown';
}

function exportCSV() {
  if (!logs.value.length) return;
  const headers = ['Time', 'User', 'Action', 'Entity', 'Entity ID', 'Details', 'IP'];
  const rows = logs.value.map(l => [
    l.ts, l.user_name, l.action, l.entity, l.entity_id, `"${(l.detail || '').replace(/"/g, '""')}"`, l.ip
  ]);
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

onMounted(() => {
  fetchLogs();
  fetchActions();
});
</script>
