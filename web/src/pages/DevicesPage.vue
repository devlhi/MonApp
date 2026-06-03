<template>
  <section class="card">
    <div class="row" style="justify-content:space-between;margin-bottom:14px">
      <div>
        <strong>Devices</strong>
        <div class="muted">Kelola perangkat jaringan. SNMP + Ping untuk traffic, Ping Only untuk monitoring.</div>
      </div>
      <button class="btn primary" @click="openCreate">{{ showForm ? 'Close' : '+ Add Device' }}</button>
    </div>

    <!-- Form -->
    <div v-if="showForm" class="monitor-form">
      <div class="row" style="justify-content:space-between;margin-bottom:12px">
        <strong style="font-size:15px">{{ editingId ? 'Edit Device' : 'Add New Device' }}</strong>
        <button class="btn" @click="closeForm">Close</button>
      </div>
      <div class="form-grid">
        <label><span>Name *</span><input class="input" v-model="form.name" placeholder="Core Router / OLT / Switch" /></label>
        <label><span>Host / IP *</span><input class="input" v-model="form.host" placeholder="192.168.10.1" /></label>
        <label><span>Type</span><select class="input" v-model="form.type"><option value="snmp">SNMP + Ping</option><option value="generic">Ping Only</option></select></label>
        <label><span>SNMP Community</span><input class="input" v-model="form.snmp_community" placeholder="public" :disabled="form.type === 'generic'" /></label>
        <label><span>SNMP Port</span><input class="input" v-model.number="form.snmp_port" type="number" :disabled="form.type === 'generic'" /></label>
        <label><span>Site</span><input class="input" v-model="form.site" placeholder="POP / Area" /></label>
        <label style="grid-column: span 2;">
          <span>Search Address (Auto-fill Coordinates)</span>
          <div class="row">
            <input class="input" v-model="addressSearch" placeholder="Ketik alamat: Jakarta, Monas, Surabaya..." @keyup.enter="searchAddress" style="flex: 1;" />
            <button class="btn" @click="searchAddress" :disabled="!addressSearch.trim() || searchingAddress">
              {{ searchingAddress ? 'Searching...' : 'Search' }}
            </button>
            <button class="btn" @click="showMapPicker = true" title="Click map to set coordinates">
              Pick from Map
            </button>
          </div>
        </label>
        <label><span>Latitude</span><input class="input" v-model.number="form.latitude" type="number" step="any" placeholder="-6.200" /></label>
        <label><span>Longitude</span><input class="input" v-model.number="form.longitude" type="number" step="any" placeholder="106.816" /></label>
        <label><span>Status</span><select class="input" v-model="form.enabled"><option :value="true">Enabled</option><option :value="false">Disabled</option></select></label>
      </div>
      <div v-if="error" class="alert error">{{ error }}</div>
      <div v-if="success" class="alert" style="background:#ecfdf5;border:1px solid #bbf7d0;color:#047857">{{ success }}</div>
      <div v-if="warning" class="alert" style="background:#fffbeb;border:1px solid #fde68a;color:#92400e">{{ warning }}</div>
      <div v-if="testResult" class="alert" style="background:#ecfdf5;border:1px solid #bbf7d0;color:#047857">
        SNMP OK: {{ testResult.identity }} · interfaces: {{ testResult.interfaces?.length || 0 }} · counters: {{ testResult.readable_oids?.counters ? 'readable' : 'not detected' }}
        <div class="muted" style="margin-top:4px;color:#047857">{{ testResult.system?.description || 'System OID terbaca' }}</div>
      </div>
      <div class="row" style="margin-top:12px">
        <button class="btn primary" @click="save">{{ editingId ? 'Update' : 'Save' }}</button>
        <button class="btn" @click="testSnmp" :disabled="form.type === 'generic'">Test SNMP</button>
        <button class="btn" @click="reset">Reset</button>
      </div>
    </div>

    <!-- Map Picker Modal -->
    <div v-if="showMapPicker" class="modal-overlay" @click.self="showMapPicker = false">
      <div class="modal-card" style="width:min(720px,95vw);max-height:85vh">
        <div class="modal-header">
          <h3>Click Map to Set Coordinates</h3>
          <button class="btn-close" @click="showMapPicker = false">&times;</button>
        </div>
        <div class="modal-body" style="padding:0">
          <div class="map-picker-search">
            <input class="input" v-model="pickerSearch" placeholder="Search location..." @keyup.enter="searchInPicker" style="flex:1" />
            <button class="btn" @click="searchInPicker" :disabled="!pickerSearch.trim() || searchingPicker">
              {{ searchingPicker ? '...' : 'Go' }}
            </button>
          </div>
          <div id="map-picker" class="map-picker"></div>
          <div class="map-picker-footer">
            <span v-if="pickedCoords">Picked: <b>{{ pickedCoords.lat.toFixed(6) }}, {{ pickedCoords.lng.toFixed(6) }}</b></span>
            <span v-else class="muted">Click on map to select location</span>
            <button v-if="pickedCoords" class="btn primary" @click="applyPickedCoords" style="margin-left:auto">Apply Coordinates</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="!showForm && devices.length === 0" class="empty-state">
      <div class="empty-icon"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg></div>
      <div class="empty-title">No Devices Yet</div>
      <div class="empty-desc">Add your first network device to start monitoring.</div>
      <button class="btn primary" @click="openCreate">+ Add Device</button>
    </div>

    <!-- Table -->
    <div v-else class="table-wrap">
      <table>
        <thead><tr><th>Name</th><th>Mode</th><th>Host</th><th>SNMP</th><th>Site</th><th>Lat/Lng</th><th>Action</th></tr></thead>
        <tbody>
          <tr v-for="d in devices" :key="d.id">
            <td><strong>{{ d.name }}</strong></td>
            <td>{{ d.type === 'snmp' ? 'SNMP + Ping' : 'Ping Only' }}</td>
            <td><code>{{ d.host }}</code></td>
            <td>{{ d.type === 'snmp' ? `${d.snmp_community || 'public'}:${d.snmp_port || 161}` : '-' }}</td>
            <td>{{ d.site || '-' }}</td>
            <td>{{ d.latitude ?? '-' }}, {{ d.longitude ?? '-' }}</td>
            <td>
              <div class="row">
                <button class="btn" @click="editDevice(d)">Edit</button>
                <button class="btn" @click="autoTargets(d)" :disabled="d.type !== 'snmp'">Auto Monitor</button>
                <button class="btn" @click="diagnoseSnmp(d)" :disabled="d.type !== 'snmp'">Diagnose</button>
                <button class="btn danger" @click="del(d.id)">Delete</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup>
import { onMounted, nextTick, reactive, ref, watch } from 'vue';
import { api } from '../services/api.js';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const devices = ref([]);
const showForm = ref(false);
const editingId = ref(null);
const error = ref('');
const testResult = ref(null);
const success = ref('');
const warning = ref('');
const addressSearch = ref('');
const searchingAddress = ref(false);

// Map picker state
const showMapPicker = ref(false);
const pickedCoords = ref(null);
const pickerSearch = ref('');
const searchingPicker = ref(false);
let pickerMap = null;
let pickerMarker = null;

const form = reactive({
  name: '', type: 'snmp', host: '', snmp_community: 'public', snmp_port: 161,
  latitude: null, longitude: null, site: '', enabled: true,
});

async function load() {
  devices.value = await api('/devices');
}

function reset() {
  editingId.value = null;
  error.value = '';
  success.value = '';
  warning.value = '';
  testResult.value = null;
  addressSearch.value = '';
  Object.assign(form, { name: '', type: 'snmp', host: '', snmp_community: 'public', snmp_port: 161, latitude: null, longitude: null, site: '', enabled: true });
}

function openCreate() {
  if (showForm.value && !editingId.value) { showForm.value = false; return; }
  reset();
  showForm.value = true;
}

function closeForm() {
  showForm.value = false;
  reset();
}

function editDevice(d) {
  editingId.value = d.id;
  error.value = '';
  success.value = '';
  warning.value = '';
  testResult.value = null;
  Object.assign(form, {
    name: d.name || '', type: d.type || 'snmp', host: d.host || '',
    snmp_community: d.snmp_community || 'public', snmp_port: d.snmp_port || 161,
    latitude: d.latitude, longitude: d.longitude, site: d.site || '', enabled: d.enabled !== false,
  });
  showForm.value = true;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function payload() {
  if (!form.name.trim()) throw new Error('Nama device wajib diisi');
  if (!form.host.trim()) throw new Error('Host/IP wajib diisi');
  return {
    name: form.name.trim(), type: form.type, host: form.host.trim(),
    snmp_community: form.type === 'snmp' ? (form.snmp_community || 'public') : 'public',
    snmp_port: form.type === 'snmp' ? Number(form.snmp_port || 161) : 161,
    latitude: form.latitude, longitude: form.longitude, site: form.site, enabled: form.enabled,
  };
}

async function testSnmp() {
  error.value = ''; warning.value = ''; testResult.value = null;
  try { testResult.value = await api('/devices/test', { method: 'POST', body: JSON.stringify(payload()) }); }
  catch (e) { error.value = `SNMP gagal: ${e.message}`; }
}

async function save() {
  error.value = ''; success.value = ''; warning.value = '';
  try {
    const body = payload();
    if (editingId.value) {
      await api(`/devices/${editingId.value}`, { method: 'PUT', body: JSON.stringify(body) });
      success.value = 'Device berhasil diupdate.';
    } else {
      await api('/devices', { method: 'POST', body: JSON.stringify(body) });
      success.value = 'Device tersimpan dan monitor ping otomatis dibuat.';
    }
    showForm.value = false;
    reset();
    await load();
  } catch (e) { error.value = e.message; }
}

async function autoTargets(d) {
  error.value = ''; success.value = ''; warning.value = '';
  try {
    const res = await api(`/devices/${d.id}/auto-targets`, { method: 'POST', body: JSON.stringify({ limit: 8 }) });
    const msg = res.count > 0 ? `Berhasil membuat ${res.count} monitor.` : 'Monitor ping sudah aktif.';
    success.value = msg;
    if (res.warnings?.length) warning.value = res.warnings.join(' ');
    alert([msg, warning.value].filter(Boolean).join('\n\n'));
  } catch (e) { error.value = e.message; alert(`Auto Monitor gagal: ${e.message}`); }
}

async function diagnoseSnmp(d) {
  error.value = ''; success.value = ''; warning.value = '';
  try {
    const res = await api(`/devices/${d.id}/snmp-diagnose`);
    const failed = res.checks?.filter((c) => !c.ok).map((c) => `${c.name}: ${c.error || 'no rows'}`).join('\n') || '';
    const ok = res.checks?.filter((c) => c.ok).map((c) => `${c.name}: ${c.rows} rows`).join('\n') || '';
    alert([`SNMP online: ${res.online ? 'YA' : 'TIDAK'}`, `Interface table: ${res.hasInterfaceTable ? 'YA' : 'TIDAK'}`, `Counter traffic: ${res.hasCounters ? 'YA' : 'TIDAK'}`, '', res.advice, ok ? `\nOK:\n${ok}` : '', failed ? `\nGagal:\n${failed}` : ''].join('\n'));
    warning.value = res.advice;
  } catch (e) { error.value = e.message; alert(`Diagnose SNMP gagal: ${e.message}`); }
}

async function del(id) {
  if (!confirm('Delete device ini? Semua monitor & data terkait ikut terhapus.')) return;
  await api(`/devices/${id}`, { method: 'DELETE' });
  if (editingId.value === id) closeForm();
  await load();
}

async function searchAddress() {
  if (!addressSearch.value.trim()) return;
  searchingAddress.value = true;
  error.value = '';
  try {
    const q = encodeURIComponent(addressSearch.value.trim());
    const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`);
    const data = await r.json();
    if (data?.length) {
      form.latitude = parseFloat(data[0].lat);
      form.longitude = parseFloat(data[0].lon);
      success.value = `Found: ${data[0].display_name}`;
      setTimeout(() => { success.value = ''; }, 5000);
    } else { error.value = 'Address not found. Try different keywords.'; setTimeout(() => { error.value = ''; }, 5000); }
  } catch (e) { error.value = `Search failed: ${e.message}`; }
  finally { searchingAddress.value = false; }
}

/* ---- Map Picker ---- */
function initPickerMap() {
  nextTick(() => {
    if (pickerMap) { pickerMap.remove(); pickerMap = null; }
    const el = document.getElementById('map-picker');
    if (!el) return;
    const startLat = form.latitude || -2.5;
    const startLng = form.longitude || 118;
    const startZoom = form.latitude ? 14 : 5;
    pickerMap = L.map('map-picker').setView([startLat, startLng], startZoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OSM' }).addTo(pickerMap);
    if (form.latitude && form.longitude) placePickerMarker(form.latitude, form.longitude);
    pickerMap.on('click', (e) => placePickerMarker(e.latlng.lat, e.latlng.lng));
  });
}

function placePickerMarker(lat, lng) {
  if (pickerMarker) pickerMap.removeLayer(pickerMarker);
  pickerMarker = L.marker([lat, lng], {
    icon: L.divIcon({ className: '', html: '<div style="background:#2563eb;color:white;padding:6px 12px;border-radius:10px;font-size:12px;font-weight:800;box-shadow:0 4px 16px rgba(37,99,235,0.5);white-space:nowrap;">Selected</div>', iconAnchor: [50, 15] })
  }).addTo(pickerMap);
  pickedCoords.value = { lat, lng };
}

function applyPickedCoords() {
  if (!pickedCoords.value) return;
  form.latitude = Number(pickedCoords.value.lat.toFixed(6));
  form.longitude = Number(pickedCoords.value.lng.toFixed(6));
  showMapPicker.value = false;
  success.value = `Coordinates set: ${form.latitude}, ${form.longitude}`;
  setTimeout(() => { success.value = ''; }, 3000);
}

async function searchInPicker() {
  if (!pickerSearch.value.trim()) return;
  searchingPicker.value = true;
  try {
    const q = encodeURIComponent(pickerSearch.value.trim());
    const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`);
    const data = await r.json();
    if (data?.length) {
      pickerMap.setView([parseFloat(data[0].lat), parseFloat(data[0].lon)], 14);
      placePickerMarker(parseFloat(data[0].lat), parseFloat(data[0].lon));
    }
  } catch (e) { console.error(e); }
  finally { searchingPicker.value = false; }
}

watch(showMapPicker, (val) => {
  if (val) { pickedCoords.value = null; pickerSearch.value = ''; setTimeout(() => initPickerMap(), 150); }
  else { if (pickerMap) { pickerMap.remove(); pickerMap = null; pickerMarker = null; } }
});

onMounted(load);
</script>
