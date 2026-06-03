<template>
  <section class="card">
    <div class="row" style="justify-content:space-between;margin-bottom:12px">
      <strong style="font-size:15px;display:flex;align-items:center;gap:8px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg> Monitors</strong>
      <div class="row">
        <button class="btn primary" @click="openCreate">+ Add Monitor</button>
        <button class="btn" @click="quickAddPing">Quick Ping</button>
      </div>
    </div>

    <div v-if="showForm" class="monitor-form">
      <div class="row" style="justify-content:space-between">
        <strong>{{ editingId ? 'Edit Monitor' : 'Create Monitor' }}</strong>
        <button class="btn" @click="closeForm">Close</button>
      </div>

      <div class="form-grid">
        <label>
          <span>Type</span>
          <select class="input" v-model="form.kind" @change="onKindChange">
            <option value="ping">Ping / ICMP</option>
            <option value="tcp">TCP Port</option>
            <option value="snmp_iface">SNMP Interface Traffic</option>
          </select>
        </label>
        <label>
          <span>Name</span>
          <input class="input" v-model="form.name" placeholder="Contoh: POP Main Router" />
        </label>
        <label v-if="form.kind !== 'snmp_iface'">
          <span>Host / IP</span>
          <input class="input" v-model="form.host" placeholder="192.168.1.1" />
        </label>
        <label v-if="form.kind === 'tcp'">
          <span>Port</span>
          <input class="input" v-model.number="form.port" type="number" placeholder="443" />
        </label>
        <label v-if="form.kind === 'snmp_iface'">
          <span>Device SNMP</span>
          <select class="input" v-model.number="form.device_id" @change="loadInterfaces">
            <option :value="null">Pilih device</option>
            <option v-for="d in snmpDevices" :key="d.id" :value="d.id">{{ d.name }} - {{ d.host }}</option>
          </select>
        </label>
        <label v-if="form.kind === 'snmp_iface'">
          <span>Interface</span>
          <div class="row" style="gap:6px">
            <select class="input" style="flex:1" v-model="form.iface" :disabled="loadingInterfaces || interfaces.length === 0">
              <option value="">{{ interfacePlaceholder }}</option>
              <option v-for="i in interfaces" :key="`${i.index}-${i.name}`" :value="i.name">
                {{ i.name }} · {{ i.type || 'snmp' }} · {{ i.running ? 'up' : 'down' }} · {{ bps(i.speed_bps) }}
              </option>
            </select>
            <button class="btn" @click="loadInterfaces" type="button" :disabled="loadingInterfaces || !form.device_id">{{ loadingInterfaces ? 'Loading...' : 'Load' }}</button>
          </div>
        </label>
        <label>
          <span>Status</span>
          <select class="input" v-model="form.enabled">
            <option :value="true">Enabled</option>
            <option :value="false">Disabled</option>
          </select>
        </label>
      </div>

      <div v-if="formError" class="alert error">{{ formError }}</div>
  <div v-if="formWarning" class="alert" style="background:#fffbeb;border:1px solid #fde68a;color:#92400e">{{ formWarning }}</div>
      <div class="row" style="margin-top:12px">
        <button class="btn primary" @click="save">{{ editingId ? 'Update Monitor' : 'Save Monitor' }}</button>
        <button class="btn" @click="resetForm">Reset</button>
      </div>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Name</th><th>Kind</th><th>Target</th><th>Status</th><th>RTT</th><th>Traffic</th><th>SLA</th><th>Action</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="t in targets" :key="t.id">
            <td>{{ t.name }}</td>
            <td>{{ t.kind }}</td>
            <td>{{ targetText(t) }}</td>
            <td><span class="badge" :class="statusClass(t.state?.status)">{{ t.state?.status || 'unknown' }}</span></td>
            <td>{{ t.state?.rtt_ms ? Number(t.state.rtt_ms).toFixed(1) + ' ms' : '-' }}</td>
            <td>
              <span v-if="t.state?.rx_bps != null">↓ {{ bps(t.state.rx_bps) }} / ↑ {{ bps(t.state.tx_bps) }}</span>
              <span v-else>-</span>
            </td>
            <td>{{ t.sla?.uptime_pct != null ? Number(t.sla.uptime_pct).toFixed(3) + '%' : '-' }}</td>
            <td>
              <div class="row">
                <button class="btn" @click="selectTarget(t)">History</button>
                <button class="btn" @click="editTarget(t)">Edit</button>
                <button class="btn danger" @click="del(t.id)">Delete</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <section v-if="selected" class="card">
    <div class="row" style="justify-content:space-between;margin-bottom:10px">
      <div>
        <strong>History: {{ selected.name }}</strong>
        <div class="muted">{{ selected.kind }} · {{ targetText(selected) }}</div>
      </div>
      <div class="row">
        <select class="input" v-model.number="historyHours" @change="loadHistory(selected)">
          <option :value="1">1h</option><option :value="6">6h</option><option :value="24">24h</option><option :value="168">7d</option>
        </select>
        <button class="btn" @click="selected = null">Close</button>
      </div>
    </div>
    <div class="chart-grid">
      <div class="mini-chart">
        <div class="muted">Latency / RTT</div>
        <svg viewBox="0 0 600 170" preserveAspectRatio="none">
          <polyline :points="rttPoints" fill="none" stroke="#38bdf8" stroke-width="3" />
        </svg>
      </div>
      <div class="mini-chart">
        <div class="muted">Traffic RX/TX</div>
        <svg viewBox="0 0 600 170" preserveAspectRatio="none">
          <polyline :points="rxPoints" fill="none" stroke="#10b981" stroke-width="3" />
          <polyline :points="txPoints" fill="none" stroke="#f59e0b" stroke-width="3" />
        </svg>
      </div>
    </div>
    <div class="muted" style="margin-top:8px">Samples: {{ history.length }}</div>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { api } from '../services/api.js';

const targets = ref([]);
const devices = ref([]);
const interfaces = ref([]);
const showForm = ref(false);
const editingId = ref(null);
const formError = ref('');
const formWarning = ref('');
const loadingInterfaces = ref(false);
const selected = ref(null);
const history = ref([]);
const historyHours = ref(24);

const form = reactive({ kind: 'ping', name: '', host: '', port: 80, device_id: null, iface: '', enabled: true });
const snmpDevices = computed(() => devices.value.filter((d) => d.type === 'snmp'));
const interfacePlaceholder = computed(() => {
  if (!form.device_id) return 'Pilih device dulu';
  if (loadingInterfaces.value) return 'Loading interface...';
  if (interfaces.value.length === 0) return 'Interface belum terbaca';
  return 'Pilih interface';
});

const rttPoints = computed(() => points(history.value.map((x) => x.rtt_ms)));
const rxPoints = computed(() => points(history.value.map((x) => x.rx_bps)));
const txPoints = computed(() => points(history.value.map((x) => x.tx_bps)));

function statusClass(s) {
  if (s === 'up') return 'up';
  if (s === 'down') return 'down';
  return 'unknown';
}
function targetText(t) {
  if (t.kind === 'snmp_iface') return `${t.device_name || 'device'} · iface:${t.iface}`;
  if (t.kind === 'mikrotik_iface') return `${t.device_name || 'device'} · iface:${t.iface}`;
  if (t.kind === 'tcp') return `${t.host}:${t.port}`;
  return t.host || '-';
}
function bps(v) {
  let n = Number(v || 0);
  const u = ['bps', 'Kbps', 'Mbps', 'Gbps'];
  let i = 0;
  while (n >= 1000 && i < u.length - 1) { n /= 1000; i++; }
  return `${n.toFixed(i ? 2 : 0)} ${u[i]}`;
}

async function load() {
  const [targetRows, deviceRows] = await Promise.all([api('/targets'), api('/devices')]);
  targets.value = targetRows;
  devices.value = deviceRows;
}

function openCreate() {
  resetForm();
  showForm.value = true;
}

function closeForm() {
  showForm.value = false;
  formError.value = '';
  formWarning.value = '';
}

function resetForm() {
  editingId.value = null;
  interfaces.value = [];
  formError.value = '';
  formWarning.value = '';
  loadingInterfaces.value = false;
  Object.assign(form, { kind: 'ping', name: '', host: '', port: 80, device_id: null, iface: '', enabled: true });
}

function onKindChange() {
  formError.value = '';
  formWarning.value = '';
  if (form.kind === 'tcp' && !form.port) form.port = 80;
  if (form.kind !== 'snmp_iface') {
    form.device_id = null;
    form.iface = '';
    interfaces.value = [];
  }
}

async function loadInterfaces() {
  if (!form.device_id) return;
  formError.value = '';
  formWarning.value = '';
  form.iface = '';
  loadingInterfaces.value = true;
  try {
    interfaces.value = await api(`/devices/${form.device_id}/interfaces`);
    if (interfaces.value.length === 0) {
      const diag = await api(`/devices/${form.device_id}/snmp-diagnose`).catch(() => null);
      formWarning.value = diag?.advice || 'Interface SNMP belum terbaca. Pastikan SNMP RouterOS aktif dan UDP 161 diizinkan.';
    }
  } catch (e) {
    formError.value = `Gagal load interface: ${e.message}`;
  } finally {
    loadingInterfaces.value = false;
  }
}

function payload() {
  const base = { kind: form.kind, name: form.name.trim(), enabled: form.enabled };
  if (!base.name) throw new Error('Nama monitor wajib diisi');
  if (form.kind === 'ping') {
    if (!form.host) throw new Error('Host/IP wajib diisi');
    return { ...base, host: form.host.trim(), port: null, device_id: null, iface: null };
  }
  if (form.kind === 'tcp') {
    if (!form.host) throw new Error('Host/IP wajib diisi');
    if (!form.port) throw new Error('Port wajib diisi');
    return { ...base, host: form.host.trim(), port: Number(form.port), device_id: null, iface: null };
  }
  if (!form.device_id) throw new Error('Device SNMP wajib dipilih');
  if (!form.iface) throw new Error('Interface wajib dipilih');
  return { ...base, host: null, port: null, device_id: form.device_id, iface: form.iface };
}

async function save() {
  formError.value = '';
  try {
    const body = JSON.stringify(payload());
    if (editingId.value) await api(`/targets/${editingId.value}`, { method: 'PUT', body });
    else await api('/targets', { method: 'POST', body });
    closeForm();
    resetForm();
    await load();
  } catch (e) {
    formError.value = e.message;
  }
}

async function editTarget(t) {
  showForm.value = true;
  editingId.value = t.id;
  Object.assign(form, {
    kind: t.kind,
    name: t.name,
    host: t.host || '',
    port: t.port || 80,
    device_id: t.device_id || null,
    iface: t.iface || '',
    enabled: !!t.enabled,
  });
  if (t.kind === 'snmp_iface') await loadInterfaces();
}

async function selectTarget(t) {
  selected.value = t;
  await loadHistory(t);
}

async function loadHistory(t) {
  history.value = await api(`/targets/${t.id}/history?hours=${historyHours.value}`);
}

function points(values) {
  const nums = values.map((v) => Number(v || 0));
  if (!nums.length) return '';
  const max = Math.max(...nums, 1);
  return nums.map((v, i) => {
    const x = nums.length === 1 ? 0 : (i / (nums.length - 1)) * 600;
    const y = 160 - (v / max) * 140;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

async function del(id) {
  if (!confirm('Delete monitor?')) return;
  await api(`/targets/${id}`, { method: 'DELETE' });
  await load();
}

async function quickAddPing() {
  await api('/targets', {
    method: 'POST',
    body: JSON.stringify({ kind: 'ping', name: 'Google DNS', host: '8.8.8.8', enabled: true }),
  });
  await load();
}

onMounted(load);
</script>
