<template>
  <!-- Loading Skeleton -->
  <template v-if="loading">
    <LoadingSkeleton type="cards" :count="4" />
    <div class="dashboard-grid">
      <LoadingSkeleton type="table" :count="6" />
      <LoadingSkeleton type="table" :count="4" />
    </div>
  </template>

  <template v-else>
    <!-- KPI Cards -->
    <section class="grid4">
      <div class="card kpi-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;width:100%">
          <div>
            <div class="muted" style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Devices</div>
            <div class="kpi">{{ summary.devices }}</div>
          </div>
          <div class="kpi-icon-wrapper" style="background:rgba(96,93,236,0.1);color:#605dec">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 0 1 10 10c0 2.4-.85 4.6-2.28 6.28l-1.42-1.42A7.95 7.95 0 0 0 20 12c0-4.42-3.58-8-8-8s-8 3.58-8 8c0 1.95.7 3.73 1.86 5.12L4.44 18.54A9.95 9.95 0 0 1 2 12 10 10 0 0 1 12 2z"/><path d="M12 6a6 6 0 0 1 6 6c0 1.48-.54 2.82-1.4 3.87l-1.42-1.42A3.97 3.97 0 0 0 16 12a4 4 0 0 0-8 0c0 .9.3 1.7.8 2.3l-1.4 1.4A5.97 5.97 0 0 1 6 12a6 6 0 0 1 6-6z"/><circle cx="12" cy="12" r="2"/></svg>
          </div>
        </div>
      </div>
      <div class="card kpi-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;width:100%">
          <div>
            <div class="muted" style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Monitors</div>
            <div class="kpi">{{ summary.targets }}</div>
          </div>
          <div class="kpi-icon-wrapper" style="background:rgba(96,93,236,0.1);color:#605dec">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="17" x2="9" y2="9"/><line x1="13" y1="17" x2="13" y2="5"/><line x1="17" y1="17" x2="17" y2="13"/></svg>
          </div>
        </div>
      </div>
      <div class="card kpi-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;width:100%">
          <div>
            <div class="muted" style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">UP STATUS</div>
            <div class="kpi" style="color:var(--ok)">{{ summary.up }}</div>
          </div>
          <div class="kpi-icon-wrapper" style="background:var(--ok-soft);color:var(--ok)">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
        </div>
      </div>
      <div class="card kpi-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;width:100%">
          <div>
            <div class="muted" style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">DOWN STATUS</div>
            <div class="kpi" style="color:var(--down)">{{ summary.down }}</div>
          </div>
          <div class="kpi-icon-wrapper" style="background:var(--down-soft);color:var(--down)">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
        </div>
      </div>
    </section>

    <!-- Real-time Traffic Graphic Widget (Modern UI) -->
    <section class="card traffic-dashboard-widget" style="padding: 24px;">
      <div class="row" style="justify-content:space-between;margin-bottom:24px">
        <div>
          <strong style="font-size:16px;display:flex;align-items:center;gap:8px">
            <span>Real-time Bandwidth Monitor</span>
            <span class="pulse-dot"></span>
          </strong>
          <div class="muted" style="font-size:12px; margin-top: 4px;">
            {{ filterTargetId === 'all' ? 'Agregasi traffic RX/TX secara realtime' : `Monitoring traffic realtime interface ${snmpTargets.find(t => t.id === Number(filterTargetId))?.name || ''}` }}
          </div>
        </div>
        <div class="row" style="gap:12px;flex-wrap:wrap">
          <div v-if="snmpTargets.length > 1" class="row" style="gap:8px">
            <span class="muted" style="font-size:12px">Interface:</span>
            <select class="input" v-model="filterTargetId" @change="onFilterChange" style="width:200px;height:32px;padding:2px 8px;font-size:12px;">
              <option value="all">Semua (Agregat)</option>
              <option v-for="t in snmpTargets" :key="t.id" :value="t.id">{{ t.name }}</option>
            </select>
          </div>
          <button class="btn primary btn-sm" @click="openManageInterfaces" style="font-size: 11px; padding: 0 16px; height: 32px; display: inline-flex; align-items: center; gap: 6px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            Manage Ports
          </button>
        </div>
      </div>
      
      <div class="modern-traffic-grid">
        <!-- Download Card (RX) -->
        <div class="traffic-hero-card rx">
          <div class="traffic-hero-header">
            <div class="traffic-hero-title">
              <div class="icon-circle rx">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>
              </div>
              <span>Incoming (Download)</span>
            </div>
            <div class="traffic-status-badge">Live</div>
          </div>
          <div class="traffic-hero-value">
            <span class="value">{{ formatValueOnly(currentRx) }}</span>
            <span class="unit">{{ formatUnitOnly(currentRx) }}</span>
          </div>
          <div class="sparkline-container">
            <svg viewBox="0 0 300 80" preserveAspectRatio="none">
              <defs>
                <linearGradient id="rxSparkGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#00b69b" stop-opacity="0.25" />
                  <stop offset="100%" stop-color="#00b69b" stop-opacity="0" />
                </linearGradient>
              </defs>
              <path :d="rxAreaPath" fill="url(#rxSparkGrad)" />
              <path :d="rxLinePath" fill="none" stroke="#00b69b" stroke-width="2.5" stroke-linecap="round" />
            </svg>
          </div>
        </div>

        <!-- Upload Card (TX) -->
        <div class="traffic-hero-card tx">
          <div class="traffic-hero-header">
            <div class="traffic-hero-title">
              <div class="icon-circle tx">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
              </div>
              <span>Outgoing (Upload)</span>
            </div>
            <div class="traffic-status-badge">Live</div>
          </div>
          <div class="traffic-hero-value">
            <span class="value">{{ formatValueOnly(currentTx) }}</span>
            <span class="unit">{{ formatUnitOnly(currentTx) }}</span>
          </div>
          <div class="sparkline-container">
            <svg viewBox="0 0 300 80" preserveAspectRatio="none">
              <defs>
                <linearGradient id="txSparkGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#605dec" stop-opacity="0.25" />
                  <stop offset="100%" stop-color="#605dec" stop-opacity="0" />
                </linearGradient>
              </defs>
              <path :d="txAreaPath" fill="url(#txSparkGrad)" />
              <path :d="txLinePath" fill="none" stroke="#605dec" stroke-width="2.5" stroke-linecap="round" />
            </svg>
          </div>
        </div>
      </div>
      
      <!-- Top Active Interfaces -->
      <div class="top-interfaces-panel" v-if="topInterfaces.length > 0" style="margin-top: 8px;">
        <div class="panel-subtitle">Top Active Interfaces (SNMP)</div>
        <div class="top-interfaces-grid">
          <div v-for="iface in topInterfaces" :key="iface.id" class="top-interface-card">
            <div class="iface-meta">
              <strong>{{ iface.name }}</strong>
              <span style="font-variant-numeric:tabular-nums">{{ formatBps(iface.rx_bps + iface.tx_bps) }}</span>
            </div>
            <div class="traffic-progress-bar">
              <div class="progress-fill rx" :style="{ width: getIfaceProgress(iface.rx_bps) }"></div>
              <div class="progress-fill tx" :style="{ width: getIfaceProgress(iface.tx_bps) }"></div>
            </div>
            <div class="iface-sub-stats" style="font-variant-numeric:tabular-nums">
              <span>↓ {{ formatBps(iface.rx_bps) }}</span>
              <span>↑ {{ formatBps(iface.tx_bps) }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <div class="dashboard-grid">
      <!-- Monitors Table -->
      <section class="card">
        <div class="row" style="justify-content:space-between;margin-bottom:12px">
          <strong>Monitors</strong>
          <span class="muted" style="font-size:12px">Realtime overview</span>
        </div>
        <div v-if="targets.length === 0" class="empty-state-small">
          <span style="display:inline-block;margin-bottom:8px;color:var(--muted)">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="17" x2="9" y2="9"/><line x1="13" y1="17" x2="13" y2="5"/><line x1="17" y1="17" x2="17" y2="13"/></svg>
          </span>
          <div>No monitors yet. Add devices and auto-create monitors.</div>
        </div>
        <div v-else class="table-wrap">
          <table>
            <thead>
              <tr><th>Name</th><th>Type</th><th>Status</th><th>RTT</th><th>Uptime</th></tr>
            </thead>
            <tbody>
              <tr v-for="t in targets.slice(0, 15)" :key="t.id">
                <td><strong>{{ t.name }}</strong></td>
                <td><code style="font-size:11px;background:var(--surface-2);padding:2px 6px;border-radius:4px">{{ t.kind }}</code></td>
                <td><span class="badge" :class="statusClass(t.state?.status)">{{ t.state?.status || 'unknown' }}</span></td>
                <td style="font-variant-numeric:tabular-nums">{{ t.state?.rtt_ms != null ? Number(t.state.rtt_ms).toFixed(1) + ' ms' : '-' }}</td>
                <td>
                  <div class="uptime-bar-wrap" v-if="t.sla?.uptime_pct != null">
                    <div class="uptime-bar" :style="{ width: Math.min(100, Number(t.sla.uptime_pct)).toFixed(1) + '%' }" :class="uptimeClass(Number(t.sla.uptime_pct))"></div>
                    <span>{{ Number(t.sla.uptime_pct).toFixed(1) }}%</span>
                  </div>
                  <span v-else class="muted">-</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Events Sidebar -->
      <section class="card">
        <div class="row" style="justify-content:space-between;margin-bottom:12px">
          <strong>Recent Events</strong>
          <router-link to="/events" class="btn-link" style="font-size:12px">View All →</router-link>
        </div>
        <div v-if="recentEvents.length === 0" class="empty-state-small">
          <span style="display:inline-block;margin-bottom:8px;color:var(--muted)">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          </span>
          <div>No events yet</div>
        </div>
        <div v-else class="events-list">
          <div v-for="e in recentEvents" :key="e.id" class="event-card" :class="e.status">
            <div class="event-card-header">
              <span class="badge" :class="e.status" style="font-size:10px">{{ e.status }}</span>
              <span class="event-card-time">{{ timeAgo(e.ts) }}</span>
            </div>
            <div class="event-card-name">{{ e.target_name }}</div>
            <div class="event-card-msg">{{ e.message }}</div>
          </div>
        </div>
      </section>
    </div>

    <!-- Manage SNMP Interfaces Modal -->
    <div v-if="showManageModal" class="modal-overlay" @click.self="closeManageModal">
      <div class="modal-card" style="width: min(540px, 95vw); max-height: 85vh; display: flex; flex-direction: column;">
        <div class="modal-header">
          <h3 style="margin: 0; font-size: 16px; font-weight: 800;">Manage SNMP Interfaces</h3>
          <button class="btn-close" @click="closeManageModal">×</button>
        </div>
        <div class="modal-body" style="flex: 1; overflow-y: auto; padding: 20px;">
          <div class="form-section" style="margin-bottom: 16px;">
            <label>
              <span style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: var(--muted); margin-bottom: 6px; display: block;">Select Device</span>
              <select class="input" :value="selectedDevice?.id || ''" @change="e => selectDeviceForManage(snmpDevices.find(d => d.id === Number(e.target.value)))">
                <option value="">-- Choose SNMP Device --</option>
                <option v-for="d in snmpDevices" :key="d.id" :value="d.id">{{ d.name }} ({{ d.host }})</option>
              </select>
            </label>
          </div>

          <div v-if="loadingInterfaces" class="loading-state" style="text-align: center; padding: 32px 0;">
            <div style="margin: 0 auto 12px; width: 28px; height: 28px; border: 3px solid rgba(96,93,236,0.1); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
            <span class="muted" style="font-size: 13px;">Fetching interfaces via SNMP...</span>
          </div>

          <div v-else-if="modalError" class="alert error" style="margin-top: 10px;">{{ modalError }}</div>

          <div v-else-if="selectedDevice && interfaces.length === 0" class="muted" style="text-align: center; padding: 32px 0; font-size: 13px;">
            No interfaces discovered or SNMP connection failed.
          </div>

          <div v-else-if="selectedDevice" class="manage-interfaces-list" style="display: flex; flex-direction: column; gap: 8px;">
            <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: var(--muted); margin-bottom: 4px;">Interfaces (Toggle to Monitor)</div>
            <div v-for="iface in interfaces" :key="iface.name" class="manage-iface-item" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: var(--surface-2); border: 1px solid var(--line); border-radius: var(--radius); transition: all 0.2s;">
              <div>
                <strong style="font-size: 13px; color: var(--text);">{{ iface.name }}</strong>
                <div style="font-size: 11px; color: var(--muted); margin-top: 2px;">
                  Status: <span :class="iface.running ? 'ok' : 'bad'" style="font-weight: 700;">{{ iface.running ? 'UP' : 'DOWN' }}</span> 
                  <span v-if="iface.speed_bps" style="opacity: 0.6;"> · {{ formatBps(iface.speed_bps) }}</span>
                </div>
              </div>
              <label class="switch-container" style="display: inline-flex; align-items: center; cursor: pointer;">
                <input type="checkbox" :checked="isIfaceMonitored(iface.name)" @change="toggleIfaceMonitor(iface)" style="display: none;" />
                <span class="custom-switch" :class="{ 'active': isIfaceMonitored(iface.name) }" style="position: relative; width: 42px; height: 22px; background: #cbd5e1; border-radius: 999px; transition: all 0.2s; display: inline-block;">
                  <span style="position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; background: #fff; border-radius: 50%; transition: all 0.2s;" :style="isIfaceMonitored(iface.name) ? 'transform: translateX(20px);' : 'transform: translateX(0);'"></span>
                </span>
              </label>
            </div>
          </div>
        </div>
        <div class="modal-footer" style="padding: 14px 20px; border-top: 1px solid var(--line); display: flex; justify-content: flex-end;">
          <button class="btn primary" @click="closeManageModal">Close</button>
        </div>
      </div>
    </div>
  </template>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { api } from '../services/api.js';
import { onSocketEvent } from '../services/socket.js';
import LoadingSkeleton from '../components/LoadingSkeleton.vue';
import { useDarkMode } from '../composables/useDarkMode.js';

const { isDark } = useDarkMode();

const summary = ref({ devices: 0, targets: 0, up: 0, down: 0, unknown: 0 });
const targets = ref([]);
const recentEvents = ref([]);
const loading = ref(true);
const devices = ref([]);
const showManageModal = ref(false);
const selectedDevice = ref(null);
const loadingInterfaces = ref(false);
const interfaces = ref([]);
const modalError = ref('');
const filterTargetId = ref('all');
const maxPoints = 25;
const rxHistory = ref(Array(maxPoints).fill(0));
const txHistory = ref(Array(maxPoints).fill(0));
function onFilterChange() {
  const initRx = currentRx.value;
  const initTx = currentTx.value;
  rxHistory.value = Array.from({ length: maxPoints }, (_, i) => {
    const factor = 0.85 + 0.15 * Math.sin((i / maxPoints) * Math.PI * 2) + Math.random() * 0.05;
    return Math.round(initRx * factor);
  });
  txHistory.value = Array.from({ length: maxPoints }, (_, i) => {
    const factor = 0.80 + 0.18 * Math.cos((i / maxPoints) * Math.PI * 2) + Math.random() * 0.04;
    return Math.round(initTx * factor);
  });
}

const snmpDevices = computed(() => devices.value.filter(d => d.type === 'snmp'));

function openManageInterfaces() {
  showManageModal.value = true;
  selectedDevice.value = null;
  interfaces.value = [];
  modalError.value = '';
}

function closeManageModal() {
  showManageModal.value = false;
  selectedDevice.value = null;
  interfaces.value = [];
  modalError.value = '';
}

async function selectDeviceForManage(device) {
  selectedDevice.value = device;
  if (!device) {
    interfaces.value = [];
    return;
  }
  loadingInterfaces.value = true;
  modalError.value = '';
  interfaces.value = [];
  try {
    const data = await api(`/devices/${device.id}/interfaces`);
    interfaces.value = data.filter(i => i.name);
  } catch (err) {
    modalError.value = `Gagal load interface: ${err.message}`;
  } finally {
    loadingInterfaces.value = false;
  }
}

function isIfaceMonitored(ifaceName) {
  if (!selectedDevice.value) return false;
  return targets.value.some(t => t.kind === 'snmp_iface' && Number(t.device_id) === Number(selectedDevice.value.id) && t.iface === ifaceName);
}

async function loadSummaryOnly() {
  try {
    const [s, t] = await Promise.all([
      api('/summary'),
      api('/targets')
    ]);
    summary.value = s;
    targets.value = t;
  } catch (err) {
    console.error('Failed to reload summary:', err);
  }
}

async function toggleIfaceMonitor(iface) {
  if (!selectedDevice.value) return;
  modalError.value = '';
  const isMonitored = isIfaceMonitored(iface.name);
  try {
    if (isMonitored) {
      const target = targets.value.find(t => t.kind === 'snmp_iface' && Number(t.device_id) === Number(selectedDevice.value.id) && t.iface === iface.name);
      if (target) {
        await api(`/targets/${target.id}`, { method: 'DELETE' });
        targets.value = targets.value.filter(t => t.id !== target.id);
        if (Number(filterTargetId.value) === Number(target.id)) {
          filterTargetId.value = 'all';
          onFilterChange();
        }
      }
    } else {
      const newTarget = await api('/targets', {
        method: 'POST',
        body: JSON.stringify({
          kind: 'snmp_iface',
          name: `${selectedDevice.value.name} ${iface.name}`,
          device_id: selectedDevice.value.id,
          iface: iface.name,
          enabled: true
        })
      });
      targets.value.push(newTarget);
    }
    await loadSummaryOnly();
  } catch (err) {
    modalError.value = err.message;
  }
}

let unsubState = null;
let unsubEvent = null;

// SNMP Traffic Monitor Computeds
const snmpTargets = computed(() => {
  return targets.value.filter(t => t.kind === 'snmp_iface');
});

const currentRx = computed(() => {
  if (filterTargetId.value === 'all') {
    return snmpTargets.value.reduce((sum, t) => sum + Number(t.state?.rx_bps || 0), 0);
  }
  const t = snmpTargets.value.find(x => x.id === Number(filterTargetId.value));
  return t ? Number(t.state?.rx_bps || 0) : 0;
});

const currentTx = computed(() => {
  if (filterTargetId.value === 'all') {
    return snmpTargets.value.reduce((sum, t) => sum + Number(t.state?.tx_bps || 0), 0);
  }
  const t = snmpTargets.value.find(x => x.id === Number(filterTargetId.value));
  return t ? Number(t.state?.tx_bps || 0) : 0;
});

let chartTimer = null;

function sampleTraffic() {
  rxHistory.value.push(currentRx.value);
  if (rxHistory.value.length > maxPoints) rxHistory.value.shift();
  
  txHistory.value.push(currentTx.value);
  if (txHistory.value.length > maxPoints) txHistory.value.shift();
}

const maxSpeed = computed(() => {
  const allPoints = [...rxHistory.value, ...txHistory.value];
  return Math.max(...allPoints, 1000000); // default minimum scale at 1 Mbps
});

function getSvgPath(points, width = 300, height = 80) {
  if (!points || points.length === 0) return '';
  const max = maxSpeed.value;
  const coordinates = points.map((val, index) => {
    const x = (index / (points.length - 1)) * width;
    const y = height - ((val / max) * (height * 0.8)) - 5; // Leave 5px padding at bottom, scale to 80% height
    return { x, y };
  });
  
  let path = `M ${coordinates[0].x} ${coordinates[0].y}`;
  for (let i = 0; i < coordinates.length - 1; i++) {
    const curr = coordinates[i];
    const next = coordinates[i + 1];
    const cpX1 = curr.x + (next.x - curr.x) / 3;
    const cpY1 = curr.y;
    const cpX2 = curr.x + 2 * (next.x - curr.x) / 3;
    const cpY2 = next.y;
    path += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${next.x} ${next.y}`;
  }
  return path;
}

function getAreaPath(points, width = 300, height = 80) {
  const linePath = getSvgPath(points, width, height);
  if (!linePath) return '';
  return `${linePath} L ${width} ${height} L 0 ${height} Z`;
}

const rxLinePath = computed(() => getSvgPath(rxHistory.value));
const rxAreaPath = computed(() => getAreaPath(rxHistory.value));
const txLinePath = computed(() => getSvgPath(txHistory.value));
const txAreaPath = computed(() => getAreaPath(txHistory.value));

const topInterfaces = computed(() => {
  return snmpTargets.value
    .map(t => {
      const rx = Number(t.state?.rx_bps || 0);
      const tx = Number(t.state?.tx_bps || 0);
      return {
        id: t.id,
        name: t.name,
        rx_bps: rx,
        tx_bps: tx,
        total: rx + tx
      };
    })
    .filter(t => t.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 3);
});

function getIfaceProgress(val) {
  const max = Math.max(...topInterfaces.value.map(t => Math.max(t.rx_bps, t.tx_bps)), 1);
  return `${(val / max) * 100}%`;
}

function formatBps(value) {
  const bps = Number(value || 0);
  if (bps >= 1_000_000_000) return `${(bps / 1_000_000_000).toFixed(2)} Gbps`;
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(2)} Mbps`;
  if (bps >= 1_000) return `${(bps / 1_000).toFixed(1)} Kbps`;
  return `${bps.toFixed(0)} bps`;
}

function formatValueOnly(value) {
  const bps = Number(value || 0);
  if (bps >= 1_000_000_000) return (bps / 1_000_000_000).toFixed(2);
  if (bps >= 1_000_000) return (bps / 1_000_000).toFixed(2);
  if (bps >= 1_000) return (bps / 1_000).toFixed(1);
  return bps.toFixed(0);
}

function formatUnitOnly(value) {
  const bps = Number(value || 0);
  if (bps >= 1_000_000_000) return `Gbps`;
  if (bps >= 1_000_000) return `Mbps`;
  if (bps >= 1_000) return `Kbps`;
  return `bps`;
}

function statusClass(s) {
  if (s === 'up') return 'up';
  if (s === 'down') return 'down';
  return 'unknown';
}

// Uptime metrics
function uptimeClass(pct) {
  if (pct >= 99.5) return 'excellent';
  if (pct >= 99) return 'good';
  if (pct >= 95) return 'warning';
  return 'critical';
}

function timeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

async function load() {
  try {
    const [s, t, e, d] = await Promise.all([
      api('/summary'),
      api('/targets'),
      api('/events?limit=8'),
      api('/devices'),
    ]);
    summary.value = s;
    targets.value = t;
    recentEvents.value = e;
    devices.value = d;
    
    // Seed history arrays with realistic organic wave patterns around current live rates
    const initRx = currentRx.value;
    const initTx = currentTx.value;
    rxHistory.value = Array.from({ length: maxPoints }, (_, i) => {
      const factor = 0.85 + 0.15 * Math.sin((i / maxPoints) * Math.PI * 2) + Math.random() * 0.05;
      return Math.round(initRx * factor);
    });
    txHistory.value = Array.from({ length: maxPoints }, (_, i) => {
      const factor = 0.80 + 0.18 * Math.cos((i / maxPoints) * Math.PI * 2) + Math.random() * 0.04;
      return Math.round(initTx * factor);
    });
  } catch (err) {
    console.error('Dashboard load error:', err);
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  await load();
  // Start traffic sampler timer
  chartTimer = setInterval(sampleTraffic, 3000);
  
  // Subscribe to socket events using shared socket
  unsubState = onSocketEvent('state', (s) => {
    const idx = targets.value.findIndex((x) => x.id === s.target_id);
    if (idx >= 0) targets.value[idx].state = s;
  });
  // Debounce event-triggered reload — avoid rapid-fire API calls during incidents
  let eventDebounce = null;
  unsubEvent = onSocketEvent('event', () => {
    clearTimeout(eventDebounce);
    eventDebounce = setTimeout(() => load(), 2000);
  });
});

onUnmounted(() => {
  // Clear charts interval
  if (chartTimer) clearInterval(chartTimer);
  
  // Unsubscribe from events (does NOT disconnect socket)
  if (unsubState) unsubState();
  if (unsubEvent) unsubEvent();
});
</script>
