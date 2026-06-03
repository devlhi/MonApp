<template>
  <section class="card ai-page">
    <div class="row" style="justify-content:space-between;margin-bottom:14px">
      <div>
        <strong>AI Settings</strong>
        <div class="muted">Konfigurasi API AI, endpoint, secret router, model, dan kredensial untuk fitur AI monitoring.</div>
      </div>
      <button class="btn" @click="load">Reload</button>
    </div>

    <div v-if="saved" class="alert" style="background:#ecfdf5;border:1px solid #bbf7d0;color:#047857">Konfigurasi berhasil disimpan.</div>
    <div v-if="error" class="alert error">{{ error }}</div>

    <!-- AI API Config -->
    <div class="ai-section">
      <div class="ai-section-title">
        <span class="ai-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="15" x2="23" y2="15"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="15" x2="4" y2="15"/></svg></span>
        <div>
          <strong>AI API Configuration</strong>
          <div class="muted">Endpoint dan kredensial untuk AI analysis.</div>
        </div>
      </div>
      <div class="ai-form-grid">
        <label>
          <span>AI Provider</span>
          <select class="input" v-model="form.ai_provider">
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="gemini">Google Gemini</option>
            <option value="ollama">Ollama (Local)</option>
            <option value="custom">Custom API</option>
          </select>
        </label>
        <label>
          <span>AI API Endpoint</span>
          <input class="input" v-model="form.ai_endpoint" placeholder="https://api.openai.com/v1/chat/completions" />
        </label>
        <label>
          <span>AI API Key</span>
          <div class="input-group">
            <input class="input" :type="showKey ? 'text' : 'password'" v-model="form.ai_api_key" placeholder="sk-..." />
            <button class="btn btn-eye" @click="showKey = !showKey"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path v-if="!showKey" d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle v-if="!showKey" cx="12" cy="12" r="3"/><path v-if="showKey" d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><line v-if="showKey" x1="1" y1="1" x2="23" y2="23"/></svg></button>
          </div>
        </label>
        <label>
          <span>AI Model</span>
          <input class="input" v-model="form.ai_model" placeholder="gpt-4o / claude-3 / gemini-pro / llama3" />
        </label>
        <label>
          <span>Temperature</span>
          <input class="input" type="number" v-model.number="form.ai_temperature" min="0" max="2" step="0.1" placeholder="0.7" />
        </label>
        <label>
          <span>Max Tokens</span>
          <input class="input" type="number" v-model.number="form.ai_max_tokens" min="100" max="128000" step="100" placeholder="4096" />
        </label>
      </div>
    </div>

    <!-- Router SNMP Secrets -->
    <div class="ai-section">
      <div class="ai-section-title">
        <span class="ai-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span>
        <div>
          <strong>Router SNMP Secrets</strong>
          <div class="muted">Community string dan kredensial SNMP untuk setiap device/router.</div>
        </div>
      </div>
      <div v-if="devices.length === 0" class="muted" style="padding:12px">Belum ada device. Tambahkan device terlebih dahulu di menu Devices.</div>
      <div v-for="d in devices" :key="d.id" class="router-secret-card">
        <div class="router-secret-header">
          <span :class="['status-dot', d.type === 'snmp' ? 'ok' : '']"></span>
          <strong>{{ d.name }}</strong>
          <span class="muted">{{ d.host }}</span>
          <span class="badge-sm">{{ d.type }}</span>
        </div>
        <div class="ai-form-grid" v-if="d.type === 'snmp'">
          <label>
            <span>SNMP Community</span>
            <input class="input" :value="getDeviceSecret(d.id)?.community" @input="updateDeviceSecret(d.id, 'community', $event.target.value)" placeholder="public" />
          </label>
          <label>
            <span>SNMP Port</span>
            <input class="input" type="number" :value="getDeviceSecret(d.id)?.port || 161" @input="updateDeviceSecret(d.id, 'port', $event.target.value)" placeholder="161" />
          </label>
          <label>
            <span>SNMP Version</span>
            <select class="input" :value="getDeviceSecret(d.id)?.version || '2c'" @change="updateDeviceSecret(d.id, 'version', $event.target.value)">
              <option value="1">v1</option>
              <option value="2c">v2c</option>
              <option value="3">v3</option>
            </select>
          </label>
          <label v-if="getDeviceSecret(d.id)?.version === '3'">
            <span>SNMPv3 Username</span>
            <input class="input" :value="getDeviceSecret(d.id)?.v3_user || ''" @input="updateDeviceSecret(d.id, 'v3_user', $event.target.value)" placeholder="snmpadmin" />
          </label>
          <label v-if="getDeviceSecret(d.id)?.version === '3'">
            <span>SNMPv3 Auth Password</span>
            <input class="input" type="password" :value="getDeviceSecret(d.id)?.v3_auth || ''" @input="updateDeviceSecret(d.id, 'v3_auth', $event.target.value)" placeholder="auth password" />
          </label>
          <label v-if="getDeviceSecret(d.id)?.version === '3'">
            <span>SNMPv3 Priv Password</span>
            <input class="input" type="password" :value="getDeviceSecret(d.id)?.v3_priv || ''" @input="updateDeviceSecret(d.id, 'v3_priv', $event.target.value)" placeholder="priv password" />
          </label>
        </div>
        <div v-else class="muted" style="padding:8px">Device ini menggunakan Ping Only, tidak perlu SNMP secret.</div>
      </div>
    </div>

    <!-- AI Feature Toggles -->
    <div class="ai-section">
      <div class="ai-section-title">
        <span class="ai-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></span>
        <div>
          <strong>AI Features</strong>
          <div class="muted">Aktifkan atau nonaktifkan fitur AI.</div>
        </div>
      </div>
      <div class="ai-toggle-grid">
        <label class="toggle-item">
          <input type="checkbox" v-model="form.ai_auto_diagnose" />
          <div>
            <strong>Auto Diagnose SNMP</strong>
            <span>Otomatis analisis OID timeout/kurang saat device ditambahkan.</span>
          </div>
        </label>
        <label class="toggle-item">
          <input type="checkbox" v-model="form.ai_traffic_analysis" />
          <div>
            <strong>Traffic Anomaly Detection</strong>
            <span>Deteksi traffic spike/anomali menggunakan AI.</span>
          </div>
        </label>
        <label class="toggle-item">
          <input type="checkbox" v-model="form.ai_sfp_monitoring" />
          <div>
            <strong>SFP Power Monitoring</strong>
            <span>Monitor optical power SFP dan alert jika di bawah threshold.</span>
          </div>
        </label>
        <label class="toggle-item">
          <input type="checkbox" v-model="form.ai_interface_predict" />
          <div>
            <strong>Interface Failure Prediction</strong>
            <span>Prediksi potensi interface down berdasarkan error counter.</span>
          </div>
        </label>
      </div>
    </div>

    <!-- Smart OID Scanner -->
    <div class="ai-section">
      <div class="ai-section-title">
        <span class="ai-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>
        <div>
          <strong>Smart OID Scanner</strong>
          <div class="muted">Test scan OID pada device untuk melihat kemampuan SNMP.</div>
        </div>
      </div>
      <div class="ai-control" style="margin:0;background:transparent;border:none;padding:0">
        <label>
          <span>Pilih Device</span>
          <select class="input" v-model.number="deviceId">
            <option :value="0">Pilih device SNMP...</option>
            <option v-for="d in snmpDevices" :key="d.id" :value="d.id">{{ d.name }} · {{ d.host }}</option>
          </select>
        </label>
        <button class="btn primary" @click="scan" :disabled="!deviceId || loading">{{ loading ? 'Scanning...' : 'Run Scan' }}</button>
      </div>

      <div v-if="scanResult" class="ai-result-grid" style="margin-top:14px">
        <div class="ai-score-card">
          <div class="ai-score-ring" :style="{ '--score': `${scanResult.score || 0}%` }">
            <b>{{ scanResult.score || 0 }}%</b>
            <span>Score</span>
          </div>
          <div>
            <strong>{{ selectedDevice?.name }}</strong>
            <div class="muted">{{ scanResult.readable }}/{{ scanResult.total }} OID terbaca</div>
          </div>
        </div>
        <div class="ai-capability-card">
          <div class="cap-grid">
            <div :class="['cap-item', scanResult.capability?.system ? 'ok' : 'bad']"><b>Sys</b><span>{{ scanResult.capability?.system ? '✓' : '✗' }}</span></div>
            <div :class="['cap-item', scanResult.capability?.interface ? 'ok' : 'bad']"><b>Iface</b><span>{{ scanResult.capability?.interface ? '✓' : '✗' }}</span></div>
            <div :class="['cap-item', scanResult.capability?.traffic ? 'ok' : 'bad']"><b>Traffic</b><span>{{ scanResult.capability?.traffic ? '✓' : '✗' }}</span></div>
            <div :class="['cap-item', scanResult.capability?.sfp_power ? 'ok' : 'bad']"><b>SFP</b><span>{{ scanResult.capability?.sfp_power ? '✓' : '✗' }}</span></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Save -->
    <div class="row" style="margin-top:16px;justify-content:flex-end">
      <button class="btn primary" @click="save" :disabled="saving">{{ saving ? 'Saving...' : 'Save All Settings' }}</button>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { api } from '../services/api.js';

const devices = ref([]);
const saved = ref(false);
const error = ref('');
const saving = ref(false);
const showKey = ref(false);
const deviceId = ref(0);
const scanResult = ref(null);
const loading = ref(false);
const deviceSecrets = ref({});

const form = reactive({
  ai_provider: 'openai',
  ai_endpoint: '',
  ai_api_key: '',
  ai_model: '',
  ai_temperature: 0.7,
  ai_max_tokens: 4096,
  ai_auto_diagnose: true,
  ai_traffic_analysis: false,
  ai_sfp_monitoring: true,
  ai_interface_predict: false,
});

const snmpDevices = computed(() => devices.value.filter((d) => d.type === 'snmp'));
const selectedDevice = computed(() => devices.value.find((d) => d.id === deviceId.value));

async function load() {
  devices.value = await api('/devices');
  try {
    const settings = await api('/settings');
    if (settings.ai_settings) {
      Object.assign(form, settings.ai_settings);
    }
    if (settings.device_secrets) {
      deviceSecrets.value = settings.device_secrets;
    }
    if (!deviceId.value && snmpDevices.value.length) deviceId.value = snmpDevices.value[0].id;
  } catch {}
}

function getDeviceSecret(id) {
  return deviceSecrets.value[String(id)] || {};
}

function updateDeviceSecret(id, field, value) {
  const key = String(id);
  if (!deviceSecrets.value[key]) deviceSecrets.value[key] = {};
  deviceSecrets.value[key][field] = value;
}

async function save() {
  saving.value = true;
  error.value = '';
  saved.value = false;
  try {
    await api('/settings', {
      method: 'PUT',
      body: JSON.stringify({
        ai_settings: { ...form },
        device_secrets: { ...deviceSecrets.value },
      }),
    });
    saved.value = true;
    setTimeout(() => { saved.value = false; }, 3000);
  } catch (e) {
    error.value = e.message;
  } finally {
    saving.value = false;
  }
}

async function scan() {
  if (!deviceId.value) return;
  loading.value = true;
  scanResult.value = null;
  try {
    scanResult.value = await api(`/devices/${deviceId.value}/smart-oid-scan`);
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>
