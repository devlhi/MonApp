<template>
  <section class="card map-shell" :class="{ 'map-fullscreen': isFullscreen }">
    <div class="row" style="justify-content:space-between;margin-bottom:14px">
      <div>
        <strong>Network Map</strong>
        <div class="muted">Visual lokasi perangkat, status live, dan ringkasan site.</div>
      </div>
      <div class="row">
        <span class="legend"><i class="dot up"></i>Up</span>
        <span class="legend"><i class="dot down"></i>Down</span>
        <span class="legend"><i class="dot unknown"></i>Unknown</span>
        <span class="legend"><i class="cable-demo"></i>Traffic cable</span>
        <button v-if="isAdmin" class="btn primary" @click="openAddMonitorModal">+ Add Monitor</button>
        <button class="btn" @click="load">Refresh</button>
      </div>
    </div>

    <div class="map-layout" :class="{ 'panel-collapsed': isPanelCollapsed }">
      <aside v-show="!isPanelCollapsed" class="map-panel">
        <div class="panel-title">Perangkat di Peta</div>
        <div class="map-stats">
          <div><b>{{ markers.length }}</b><span>Total</span></div>
          <div><b class="ok">{{ countByStatus.up }}</b><span>Up</span></div>
          <div><b>{{ links.length }}</b><span>Kabel</span></div>
        </div>
          <div v-if="selectedDevice && addedInterfacesForSelectedDevice.length > 0" class="interface-filter">
            <div class="filter-header">
              <span>Filter Interface</span>
              <button class="btn-link" @click="toggleAllInterfaces">{{ isAllSelected ? 'Unselect All' : 'Select All' }}</button>
            </div>
            <div class="filter-list">
              <label v-for="iface in addedInterfacesForSelectedDevice" :key="iface.name" class="filter-item">
                <input type="checkbox" :checked="isInterfaceSelected(iface.name)" @change="toggleInterface(iface.name)" />
                <span>{{ iface.name }}</span>
                <small>{{ iface.status }}</small>
              </label>
            </div>
          </div>
          <div class="event-log-grid" style="margin-top: 16px; background: var(--surface-2); padding: 12px; border-radius: 8px; border: 1px solid var(--line);">
            <div style="font-weight: bold; margin-bottom: 12px; font-size: 13px; display: flex; align-items: center; justify-content: space-between;">
              <span>Trigger Up/Down Logs</span>
              <span style="font-size: 11px; background: var(--primary); color: white; padding: 2px 6px; border-radius: 10px;">{{ selectedDeviceEvents.length }}</span>
            </div>
            <div style="max-height: 400px; overflow-y: auto; padding-right: 4px;">
              <div v-if="!selectedDeviceEvents.length" class="muted sfp-empty" style="text-align: center; padding: 20px 0;">Belum ada riwayat trigger untuk device ini.</div>
              <div v-for="ev in selectedDeviceEvents" :key="ev.id" class="event-log-item" style="padding: 10px 0; border-bottom: 1px solid var(--line); font-size: 12px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                  <span style="font-weight: bold; color: var(--text);">{{ ev.target_name || selectedDevice?.name }}</span>
                  <span style="color: var(--muted); font-size: 11px;">{{ formatTime(ev.ts) }}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span :class="['event-badge', ev.status]" style="padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 10px; text-transform: uppercase;" :style="ev.status === 'up' ? 'background: #10b98120; color: #10b981;' : ev.status === 'down' ? 'background: #ef444420; color: #ef4444;' : 'background: #f59e0b20; color: #f59e0b;'">{{ ev.status }}</span>
                  <span style="color: var(--muted);">{{ ev.message || '-' }}</span>
                </div>
              </div>
            </div>
          </div>
        <div v-if="isAdmin" class="link-builder">
          <div class="panel-title">Hubungkan Device</div>
          <select class="input" v-model.number="linkForm.from_device_id"><option :value="null">Device A</option><option v-for="m in markers" :key="m.id" :value="m.id">{{ m.name }}</option></select>
          <select class="input" v-model.number="linkForm.to_device_id"><option :value="null">Device B</option><option v-for="m in markers" :key="m.id" :value="m.id">{{ m.name }}</option></select>
          <input class="input" v-model="linkForm.name" placeholder="Nama link/kabel" />
          <select class="input" v-model="linkForm.cable_type"><option value="fiber">Fiber</option><option value="utp">UTP</option><option value="wireless">Wireless</option></select>
          <button class="btn primary" @click="createLink">Buat Kabel Line</button>
          <div v-if="linkError" class="alert error">{{ linkError }}</div>
        </div>
        <div class="site-list">
          <button
            v-for="m in markers"
            :key="m.id"
            class="site-item"
            :class="[m.status, selectedDevice?.id === m.id ? 'selected' : '']"
            @click="focusMarker(m)"
          >
            <span class="site-dot"></span>
            <span>
              <b>{{ m.name }}</b>
              <small>{{ m.site || m.host }} · {{ m.status }} · {{ formatBps(deviceTraffic(m)) }}</small>
            </span>
          </button>
          <div v-if="!markers.length" class="muted empty-map">Belum ada device dengan latitude/longitude.</div>
        </div>
      </aside>
      
      <!-- Map Container & Floating Controls -->
      <div style="position: relative; flex: 1; display: flex; flex-direction: column;">
        <div id="map" class="map" style="flex: 1; height: 100%;"></div>
        
        <!-- Floating Map controls overlay -->
        <div class="map-floating-controls">
          <button class="btn float-ctrl-btn" @click="isPanelCollapsed = !isPanelCollapsed" :title="isPanelCollapsed ? 'Show Details Panel' : 'Hide Details Panel'">
            {{ isPanelCollapsed ? 'Show Panel' : 'Hide Panel' }}
          </button>
          <button class="btn float-ctrl-btn" @click="toggleFullscreen" :title="isFullscreen ? 'Exit Fullscreen' : 'Fullscreen NOC Mode'">
            {{ isFullscreen ? 'Exit NOC' : 'NOC Mode' }}
          </button>
          <select class="input float-ctrl-btn" v-model="mapScale" style="width: auto; height: 32px; padding: 0 8px; line-height: 1;" title="Change Marker/Label Size">
            <option value="0.75">Small (0.75x)</option>
            <option value="1.0">Normal (1.0x)</option>
            <option value="1.25">Large (1.25x)</option>
            <option value="1.5">Huge (1.5x)</option>
          </select>
          <select class="input float-ctrl-btn" v-model="markerDisplayMode" style="width: auto; height: 32px; padding: 0 8px; line-height: 1; font-weight: bold; color: var(--primary);" title="Data Display on Marker">
            <option value="logo">Display: Logo</option>
            <option value="data">Display: Data (CPU/Traffic)</option>
          </select>
          <select class="input float-ctrl-btn" v-model="activeLayer" style="width: auto; height: 32px; padding: 0 8px; line-height: 1;">
            <option value="auto">Auto Tile</option>
            <option value="dark">Dark Matter</option>
            <option value="light">Light Matter</option>
            <option value="osm">OpenStreetMap</option>
            <option value="satellite">Satellite</option>
          </select>
          <button class="btn float-ctrl-btn" @click="toggleMapLock" :class="isMapLocked ? 'primary' : ''" :style="isMapLocked ? 'background: #ef4444; color: white; border-color: #ef4444;' : ''" title="Kunci Area Map">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            {{ isMapLocked ? 'Area Dikunci' : 'Kunci Area' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Monitor Modal -->
    <div v-if="showMonitorModal" class="modal-overlay" @click.self="closeMonitorModal">
      <div class="modal-card">
        <div class="modal-header">
          <h3>{{ monitorStep === 1 ? 'Add Monitor' : 'Create Cable Lines?' }}</h3>
          <button class="btn-close" @click="closeMonitorModal">×</button>
        </div>
        <div class="modal-body">
          <!-- Step 1: Select Device + Interface -->
          <div v-if="monitorStep === 1">
            <div v-if="createdMonitors.length > 0" class="created-monitors-list">
              <div class="list-title">Added Monitors ({{ createdMonitors.length }})</div>
              <div v-for="(m, idx) in createdMonitors" :key="idx" class="created-monitor-item">
                <span class="monitor-badge">{{ idx + 1 }}</span>
                <div class="monitor-info">
                  <strong>{{ m.device_name }}</strong>
                  <small>{{ m.interface_name }}</small>
                </div>
              </div>
            </div>
            
            <div class="form-section">
              <label>
                <span>Select Device</span>
                <select class="input" v-model.number="monitorDevice" @change="selectMonitorDevice(monitorDevice)">
                  <option :value="null">-- Choose Device --</option>
                  <option v-for="m in markers" :key="m.id" :value="m.id">{{ m.name }} ({{ m.host }})</option>
                </select>
              </label>
            </div>

            <div v-if="monitorLoading" class="loading-state">Loading interfaces...</div>
            <div v-else-if="monitorError" class="alert error">{{ monitorError }}</div>
            <div v-else-if="availableInterfaces.length > 0" class="form-section">
              <label>
                <span>Select Interface</span>
                <select class="input" v-model="monitorInterface">
                  <option :value="null">-- Choose Interface --</option>
                  <option v-for="iface in availableInterfaces" :key="iface.name" :value="iface.name">
                    {{ iface.name }} ({{ iface.type || 'ethernet' }}) - {{ iface.running ? 'running' : 'down' }}
                  </option>
                </select>
              </label>
              <button class="btn primary" @click="addMonitorTarget" :disabled="!monitorInterface || monitorLoading">
                + Add This Monitor
              </button>
            </div>
          </div>

          <!-- Step 2: Cable Line Confirmation -->
          <div v-if="monitorStep === 2">
            <div class="cable-confirmation">
              <p>Anda telah menambahkan <strong>{{ createdMonitors.length }} monitor</strong>.</p>
              <p>Apakah Anda ingin membuat <strong>cable line</strong> untuk menghubungkan device-device ini?</p>
              <div class="created-monitors-list">
                <div v-for="(m, idx) in createdMonitors" :key="idx" class="created-monitor-item">
                  <span class="monitor-badge">{{ idx + 1 }}</span>
                  <div class="monitor-info">
                    <strong>{{ m.device_name }}</strong>
                    <small>{{ m.interface_name }}</small>
                  </div>
                </div>
              </div>
              <div v-if="monitorError" class="alert error">{{ monitorError }}</div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button v-if="monitorStep === 1" class="btn" @click="closeMonitorModal">Cancel</button>
          <button v-if="monitorStep === 1 && createdMonitors.length > 0" class="btn primary" @click="proceedToCableStep">
            Done ({{ createdMonitors.length }} monitor{{ createdMonitors.length > 1 ? 's' : '' }})
          </button>
          
          <button v-if="monitorStep === 2" class="btn" @click="skipCableLines" :disabled="monitorLoading">
            Skip (No Cable)
          </button>
          <button v-if="monitorStep === 2" class="btn primary" @click="createCableLines" :disabled="monitorLoading">
            {{ monitorLoading ? 'Creating...' : 'Yes, Create Cable Lines' }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '../services/api.js';
import { onSocketEvent } from '../services/socket.js';
import { useDarkMode } from '../composables/useDarkMode.js';
import { getUser } from '../services/auth.js';

const { isDark } = useDarkMode();
const currentUser = ref(getUser());
const isAdmin = computed(() => currentUser.value?.role === 'admin');
const isPanelCollapsed = ref(false);
const isFullscreen = ref(false);
const activeLayer = ref('auto');
const markerDisplayMode = ref(localStorage.getItem('appmon_marker_display') || 'logo');
const mapScale = ref(localStorage.getItem('appmon_map_scale') || '1.0');
const isMapLocked = ref(localStorage.getItem('appmon_map_locked') === 'true');
let currentTileLayer = null;

watch(markerDisplayMode, (val) => {
  localStorage.setItem('appmon_marker_display', val);
  if (markers.value.length) load(); // re-render markers
});

watch(mapScale, (val) => {
  localStorage.setItem('appmon_map_scale', val);
  document.documentElement.style.setProperty('--map-scale', val);
}, { immediate: true });

let map;
let markerLayer;
let cableLayer;
let tooltipLayer;
let interfaceLayer;
const markerRefs = new Map();
const tooltipRefs = new Map();
const interfaceRefs = new Map(); // Map<target_id, marker>
const interfacePositions = ref(new Map()); // Map<target_id, {lat, lng}>
const markers = ref([]);
const links = ref([]);
const selectedDevice = ref(null);
const selectedDeviceEvents = ref([]);
const linkError = ref('');
const linkForm = ref({ from_device_id: null, to_device_id: null, name: '', cable_type: 'fiber' });
const interfaceFilter = ref(new Map()); // Map<deviceId, Set<interfaceName>>
const showMonitorModal = ref(false);
const monitorStep = ref(1); // 1 = pilih device+interface, 2 = cable line confirmation
const monitorDevice = ref(null);
const monitorInterface = ref(null);
const availableInterfaces = ref([]);
const monitorLoading = ref(false);
const monitorError = ref('');
const createdMonitors = ref([]); // [{device_id, device_name, interface_name, target_id}]
let unsubState = null;
let unsubEvent = null;
let unsubDeviceStatus = null;
let refreshTimer = null;
let firstLoad = true;

const totalTraffic = computed(() => links.value.reduce((sum, link) => sum + Number(link.total_bps || 0), 0));

const selectedTraffic = computed(() => {
  if (!selectedDevice.value) return { rx_bps: 0, tx_bps: 0, interfaces: 0 };
  const filter = interfaceFilter.value.get(selectedDevice.value.id);
  const interfaces = (selectedDevice.value.interfaces || []).filter(i => i.target_id != null);
  const filtered = filter && filter.size > 0 ? interfaces.filter(i => filter.has(i.name)) : interfaces;
  const rx_bps = filtered.reduce((sum, i) => sum + Number(i.rx_bps || 0), 0);
  const tx_bps = filtered.reduce((sum, i) => sum + Number(i.tx_bps || 0), 0);
  return { rx_bps, tx_bps, interfaces: filtered.length };
});

const selectedInterfaces = computed(() => {
  if (!selectedDevice.value) return [];
  const filter = interfaceFilter.value.get(selectedDevice.value.id);
  const interfaces = (selectedDevice.value.interfaces || []).filter(i => i.target_id != null);
  return filter && filter.size > 0 ? interfaces.filter(i => filter.has(i.name)) : interfaces;
});

const addedInterfacesForSelectedDevice = computed(() => {
  if (!selectedDevice.value) return [];
  return (selectedDevice.value.interfaces || []).filter(i => i.target_id != null);
});

const countByStatus = computed(() => ({
  up: markers.value.filter((m) => m.status === 'up').length,
  down: markers.value.filter((m) => m.status === 'down').length,
  unknown: markers.value.filter((m) => m.status === 'unknown').length,
}));

watch(selectedDevice, async (newVal) => {
  if (!newVal) {
    selectedDeviceEvents.value = [];
    return;
  }
  try {
    selectedDeviceEvents.value = await api(`/devices/${newVal.id}/events`);
  } catch (e) {
    console.warn('Failed to fetch device events:', e);
  }
});

function markerColor(status) {
  if (status === 'up') return '#10b981';
  if (status === 'down') return '#ef4444';
  return '#f59e0b';
}

function cableColor(status) {
  if (status === 'up') return '#0ea5e9';
  if (status === 'down') return '#ef4444';
  return '#f59e0b';
}

function cableWeight(link) {
  const total = Number(link.total_bps || 0);
  if (total <= 0) return 4;
  return Math.min(12, Math.max(4, 3 + Math.log10(total + 1)));
}

const maxTraffic = computed(() => Math.max(...markers.value.map((m) => deviceTraffic(m)), 1));

function trafficBar(value) {
  return `${Math.max(5, Math.min(100, (Number(value || 0) / maxTraffic.value) * 100))}%`;
}

function formatBps(value) {
  const bps = Number(value || 0);
  if (bps >= 1_000_000_000) return `${(bps / 1_000_000_000).toFixed(2)} Gbps`;
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(2)} Mbps`;
  if (bps >= 1_000) return `${(bps / 1_000).toFixed(1)} Kbps`;
  return `${bps.toFixed(0)} bps`;
}

function deviceTraffic(m) {
  return Number(m.traffic?.rx_bps || 0) + Number(m.traffic?.tx_bps || 0);
}

function formatSfpPower(val) {
  if (val == null || isNaN(val)) return '-';
  if (val < -100) return 'No Signal'; // MikroTik sentinel for no light
  return val.toFixed(2) + ' dBm';
}

function sfpPowerClass(val) {
  if (val == null || isNaN(val)) return '';
  if (val > -20) return 'sfp-good';
  if (val > -27) return 'sfp-warn';
  return 'sfp-critical';
}

function markerIcon(m) {
  const color = markerColor(m.status);
  
  let iconHtml = '';
  if (markerDisplayMode.value === 'data') {
    let dispVal = '';
    const res = m.map_display_resource || 'total_traffic';
    if (res === 'cpu' && m.cpu_pct !== null) {
      dispVal = `${m.cpu_pct}%`;
    } else if (res === 'memory' && m.mem_pct !== null) {
      dispVal = `${m.mem_pct}%`;
    } else if (res.startsWith('iface:')) {
      const ifaceName = res.split(':')[1];
      const i = (m.interfaces || []).find(x => x.name === ifaceName);
      if (i) {
        dispVal = formatBps(Number(i.rx_bps || 0) + Number(i.tx_bps || 0));
      } else {
        dispVal = 'No Data';
      }
    } else {
      dispVal = formatBps(deviceTraffic(m));
    }
    iconHtml = `<div style="font-size: 11px; font-weight: bold; color: white; margin-top: 16px; white-space: nowrap;">${dispVal}</div>`;
  } else {
    // Default to MikroTik logo for all devices as requested
    iconHtml = `
      <svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 610 610" version="1.2" style="margin-top: 2px;">
        <path fill="white" fill-rule="evenodd" d="M586.8 193.4v222.5c0 13.8-1.7 25.6-5.5 34.3-.7 1.6-1.5 3.2-2.3 4.7-5.5 8.9-16.6 17.7-31.6 25.9L344.4 592c-12.6 6.9-24.2 11.4-34 12.7q-2.8.4-5.4.4-2.7 0-5.5-.4c-9.8-1.3-21.4-5.8-34-12.7L164 536.4 62.6 480.8c-15.1-8.2-26.2-17-31.6-25.9-5.5-9-7.9-22.5-7.9-39V193.4c0-13.8 1.7-25.5 5.5-34.2.7-1.7 1.5-3.3 2.4-4.7q1.3-2.2 3-4.3c6.1-7.5 16-14.7 28.6-21.7L164 72.9l101.5-55.6c15-8.2 28.6-13 39.5-13q2.6 0 5.4.4c9.8 1.2 21.4 5.7 34 12.6l101.5 55.6 101.5 55.6c12.6 7 22.4 14.2 28.5 21.7q1.8 2.1 3.1 4.3c.8 1.4 1.6 3 2.3 4.7 3.8 8.7 5.5 20.4 5.5 34.2m-102.5 33.2c0-9.8-5.3-18.8-13.8-23.4l-152.7-83.7c-8-4.4-17.7-4.4-25.7 0l-38.9 21.3c-4.6 2.6-4.6 9.2 0 11.7l116.4 63.8c4.6 2.6 4.6 9.2 0 11.7l-51.8 28.4c-8 4.4-17.7 4.4-25.7 0l-112-61.4c-8-4.4-17.7-4.4-25.7 0l-14.9 8.2c-8.6 4.7-13.9 13.6-13.9 23.4v7l135.5 74.3c8.6 4.6 13.9 13.6 13.9 23.3v141.4c0 4.8 2.6 9.3 6.9 11.7l10.2 5.6c8 4.4 17.7 4.4 25.7 0l10.3-5.6c4.2-2.4 6.9-6.9 6.9-11.7V331.2c0-9.7 5.3-18.7 13.9-23.3l65.5-36c4.5-2.4 9.9.8 9.9 5.9v142.4c0 5.1 5.4 8.3 9.9 5.9l36.3-19.9c8.5-4.7 13.8-13.7 13.8-23.4zm-298.7 78.2c0-4.8-2.6-9.3-6.9-11.7l-43.2-23.7c-4.5-2.4-9.9.8-9.9 5.9v107.5c0 9.7 5.3 18.7 13.9 23.4l36.3 19.9c4.4 2.4 9.8-.8 9.8-5.9z"/>
      </svg>
    `;
  }

  const statusStr = m.status === 'up' ? 'Online' : m.status === 'down' ? 'Offline' : 'Unknown';
  const statusClass = m.status === 'up' ? 'sfp-good' : m.status === 'down' ? 'sfp-critical' : 'sfp-warn';
  const statusBadge = `<div class="interface-sfp-badge ${statusClass}">${statusStr}</div>`;
  
  let resourceHtml = '';
  if (m.cpu_pct !== undefined && m.mem_pct !== undefined) {
    resourceHtml = `
      <div style="display: flex; gap: 4px; align-items: center; justify-content: center; margin-top: 2px;">
        <div class="interface-sfp-badge" style="background: white; color: var(--text-color); font-weight: bold; border: 1px solid var(--border-color);">CPU: ${m.cpu_pct}%</div>
        <div class="interface-sfp-badge" style="background: white; color: var(--text-color); font-weight: bold; border: 1px solid var(--border-color);">RAM: ${m.mem_pct}%</div>
      </div>
    `;
  }

  return L.divIcon({
    className: 'device-marker-wrap',
    html: `
      <div style="position: relative; width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center;">
        <div class="device-marker ${m.status} pulse-marker" style="--marker:${color}; display: flex; flex-direction: column; align-items: center; justify-content: center; width: 48px; height: 48px; background: ${color}; border-radius: 50%; box-shadow: 0 4px 10px rgba(0,0,0,0.15);">${iconHtml}</div>
        <div class="interface-label-wrap" style="position: absolute; top: 52px; display: flex; flex-direction: column; align-items: center; pointer-events: none;">
          <div class="interface-name-label" style="font-size: 13px; font-weight: bold; text-shadow: 0 1px 2px rgba(255,255,255,0.8);">${m.name || ''}</div>
          <div style="display: flex; gap: 4px; align-items: center; justify-content: center; margin-top: 2px;">
            ${statusBadge}
          </div>
          ${resourceHtml}
        </div>
      </div>
    `,
    iconSize: [160, 160],
    iconAnchor: [80, 24],
  });
}

function formatTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleString('id-ID', { hour12: false });
}

function interfaceIcon(status, sfpPower, ifaceName) {
  const color = status === 'up' ? '#10b981' : status === 'down' ? '#ef4444' : '#f59e0b';
  const statusStr = status === 'up' ? 'Online' : status === 'down' ? 'Offline' : 'Unknown';
  const statusClass = status === 'up' ? 'sfp-good' : status === 'down' ? 'sfp-critical' : 'sfp-warn';
  const statusBadge = `<div class="interface-sfp-badge ${statusClass}">${statusStr}</div>`;
  
  let sfpBadge = '';
  if (sfpPower) {
    const rxVal = sfpPower.rx;
    const txVal = sfpPower.tx;
    const rxStr = (rxVal == null || isNaN(rxVal) || rxVal < -100) ? 'No Sig' : `${rxVal.toFixed(1)} dBm`;
    const txStr = (txVal == null || isNaN(txVal) || txVal < -100) ? 'No Sig' : `${txVal.toFixed(1)} dBm`;
    const rxClass = (rxVal == null || isNaN(rxVal) || rxVal < -27) ? 'sfp-critical' : rxVal > -20 ? 'sfp-good' : 'sfp-warn';
    const txClass = (txVal == null || isNaN(txVal) || txVal < -27) ? 'sfp-critical' : txVal > -20 ? 'sfp-good' : 'sfp-warn';
    sfpBadge = `
      <div style="display: flex; gap: 4px; align-items: center; justify-content: center; margin-top: 2px;">
        <div class="interface-sfp-badge ${txClass}">TX: ${txStr}</div>
        <div class="interface-sfp-badge ${rxClass}">RX: ${rxStr}</div>
      </div>
    `;
  }
  return L.divIcon({
    className: 'interface-marker-wrap',
    html: `
      <div class="interface-marker ${status}" style="--marker:${color}"><span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:block;"><rect x="2" y="5" width="20" height="14" rx="3" /><rect x="6" y="9" width="4" height="6" rx="1" fill="currentColor" /><rect x="14" y="9" width="4" height="6" rx="1" fill="currentColor" /></svg></span></div>
      <div class="interface-label-wrap">
        <div class="interface-name-label">${ifaceName || ''}</div>
        <div style="display: flex; gap: 4px; align-items: center; justify-content: center; margin-top: 2px;">
          ${statusBadge}
        </div>
        ${sfpBadge}
      </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

function interfacePopupHtml(iface, deviceName) {
  const sfpSection = iface.sfp_power
    ? `<div class="popup-section">
         <div class="popup-section-title">SFP Optical Power</div>
         <div class="popup-row"><span>Tx Power</span><b class="${sfpPowerClass(iface.sfp_power.tx)}">${formatSfpPower(iface.sfp_power.tx)}</b></div>
         <div class="popup-row"><span>Rx Power</span><b class="${sfpPowerClass(iface.sfp_power.rx)}">${formatSfpPower(iface.sfp_power.rx)}</b></div>
       </div>`
    : '<div class="popup-row"><span>SFP</span><b class="muted">No optical DOM</b></div>';
  
  const adminActions = isAdmin.value
    ? `<div class="popup-hint">Drag to reposition (max 200m from device)</div>
       <button class="delete-interface-btn" onclick="window.__appmon_deleteInterfaceMarker && window.__appmon_deleteInterfaceMarker(${iface.target_id})">Delete from Map</button>`
    : '';

  return `
    <div class="map-popup interface-popup">
      <div class="popup-title">${deviceName}</div>
      <div class="popup-host">${iface.name}</div>
      <div class="popup-row"><span>Status</span><b class="${iface.status}">${iface.status}</b></div>
      <div class="popup-row"><span>Link</span><b>${iface.link_up ? 'UP' : 'DOWN'}</b></div>
      <div class="popup-row"><span>RX</span><b>${formatBps(iface.rx_bps)}</b></div>
      <div class="popup-row"><span>TX</span><b>${formatBps(iface.tx_bps)}</b></div>
      <div class="popup-row"><span>Total</span><b>${formatBps(Number(iface.rx_bps || 0) + Number(iface.tx_bps || 0))}</b></div>
      ${sfpSection}
      ${adminActions}
    </div>`;
}

function createTooltipLabel(m) {
  const statusStr = m.status === 'up' ? 'Online' : m.status === 'down' ? 'Offline' : 'Unknown';
  
  // Build resource lines — show CPU and RAM if available, never traffic
  const resourceParts = [];
  if (m.cpu_pct !== null && m.cpu_pct !== undefined) {
    resourceParts.push(`CPU: <b>${m.cpu_pct}%</b>`);
  }
  if (m.mem_pct !== null && m.mem_pct !== undefined) {
    resourceParts.push(`RAM: <b>${m.mem_pct}%</b>`);
  }
  
  const resourceHtml = resourceParts.length > 0
    ? `<div class="tooltip-resource" style="font-size:10px; margin-top:3px; color:var(--text-muted); font-weight:600; display:flex; gap:8px;">${resourceParts.join(' &nbsp;|&nbsp; ')}</div>`
    : '';
  
  return `<div class="map-tooltip-label ${m.status}">
    <div class="tooltip-name">${m.name}</div>
    <div class="tooltip-status" style="font-weight:bold; margin-top: 2px; text-transform: uppercase;">${statusStr}</div>
    ${resourceHtml}
  </div>`;
}

function popupHtml(m) {
  const resourceOptions = `
    <option value="total_traffic" ${m.map_display_resource === 'total_traffic' ? 'selected' : ''}>Total Traffic</option>
    ${m.cpu_pct !== null ? `<option value="cpu" ${m.map_display_resource === 'cpu' ? 'selected' : ''}>CPU Usage (${m.cpu_pct}%)</option>` : ''}
    ${m.mem_pct !== null ? `<option value="memory" ${m.map_display_resource === 'memory' ? 'selected' : ''}>Memory Usage (${m.mem_pct}%)</option>` : ''}
    ${(m.interfaces || []).filter(i => i.target_id).map(i => `<option value="iface:${i.name}" ${m.map_display_resource === `iface:${i.name}` ? 'selected' : ''}>Interface: ${i.name}</option>`).join('')}
  `;

  const resourceDropdown = isAdmin.value ? `
    <div class="popup-row" style="margin-top: 12px; flex-direction: column; align-items: flex-start; gap: 4px;">
      <span style="font-weight: bold; color: var(--text-muted); font-size: 11px;">MARKER DISPLAY:</span>
      <select onchange="window.__appmon_setMapResource && window.__appmon_setMapResource(${m.id}, this.value)" style="width: 100%; padding: 6px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-color); font-size: 12px;">
        ${resourceOptions}
      </select>
    </div>` : '';

  return `
    <div class="map-popup">
      <div class="popup-title">${m.name}</div>
      <div class="popup-host">${m.host || '-'}</div>
      <div class="popup-row"><span>Site</span><b>${m.site || '-'}</b></div>
      <div class="popup-row"><span>Type</span><b>${m.type || '-'}</b></div>
      <div class="popup-row"><span>Status</span><b class="${m.status}">${m.status}</b></div>
      ${resourceDropdown}
    </div>`;
}

function cablePopupHtml(link) {
  const from = markers.value.find((m) => m.id === link.from_id);
  const to = markers.value.find((m) => m.id === link.to_id);
  
  const eventsHtml = (link.events || []).length > 0
    ? `<div class="popup-section"><div class="popup-section-title">Recent Events</div>${link.events.slice(0, 3).map(e => {
        const time = new Date(e.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        const badge = e.new_status === 'down' ? 'down' : e.new_status === 'up' ? 'up' : 'unknown';
        return `<div class="event-row"><span class="event-time">${time}</span><span class="event-badge ${badge}">${e.new_status}</span><span class="event-msg">${e.message || '-'}</span></div>`;
      }).join('')}</div>`
    : '';
  
  const sfpFromHtml = (link.sfp_from || []).filter(s => s.power != null).slice(0, 2).map(s => 
    `<div class="sfp-row"><span>${s.name}</span><b class="${s.status}">${s.power} dBm</b></div>`
  ).join('');
  
  const sfpToHtml = (link.sfp_to || []).filter(s => s.power != null).slice(0, 2).map(s => 
    `<div class="sfp-row"><span>${s.name}</span><b class="${s.status}">${s.power} dBm</b></div>`
  ).join('');
  
  const sfpHtml = (sfpFromHtml || sfpToHtml) 
    ? `<div class="popup-section"><div class="popup-section-title">SFP Power</div>${sfpFromHtml || '<div class="muted">No SFP data from ${link.from_name}</div>'}${sfpToHtml || '<div class="muted">No SFP data from ${link.to_name}</div>'}</div>`
    : '';
  
  return `
    <div class="map-popup">
      <div class="popup-title">Cable Link</div>
      <div class="popup-host">${link.name || `${from?.name || 'Device'} ⇄ ${to?.name || 'Device'}`}</div>
      <div class="popup-row"><span>Type</span><b>${link.cable_type || 'fiber'}</b></div>
      <div class="popup-row"><span>Site</span><b>${link.site || '-'}</b></div>
      <div class="popup-row"><span>Status</span><b class="${link.status}">${link.status}</b></div>
      <div class="popup-row"><span>RX</span><b>${formatBps(link.rx_bps)}</b></div>
      <div class="popup-row"><span>TX</span><b>${formatBps(link.tx_bps)}</b></div>
      <div class="popup-row"><span>Total</span><b>${formatBps(link.total_bps)}</b></div>
      ${eventsHtml}
      ${sfpHtml}
    </div>`;
}

async function load() {
  const data = await api('/map/devices');
  markers.value = Array.isArray(data) ? data : data.devices || [];
  links.value = Array.isArray(data) ? [] : data.links || [];
  if (!selectedDevice.value && markers.value.length) selectedDevice.value = markers.value[0];
  if (selectedDevice.value) selectedDevice.value = markers.value.find((m) => m.id === selectedDevice.value.id) || markers.value[0] || null;
  if (!map) return;

  if (markerLayer) markerLayer.remove();
  if (cableLayer) cableLayer.remove();
  if (tooltipLayer) tooltipLayer.remove();
  if (interfaceLayer) interfaceLayer.remove();
  markerLayer = L.layerGroup();
  cableLayer = L.layerGroup();
  tooltipLayer = L.layerGroup();
  interfaceLayer = L.layerGroup();
  markerRefs.clear();
  tooltipRefs.clear();
  interfaceRefs.clear();
  
  // Load saved interface positions from localStorage
  try {
    const saved = localStorage.getItem('interface_positions');
    if (saved) {
      const parsed = JSON.parse(saved);
      interfacePositions.value = new Map(Object.entries(parsed).map(([k, v]) => [Number(k), v]));
    }
  } catch (e) {
    console.warn('Failed to load interface positions:', e);
  }

  links.value.forEach((link) => {
    const line = L.polyline([link.from, link.to], {
      className: 'traffic-cable-line cable-' + link.status,
      color: cableColor(link.status),
      weight: cableWeight(link),
      opacity: 0.82,
      lineCap: 'round',
      dashArray: link.status === 'down' ? '8 10' : null,
    }).bindPopup(cablePopupHtml(link), { closeButton: false, className: 'device-popup' });
    cableLayer.addLayer(line);
  });

  markers.value.forEach((m) => {
    const mk = L.marker([m.latitude, m.longitude], { icon: markerIcon(m) })
      .bindPopup(popupHtml(m), { closeButton: false, className: 'device-popup', autoClose: false, autoPan: false });
    markerLayer.addLayer(mk);
    markerRefs.set(m.id, mk);
    
    // Create interface sub-icons
    const addedIfaces = (m.interfaces || []).filter(iface => iface.target_id != null);
    
    // Get filter for this device
    const filter = interfaceFilter.value.get(m.id);
    const interfacesToShow = filter && filter.size > 0 
      ? addedIfaces.filter(iface => filter.has(iface.name))
      : addedIfaces;
    
    interfacesToShow.forEach((iface, idx) => {
      const savedPos = interfacePositions.value.get(iface.target_id);
      let ifaceLatLng;
      
      if (savedPos) {
        ifaceLatLng = [savedPos.lat, savedPos.lng];
      } else {
        // Default position: circle around device with larger radius
        const angle = (idx / (interfacesToShow.length || 1)) * 2 * Math.PI;
        const offsetLat = 0.0015 * Math.cos(angle); // ~150m (increased from 80m)
        const offsetLng = 0.0015 * Math.sin(angle);
        ifaceLatLng = [m.latitude + offsetLat, m.longitude + offsetLng];
      }
      
      const ifaceMk = L.marker(ifaceLatLng, {
        icon: interfaceIcon(iface.status, iface.sfp_power, iface.name),
        draggable: isAdmin.value,
        title: `${m.name} - ${iface.name}`, // Tooltip on hover
      })
        .bindPopup(interfacePopupHtml(iface, m.name), { closeButton: false, className: 'device-popup' });
      
      // Drag event with radius limit
      ifaceMk.on('drag', (e) => {
        const newPos = e.target.getLatLng();
        const devicePos = L.latLng(m.latitude, m.longitude);
        const distance = devicePos.distanceTo(newPos);
        
        // Max 200m from device
        if (distance > 200) {
          const bearing = Math.atan2(newPos.lng - devicePos.lng, newPos.lat - devicePos.lat);
          const maxLat = devicePos.lat + (200 / 111320) * Math.cos(bearing);
          const maxLng = devicePos.lng + (200 / (111320 * Math.cos(devicePos.lat * Math.PI / 180))) * Math.sin(bearing);
          e.target.setLatLng([maxLat, maxLng]);
        }
      });
      
      ifaceMk.on('dragend', (e) => {
        const pos = e.target.getLatLng();
        interfacePositions.value.set(iface.target_id, { lat: pos.lat, lng: pos.lng });
        saveInterfacePositions();
      });
      
      interfaceLayer.addLayer(ifaceMk);
      interfaceRefs.set(iface.target_id, ifaceMk);
    });
  });

  cableLayer.addTo(map);
  markerLayer.addTo(map);
  tooltipLayer.addTo(map);
  interfaceLayer.addTo(map);
  if (firstLoad && markers.value.length > 0) {
    const hasSavedState = !!localStorage.getItem('appmon_map_state');
    if (!hasSavedState) {
      const bounds = L.latLngBounds(markers.value.map((m) => [m.latitude, m.longitude]));
      map.fitBounds(bounds, { padding: [30, 30] });
    }
    firstLoad = false;
  }
}

function focusMarker(m) {
  selectedDevice.value = m;
  const mk = markerRefs.get(m.id);
  if (!mk || !map) return;
  map.flyTo([m.latitude, m.longitude], Math.max(map.getZoom(), 13), { duration: 0.8 });
  mk.openPopup();
}

function saveInterfacePositions() {
  try {
    const obj = {};
    interfacePositions.value.forEach((pos, targetId) => {
      obj[targetId] = pos;
    });
    localStorage.setItem('interface_positions', JSON.stringify(obj));
  } catch (e) {
    console.warn('Failed to save interface positions:', e);
  }
}

async function createLink() {
  linkError.value = '';
  try {
    await api('/links', { method: 'POST', body: JSON.stringify(linkForm.value) });
    linkForm.value = { from_device_id: null, to_device_id: null, name: '', cable_type: 'fiber' };
    await load();
  } catch (e) {
    linkError.value = e.message;
  }
}

async function openAddMonitorModal() {
  monitorError.value = '';
  monitorStep.value = 1;
  monitorDevice.value = null;
  monitorInterface.value = null;
  availableInterfaces.value = [];
  createdMonitors.value = [];
  showMonitorModal.value = true;
}

async function selectMonitorDevice(deviceId) {
  monitorError.value = '';
  if (!deviceId) {
    availableInterfaces.value = [];
    return;
  }
  monitorLoading.value = true;
  try {
    const data = await api(`/devices/${deviceId}/interfaces`);
    availableInterfaces.value = data.filter(i => i.name && !i.disabled);
  } catch (e) {
    monitorError.value = e.message;
    availableInterfaces.value = [];
  } finally {
    monitorLoading.value = false;
  }
}

async function addMonitorTarget() {
  if (!monitorDevice.value || !monitorInterface.value) {
    monitorError.value = 'Pilih device dan interface';
    return;
  }
  const device = markers.value.find(m => m.id === monitorDevice.value);
  if (!device) {
    monitorError.value = 'Device tidak ditemukan';
    return;
  }
  monitorLoading.value = true;
  monitorError.value = '';
  try {
    const result = await api('/targets', {
      method: 'POST',
      body: JSON.stringify({
        kind: 'snmp_iface',
        name: `${device.name} ${monitorInterface.value}`,
        device_id: device.id,
        iface: monitorInterface.value,
        enabled: true,
      }),
    });
    createdMonitors.value.push({
      device_id: device.id,
      device_name: device.name,
      interface_name: monitorInterface.value,
      target_id: result.id,
    });
    // Reset untuk add lagi
    monitorDevice.value = null;
    monitorInterface.value = null;
    availableInterfaces.value = [];
  } catch (e) {
    monitorError.value = e.message;
  } finally {
    monitorLoading.value = false;
  }
}

function proceedToCableStep() {
  if (createdMonitors.value.length > 1) {
    monitorStep.value = 2;
  } else {
    finishAddMonitor();
  }
}

async function createCableLines() {
  monitorLoading.value = true;
  monitorError.value = '';
  try {
    // Create cable line between first and second monitor
    for (let i = 0; i < createdMonitors.value.length - 1; i++) {
      const from = createdMonitors.value[i];
      const to = createdMonitors.value[i + 1];
      await api('/links', {
        method: 'POST',
        body: JSON.stringify({
          from_device_id: from.device_id,
          to_device_id: to.device_id,
          name: `${from.device_name} ⇄ ${to.device_name}`,
          cable_type: 'fiber',
        }),
      });
    }
    finishAddMonitor();
  } catch (e) {
    monitorError.value = e.message;
  } finally {
    monitorLoading.value = false;
  }
}

function skipCableLines() {
  finishAddMonitor();
}

async function finishAddMonitor() {
  showMonitorModal.value = false;
  // Wait a bit for backend to process new targets
  await new Promise(resolve => setTimeout(resolve, 500));
  await load();
}

function closeMonitorModal() {
  showMonitorModal.value = false;
  monitorStep.value = 1;
  monitorDevice.value = null;
  monitorInterface.value = null;
  availableInterfaces.value = [];
  createdMonitors.value = [];
  monitorError.value = '';
}

function updateMarkerRealtime(deviceId, traffic) {
  const m = markers.value.find((x) => x.id === deviceId);
  if (!m) return;
  m.traffic = traffic;
  const tooltip = tooltipRefs.get(deviceId);
  if (tooltip) tooltip.setContent(createTooltipLabel(m));
  const mk = markerRefs.get(deviceId);
  if (mk) {
    if (mk.isPopupOpen()) mk.setPopupContent(popupHtml(m));
  }
  
  // Update device marker icon color or data if needed
  const newStatus = traffic.status || m.status;
  let shouldUpdateIcon = false;
  if (newStatus && newStatus !== m.status) {
    m.status = newStatus;
    shouldUpdateIcon = true;
  }
  // If displaying data, it changes constantly so we must update icon
  if (markerDisplayMode.value === 'data') {
    shouldUpdateIcon = true;
  }
  
  if (shouldUpdateIcon && mk) {
    mk.setIcon(markerIcon(m));
  }
  
  // Update interface markers
  (m.interfaces || []).forEach((iface) => {
    const ifaceMk = interfaceRefs.get(iface.target_id);
    if (ifaceMk) {
      ifaceMk.setIcon(interfaceIcon(iface.status, iface.sfp_power, iface.name));
      if (ifaceMk.isPopupOpen()) {
        ifaceMk.setPopupContent(interfacePopupHtml(iface, m.name));
      }
    }
  });
}

function isInterfaceSelected(ifaceName) {
  if (!selectedDevice.value) return false;
  const filter = interfaceFilter.value.get(selectedDevice.value.id);
  if (!filter || filter.size === 0) return true; // default: all selected
  return filter.has(ifaceName);
}

function toggleInterface(ifaceName) {
  if (!selectedDevice.value) return;
  const deviceId = selectedDevice.value.id;
  if (!interfaceFilter.value.has(deviceId)) {
    interfaceFilter.value.set(deviceId, new Set());
  }
  const filter = interfaceFilter.value.get(deviceId);
  const addedIfaces = (selectedDevice.value.interfaces || []).filter(i => i.target_id != null);
  if (filter.size === 0) {
    // first toggle: initialize with all interfaces except the toggled one
    addedIfaces.forEach(i => {
      if (i.name !== ifaceName) filter.add(i.name);
    });
  } else {
    if (filter.has(ifaceName)) filter.delete(ifaceName);
    else filter.add(ifaceName);
  }
  interfaceFilter.value = new Map(interfaceFilter.value); // trigger reactivity
}

function toggleAllInterfaces() {
  if (!selectedDevice.value) return;
  const deviceId = selectedDevice.value.id;
  const filter = interfaceFilter.value.get(deviceId);
  const addedIfaces = (selectedDevice.value.interfaces || []).filter(i => i.target_id != null);
  if (!filter || filter.size === 0 || filter.size === addedIfaces.length) {
    // all selected or none: unselect all
    interfaceFilter.value.set(deviceId, new Set());
  } else {
    // some selected: select all
    interfaceFilter.value.set(deviceId, new Set(addedIfaces.map(i => i.name)));
  }
  interfaceFilter.value = new Map(interfaceFilter.value);
}

const isAllSelected = computed(() => {
  if (!selectedDevice.value) return false;
  const filter = interfaceFilter.value.get(selectedDevice.value.id);
  const addedIfaces = (selectedDevice.value.interfaces || []).filter(i => i.target_id != null);
  if (!filter || filter.size === 0) return true;
  return filter.size === addedIfaces.length;
});

async function deleteInterfaceMarker(targetId) {
  if (!confirm('Delete this interface monitor from map?')) return;
  
  try {
    // Delete target from backend
    await api(`/targets/${targetId}`, { method: 'DELETE' });
    
    // Remove marker from map
    const marker = interfaceRefs.get(targetId);
    if (marker && interfaceLayer) {
      interfaceLayer.removeLayer(marker);
      interfaceRefs.delete(targetId);
    }
    
    // Remove from interfacePositions
    interfacePositions.value.delete(targetId);
    saveInterfacePositions();
    
    // Reload data
    await load();
  } catch (e) {
    alert('Failed to delete: ' + e.message);
  }
}

// Expose to window for popup button (scoped with cleanup)
async function setMapResource(deviceId, resource) {
  try {
    await api(`/devices/${deviceId}/map-resource`, {
      method: 'PUT',
      body: JSON.stringify({ resource }),
    });
    const m = markers.value.find(x => x.id === deviceId);
    if (m) {
      m.map_display_resource = resource;
      markerDisplayMode.value = 'data'; // Automatically switch to Data display mode
      const mk = markerRefs.get(deviceId);
      if (mk) {
        mk.setIcon(markerIcon(m));
        if (mk.isPopupOpen()) mk.setPopupContent(popupHtml(m));
      }
    }
  } catch (e) {
    alert('Failed to set marker data: ' + e.message);
  }
}
function setupGlobalHandler() { 
  window.__appmon_deleteInterfaceMarker = deleteInterfaceMarker; 
  window.__appmon_setMapResource = setMapResource;
}
function cleanupGlobalHandler() { 
  delete window.__appmon_deleteInterfaceMarker; 
  delete window.__appmon_setMapResource;
}

// Watch interfaceFilter changes and re-render interface markers
watch(interfaceFilter, () => {
  if (!map || !interfaceLayer) return;
  
  // Clear existing interface markers
  interfaceLayer.clearLayers();
  interfaceRefs.clear();
  
  // Re-render interface markers with current filter
  markers.value.forEach((m) => {
    const filter = interfaceFilter.value.get(m.id);
    const addedIfaces = (m.interfaces || []).filter(iface => iface.target_id != null);
    const interfacesToShow = filter && filter.size > 0 
      ? addedIfaces.filter(iface => filter.has(iface.name))
      : addedIfaces;
    
    interfacesToShow.forEach((iface, idx) => {
      const savedPos = interfacePositions.value.get(iface.target_id);
      let ifaceLatLng;
      
      if (savedPos) {
        ifaceLatLng = [savedPos.lat, savedPos.lng];
      } else {
        const angle = (idx / (interfacesToShow.length || 1)) * 2 * Math.PI;
        const offsetLat = 0.0015 * Math.cos(angle);
        const offsetLng = 0.0015 * Math.sin(angle);
        ifaceLatLng = [m.latitude + offsetLat, m.longitude + offsetLng];
      }
      
      const ifaceMk = L.marker(ifaceLatLng, {
        icon: interfaceIcon(iface.status, iface.sfp_power, iface.name),
        draggable: isAdmin.value,
        title: `${m.name} - ${iface.name}`,
      })
        .bindPopup(interfacePopupHtml(iface, m.name), { closeButton: false, className: 'device-popup' });
      
      ifaceMk.on('drag', (e) => {
        const newPos = e.target.getLatLng();
        const devicePos = L.latLng(m.latitude, m.longitude);
        const distance = devicePos.distanceTo(newPos);
        
        if (distance > 200) {
          const bearing = Math.atan2(newPos.lng - devicePos.lng, newPos.lat - devicePos.lat);
          const maxLat = devicePos.lat + (200 / 111320) * Math.cos(bearing);
          const maxLng = devicePos.lng + (200 / (111320 * Math.cos(devicePos.lat * Math.PI / 180))) * Math.sin(bearing);
          e.target.setLatLng([maxLat, maxLng]);
        }
      });
      
      ifaceMk.on('dragend', (e) => {
        const pos = e.target.getLatLng();
        interfacePositions.value.set(iface.target_id, { lat: pos.lat, lng: pos.lng });
        saveInterfacePositions();
      });
      
      interfaceLayer.addLayer(ifaceMk);
      interfaceRefs.set(iface.target_id, ifaceMk);
    });
  });
}, { deep: true });

const computedTileUrl = computed(() => {
  if (activeLayer.value === 'osm') return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  if (activeLayer.value === 'dark') return 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
  if (activeLayer.value === 'light') return 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
  if (activeLayer.value === 'satellite') return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
  
  // Auto
  return isDark.value
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
});

function updateTileLayer() {
  if (!map) return;
  if (currentTileLayer) {
    map.removeLayer(currentTileLayer);
  }
  
  let attribution = '&copy; CartoDB';
  if (activeLayer.value === 'osm') {
    attribution = '&copy; OpenStreetMap contributors';
  } else if (activeLayer.value === 'satellite') {
    attribution = '&copy; Esri World Imagery';
  }
  
  currentTileLayer = L.tileLayer(computedTileUrl.value, {
    attribution: attribution,
    maxZoom: activeLayer.value === 'satellite' ? 18 : 20
  }).addTo(map);
}

watch([computedTileUrl], () => {
  updateTileLayer();
});

watch([isPanelCollapsed, isFullscreen], () => {
  if (!map) return;
  setTimeout(() => {
    map.invalidateSize({ animate: true });
  }, 320);
});

function toggleFullscreen() {
  isFullscreen.value = !isFullscreen.value;
}

function handleFullscreenKeydown(e) {
  if (e.key === 'Escape' && isFullscreen.value) {
    isFullscreen.value = false;
  }
}

function toggleMapLock() {
  isMapLocked.value = !isMapLocked.value;
  localStorage.setItem('appmon_map_locked', isMapLocked.value);
  applyMapLock();
}

function applyMapLock() {
  if (!map) return;
  if (isMapLocked.value) {
    const bounds = map.getBounds();
    map.setMaxBounds(bounds);
    map.setMinZoom(map.getZoom());
  } else {
    map.setMaxBounds(null);
    map.setMinZoom(2);
  }
}

onMounted(async () => {
  let defaultCenter = [-2.5, 118];
  let defaultZoom = 5;
  try {
    const saved = localStorage.getItem('appmon_map_state');
    if (saved) {
      const state = JSON.parse(saved);
      if (state.center && state.zoom) {
        defaultCenter = state.center;
        defaultZoom = state.zoom;
      }
    }
  } catch (e) {}

  map = L.map('map', { zoomControl: true, attributionControl: false }).setView(defaultCenter, defaultZoom);
  
  if (isMapLocked.value) {
    // Need a tiny delay for Leaflet to calculate bounds properly after setView
    setTimeout(() => applyMapLock(), 100);
  }
  
  map.on('moveend', () => {
    try {
      localStorage.setItem('appmon_map_state', JSON.stringify({
        center: map.getCenter(),
        zoom: map.getZoom()
      }));
    } catch (e) {}
  });
  
  updateTileLayer();
  
  L.control.attribution({ prefix: false }).addAttribution('&copy; AppMon Maps').addTo(map);
  window.addEventListener('keydown', handleFullscreenKeydown);
  
  // Click map to copy coordinates
  if (isAdmin.value) {
    map.on('click', (e) => {
      const lat = e.latlng.lat.toFixed(6);
      const lng = e.latlng.lng.toFixed(6);
      const coords = `${lat}, ${lng}`;
      
      // Copy to clipboard
      navigator.clipboard.writeText(coords).then(() => {
        // Show temporary marker with popup
        const tempMarker = L.marker([e.latlng.lat, e.latlng.lng], {
          icon: L.divIcon({
            className: 'temp-coord-marker',
            html: '<div style="background:#2563eb;color:white;padding:4px 8px;border-radius:8px;font-size:11px;font-weight:700;box-shadow:0 4px 12px rgba(37,99,235,0.4);white-space:nowrap;">Copied!</div>',
            iconSize: [80, 30],
            iconAnchor: [40, 15],
          })
        }).addTo(map);
        
        const popup = L.popup({ closeButton: false, className: 'coord-popup' })
          .setLatLng([e.latlng.lat, e.latlng.lng])
          .setContent(`<div style="text-align:center;"><strong>Coordinates Copied!</strong><br/><code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:11px;">${coords}</code><br/><small style="color:#64748b;">Paste in Device form</small></div>`)
          .openOn(map);
        
        // Remove after 3 seconds
        setTimeout(() => {
          map.removeLayer(tempMarker);
          map.closePopup(popup);
        }, 3000);
      }).catch(() => {
        alert(`Coordinates: ${coords}\n\nCopy manually and paste in Device form.`);
      });
    });
  }
  
  await load();

  setupGlobalHandler();

  setTimeout(() => {
    if (map) {
      map.invalidateSize({ animate: false });
    }
  }, 250);

  unsubState = onSocketEvent('state', (s) => {
    // Handle ping target state (device up/down)
    const pingDevice = markers.value.find((m) => (m.interfaces || []).length === 0 && m.id);
    // Find device by checking all targets that map to this target_id
    const deviceWithPing = markers.value.find((m) =>
      (m.interfaces || []).some((i) => i.target_id === s.target_id)
    );
    
    if (!deviceWithPing) {
      // Could be a ping target — update device marker status directly
      const deviceByPing = markers.value.find((m) => {
        // Heuristic: match via device ID embedded in target metadata not available here;
        // ping status updates trigger full refresh via event channel instead
        return false;
      });
      return;
    }
    
    const device = deviceWithPing;
    const iface = device.interfaces.find((i) => i.target_id === s.target_id);
    if (iface) {
      iface.rx_bps = Number(s.rx_bps || 0);
      iface.tx_bps = Number(s.tx_bps || 0);
      iface.status = s.status || 'unknown';
      if (s.sfp_power !== undefined) iface.sfp_power = s.sfp_power;
    }
    const filter = interfaceFilter.value.get(device.id);
    const filtered = filter && filter.size > 0 ? device.interfaces.filter(i => filter.has(i.name)) : device.interfaces;
    const totalRx = filtered.reduce((sum, i) => sum + Number(i.rx_bps || 0), 0);
    const totalTx = filtered.reduce((sum, i) => sum + Number(i.tx_bps || 0), 0);
    updateMarkerRealtime(device.id, { rx_bps: totalRx, tx_bps: totalTx, interfaces: filtered.length });
  });

  // Re-load map data when a status-change event arrives (debounced)
  let eventDebounce = null;
  unsubEvent = onSocketEvent('event', () => {
    clearTimeout(eventDebounce);
    eventDebounce = setTimeout(() => load(), 2000);
  });

  // Handle device_status for realtime CPU/RAM updates
  unsubDeviceStatus = onSocketEvent('device_status', (s) => {
    const m = markers.value.find((m) => m.id === s.device_id);
    if (m) {
      if (s.cpu_pct !== undefined) m.cpu_pct = s.cpu_pct;
      if (s.mem_pct !== undefined) m.mem_pct = s.mem_pct;
      
      const mk = markerRefs.get(m.id);
      if (mk) {
        if (mk.isPopupOpen()) mk.setPopupContent(popupHtml(m));
        
        // We always update the marker icon since it contains the CPU/RAM badges below it now
        mk.setIcon(markerIcon(m));
      }
    }
  });

  // Auto-refresh every 60 seconds to catch any stale data
  refreshTimer = setInterval(() => load(), 60000);
});

onUnmounted(() => {
  if (unsubState) unsubState();
  if (unsubEvent) unsubEvent();
  if (unsubDeviceStatus) unsubDeviceStatus();
  if (refreshTimer) clearInterval(refreshTimer);
  cleanupGlobalHandler();
  window.removeEventListener('keydown', handleFullscreenKeydown);
  if (map) map.remove();
  map = null;
  markerLayer = null;
  cableLayer = null;
  tooltipLayer = null;
});
</script>
