<template>
  <section class="card">
    <div class="row" style="justify-content:space-between;margin-bottom:14px">
      <div>
        <strong>SLA Report</strong>
        <div class="muted">Uptime & performance per monitor over selected time window</div>
      </div>
      <div class="row">
        <span class="muted">Window:</span>
        <select class="input" v-model.number="hours" style="width:100px" @change="load">
          <option :value="1">1h</option>
          <option :value="6">6h</option>
          <option :value="24">24h</option>
          <option :value="168">7d</option>
        </select>
        <button class="btn" @click="exportPdf" style="margin-left: 10px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          Export PDF
        </button>
      </div>
    </div>

    <!-- Summary cards -->
    <div class="grid3" v-if="rows.length > 0" style="margin-bottom:20px">
      <div class="card kpi-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;width:100%">
          <div>
            <div class="muted" style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Avg Uptime</div>
            <div class="kpi" style="color:var(--ok)">{{ avgUptime }}%</div>
          </div>
          <div class="kpi-icon-wrapper" style="background:var(--ok-soft);color:var(--ok)">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
          </div>
        </div>
      </div>
      <div class="card kpi-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;width:100%">
          <div>
            <div class="muted" style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Monitors Down</div>
            <div class="kpi" :style="{ color: downCount > 0 ? 'var(--warn)' : 'var(--ok)' }">{{ downCount }}</div>
          </div>
          <div class="kpi-icon-wrapper" :style="downCount > 0 ? 'background:var(--warn-soft);color:var(--warn)' : 'background:var(--ok-soft);color:var(--ok)'">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
        </div>
      </div>
      <div class="card kpi-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;width:100%">
          <div>
            <div class="muted" style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Total Samples</div>
            <div class="kpi" style="color:var(--accent)">{{ totalSamples.toLocaleString() }}</div>
          </div>
          <div class="kpi-icon-wrapper" style="background:var(--accent-soft);color:var(--accent)">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="17" x2="9" y2="9"/><line x1="13" y1="17" x2="13" y2="5"/><line x1="17" y1="17" x2="17" y2="13"/></svg>
          </div>
        </div>
      </div>
    </div>

    <div v-if="rows.length === 0" class="empty-state">
      <div class="empty-icon" style="color:var(--muted)">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
      </div>
      <div class="empty-title">No SLA Data Yet</div>
      <div class="empty-desc">SLA reports will appear once monitors start collecting samples.</div>
    </div>

    <div v-else class="table-wrap">
      <table>
        <thead>
          <tr><th>Name</th><th>Kind</th><th>Uptime</th><th style="min-width:180px">Health</th><th>Avg RTT</th><th>Avg Loss</th><th>Samples</th></tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.id">
            <td><strong>{{ r.name }}</strong></td>
            <td><code>{{ r.kind }}</code></td>
            <td :style="{ color: uptimeColor(r.sla?.uptime_pct) }">
              <strong>{{ r.sla?.uptime_pct != null ? Number(r.sla.uptime_pct).toFixed(2) + '%' : '-' }}</strong>
            </td>
            <td>
              <div class="uptime-bar-wrap" v-if="r.sla?.uptime_pct != null">
                <div class="uptime-bar" :style="{ width: Math.min(100, Number(r.sla.uptime_pct)).toFixed(1) + '%' }" :class="uptimeClass(Number(r.sla.uptime_pct))"></div>
              </div>
              <span v-else class="muted">-</span>
            </td>
            <td>{{ r.sla?.avg_rtt_ms != null ? Number(r.sla.avg_rtt_ms).toFixed(1) + ' ms' : '-' }}</td>
            <td :style="{ color: r.sla?.avg_loss_pct > 5 ? 'var(--down)' : 'inherit' }">
              {{ r.sla?.avg_loss_pct != null ? Number(r.sla.avg_loss_pct).toFixed(2) + '%' : '-' }}
            </td>
            <td>{{ (r.sla?.samples ?? 0).toLocaleString() }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup>
import { onMounted, ref, computed } from 'vue';
import { api } from '../services/api.js';

const rows = ref([]);
const hours = ref(24);

const avgUptime = computed(() => {
  const vals = rows.value.filter(r => r.sla?.uptime_pct != null).map(r => Number(r.sla.uptime_pct));
  if (!vals.length) return '-';
  return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2);
});

const downCount = computed(() => rows.value.filter(r => r.sla?.uptime_pct != null && Number(r.sla.uptime_pct) < 99).length);

const totalSamples = computed(() => rows.value.reduce((acc, r) => acc + (r.sla?.samples || 0), 0));

function uptimeClass(pct) {
  if (pct >= 99.5) return 'excellent';
  if (pct >= 99) return 'good';
  if (pct >= 95) return 'warning';
  return 'critical';
}

function uptimeColor(pct) {
  if (pct == null) return 'inherit';
  const n = Number(pct);
  if (n >= 99.5) return 'var(--ok)';
  if (n >= 99) return '#059669';
  if (n >= 95) return 'var(--warn)';
  return 'var(--down)';
}

async function load() {
  rows.value = await api(`/sla?hours=${hours.value}`);
}

function exportPdf() {
  window.print();
}

onMounted(load);
</script>
