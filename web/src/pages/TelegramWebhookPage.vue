<template>
  <section class="card ai-page">
    <div class="row" style="justify-content:space-between;margin-bottom:14px">
      <div>
        <strong>Telegram Webhook</strong>
        <div class="muted">Konfigurasi bot Telegram untuk alert SFP, interface down, SNMP timeout, dan monitoring MikroTik.</div>
      </div>
      <button class="btn" @click="load">Reload</button>
    </div>

    <div v-if="saved" class="alert" style="background:#ecfdf5;border:1px solid #bbf7d0;color:#047857">{{ savedMsg }}</div>
    <div v-if="error" class="alert error">{{ error }}</div>

    <!-- Bot Config -->
    <div class="ai-section">
      <div class="ai-section-title">
        <span class="ai-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></span>
        <div>
          <strong>Bot Configuration</strong>
          <div class="muted">Masukkan token bot Telegram dan Chat ID untuk mengirim notifikasi alert.</div>
        </div>
      </div>
      <div class="ai-form-grid">
        <label>
          <span>Bot Token</span>
          <div class="input-group">
            <input class="input" :type="showToken ? 'text' : 'password'" v-model="form.bot_token" placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11" />
            <button class="btn btn-eye" @click="showToken = !showToken"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path v-if="!showToken" d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle v-if="!showToken" cx="12" cy="12" r="3"/><path v-if="showToken" d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><line v-if="showToken" x1="1" y1="1" x2="23" y2="23"/></svg></button>
          </div>
        </label>
        <label>
          <span>Chat ID</span>
          <input class="input" v-model="form.chat_id" placeholder="-1001234567890 / 12345678" />
        </label>
        <label>
          <span>Bot Username</span>
          <input class="input" v-model="form.bot_username" placeholder="@YourNetworkBot" />
        </label>
        <label>
          <span>Alert Severity</span>
          <select class="input" v-model="form.severity">
            <option value="all">All Alerts</option>
            <option value="critical">Critical Only</option>
            <option value="warning">Warning & Critical</option>
          </select>
        </label>
      </div>
      <div class="row" style="margin-top:12px">
        <button class="btn primary" @click="saveBot" :disabled="saving">{{ saving ? 'Saving...' : 'Save Bot Config' }}</button>
        <button class="btn" @click="testTelegram" :disabled="testing">
          {{ testing ? 'Sending...' : 'Send Test Message' }}
        </button>
      </div>
    </div>

    <!-- Webhook Config -->
    <div class="ai-section">
      <div class="ai-section-title">
        <span class="ai-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg></span>
        <div>
          <strong>Webhook Configuration</strong>
          <div class="muted">Set webhook URL untuk menerima pesan/command dari Telegram. Membutuhkan domain dengan HTTPS.</div>
        </div>
      </div>
      <div class="ai-form-grid">
        <label>
          <span>AppMon Public URL (HTTPS)</span>
          <input class="input" v-model="form.webhook_url" placeholder="https://appmon.domain.com/api/telegram/webhook" />
        </label>
      </div>
      <div class="row" style="margin-top:12px;gap:8px">
        <button class="btn primary" @click="setWebhook" :disabled="settingWebhook">{{ settingWebhook ? 'Processing...' : 'Set Webhook' }}</button>
        <button class="btn" @click="unsetWebhook" :disabled="unsettingWebhook">Unset Webhook</button>
        <button class="btn" @click="setCommands" :disabled="settingCommands">Set Bot Menu (/cekredaman)</button>
      </div>
    </div>

    <!-- Alert Rules -->
    <div class="ai-section">
      <div class="ai-section-title">
        <span class="ai-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></span>
        <div>
          <strong>Alert Rules</strong>
          <div class="muted">Atur threshold dan kondisi kapan alert dikirim ke Telegram.</div>
        </div>
      </div>
      <div class="ai-toggle-grid">
        <label class="toggle-item">
          <input type="checkbox" v-model="form.alert_sfp_low_power" />
          <div>
            <strong>SFP Low Power Alert</strong>
            <span>Kirim alert jika optical power SFP di bawah threshold (dBm).</span>
          </div>
        </label>
        <label class="toggle-item">
          <input type="checkbox" v-model="form.alert_interface_down" />
          <div>
            <strong>Interface Down Alert</strong>
            <span>Kirim alert saat interface/router port down.</span>
          </div>
        </label>
        <label class="toggle-item">
          <input type="checkbox" v-model="form.alert_snmp_timeout" />
          <div>
            <strong>SNMP Timeout Alert</strong>
            <span>Kirim alert jika device SNMP tidak merespons.</span>
          </div>
        </label>
        <label class="toggle-item">
          <input type="checkbox" v-model="form.alert_high_traffic" />
          <div>
            <strong>High Traffic Alert</strong>
            <span>Kirim alert jika traffic melebihi batas normal (spike).</span>
          </div>
        </label>
        <label class="toggle-item">
          <input type="checkbox" v-model="form.alert_device_offline" />
          <div>
            <strong>Device Offline Alert</strong>
            <span>Kirim alert jika device ping timeout/offline.</span>
          </div>
        </label>
        <label class="toggle-item">
          <input type="checkbox" v-model="form.alert_sfp_missing" />
          <div>
            <strong>SFP Missing / Not Detected</strong>
            <span>Kirim alert jika SFP tidak terdeteksi di port yang diharapkan.</span>
          </div>
        </label>
      </div>
      <div class="ai-form-grid" style="margin-top:12px">
        <label>
          <span>SFP Power Threshold (dBm)</span>
          <input class="input" type="number" v-model.number="form.sfp_power_threshold" placeholder="-20" step="1" />
        </label>
        <label>
          <span>Traffic Threshold (Mbps)</span>
          <input class="input" type="number" v-model.number="form.traffic_threshold_mbps" placeholder="1000" step="100" />
        </label>
        <label>
          <span>Check Interval (seconds)</span>
          <input class="input" type="number" v-model.number="form.check_interval" placeholder="60" step="10" />
        </label>
        <label>
          <span>Alert Cooldown (minutes)</span>
          <input class="input" type="number" v-model.number="form.alert_cooldown" placeholder="15" step="5" />
        </label>
      </div>
    </div>

    <!-- MikroTik SFP / Interface Config -->
    <div class="ai-section">
      <div class="ai-section-title">
        <span class="ai-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg></span>
        <div>
          <strong>MikroTik SFP & Interface Monitoring</strong>
          <div class="muted">OID khusus MikroTik untuk membaca data SFP power, temperature, voltage, dan interface status.</div>
        </div>
      </div>
      <div class="ai-form-grid">
        <label>
          <span>SFP Power OID (Rx/Tx)</span>
          <input class="input" v-model="form.oid_sfp_power" placeholder="IF-MIB::ifTable or custom OID" />
        </label>
        <label>
          <span>SFP Temperature OID</span>
          <input class="input" v-model="form.oid_sfp_temp" placeholder="MIKTROK-MIB::sfpTemperature" />
        </label>
        <label>
          <span>SFP Voltage OID</span>
          <input class="input" v-model="form.oid_sfp_voltage" placeholder="MIKTROK-MIB::sfpVoltage" />
        </label>
        <label>
          <span>Interface Status OID</span>
          <input class="input" v-model="form.oid_interface_status" placeholder="IF-MIB::ifOperStatus" />
        </label>
        <label>
          <span>Interface Speed OID</span>
          <input class="input" v-model="form.oid_interface_speed" placeholder="IF-MIB::ifHighSpeed" />
        </label>
        <label>
          <span>Interface Errors OID</span>
          <input class="input" v-model="form.oid_interface_errors" placeholder="IF-MIB::ifInErrors, IF-MIB::ifOutErrors" />
        </label>
      </div>
    </div>

    <!-- Alert Log Preview -->
    <div class="ai-section">
      <div class="ai-section-title">
        <span class="ai-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg></span>
        <div>
          <strong>Alert Log</strong>
          <div class="muted">Log alert yang sudah dikirim ke Telegram.</div>
        </div>
      </div>
      <div v-if="alertLogs.length === 0" class="muted" style="padding:12px">Belum ada alert terkirim.</div>
      <div v-for="log in alertLogs" :key="log.id" class="alert-log-item">
        <div class="alert-log-meta">
          <span :class="['alert-severity-badge', log.severity]">{{ log.severity }}</span>
          <span class="alert-log-type">{{ log.type }}</span>
          <span class="alert-log-time">{{ formatTime(log.timestamp) }}</span>
        </div>
        <div class="alert-log-msg">{{ log.message }}</div>
      </div>
    </div>

    <!-- Save -->
    <div class="row" style="margin-top:16px;justify-content:flex-end">
      <button class="btn primary" @click="saveAll" :disabled="saving">{{ saving ? 'Saving...' : 'Save All Settings' }}</button>
    </div>
  </section>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { api } from '../services/api.js';

const saved = ref(false);
const savedMsg = ref('');
const error = ref('');
const saving = ref(false);
const testing = ref(false);
const settingWebhook = ref(false);
const unsettingWebhook = ref(false);
const settingCommands = ref(false);
const showToken = ref(false);
const alertLogs = ref([]);

const form = reactive({
  bot_token: '',
  chat_id: '',
  bot_username: '',
  webhook_url: '',
  severity: 'all',
  alert_sfp_low_power: true,
  alert_interface_down: true,
  alert_snmp_timeout: true,
  alert_high_traffic: false,
  alert_device_offline: true,
  alert_sfp_missing: true,
  sfp_power_threshold: -20,
  traffic_threshold_mbps: 1000,
  check_interval: 60,
  alert_cooldown: 15,
  oid_sfp_power: '',
  oid_sfp_temp: '',
  oid_sfp_voltage: '',
  oid_interface_status: '1.3.6.1.2.1.2.2.1.8',
  oid_interface_speed: '1.3.6.1.2.1.31.1.1.1.15',
  oid_interface_errors: '1.3.6.1.2.1.2.2.1.14, 1.3.6.1.2.1.2.2.1.20',
});

async function load() {
  try {
    const settings = await api('/settings');
    if (settings.telegram_settings) {
      Object.assign(form, settings.telegram_settings);
    }
    if (settings.telegram_alert_logs) {
      alertLogs.value = settings.telegram_alert_logs;
    }
  } catch {}
}

async function saveBot() {
  saving.value = true;
  error.value = '';
  saved.value = false;
  try {
    await api('/settings', {
      method: 'PUT',
      body: JSON.stringify({
        telegram_settings: { ...form },
      }),
    });
    saved.value = true;
    savedMsg.value = 'Bot configuration saved.';
    setTimeout(() => { saved.value = false; }, 3000);
  } catch (e) {
    error.value = e.message;
  } finally {
    saving.value = false;
  }
}

async function saveAll() {
  saving.value = true;
  error.value = '';
  saved.value = false;
  try {
    await api('/settings', {
      method: 'PUT',
      body: JSON.stringify({
        telegram_settings: { ...form },
      }),
    });
    saved.value = true;
    savedMsg.value = 'All Telegram settings saved.';
    setTimeout(() => { saved.value = false; }, 3000);
  } catch (e) {
    error.value = e.message;
  } finally {
    saving.value = false;
  }
}

async function testTelegram() {
  testing.value = true;
  error.value = '';
  try {
    const res = await api('/telegram/test', {
      method: 'POST',
      body: JSON.stringify({
        bot_token: form.bot_token,
        chat_id: form.chat_id,
      }),
    });
    saved.value = true;
    savedMsg.value = res.message || 'Test message sent to Telegram!';
    setTimeout(() => { saved.value = false; }, 3000);
  } catch (e) {
    error.value = e.message;
  } finally {
    testing.value = false;
  }
}

async function setWebhook() {
  settingWebhook.value = true;
  error.value = '';
  try {
    const res = await api('/telegram/set-webhook', {
      method: 'POST',
      body: JSON.stringify({ url: form.webhook_url }),
    });
    saved.value = true;
    savedMsg.value = res.message || 'Webhook berhasil diset.';
    setTimeout(() => { saved.value = false; }, 3000);
  } catch (e) {
    error.value = e.message;
  } finally {
    settingWebhook.value = false;
  }
}

async function unsetWebhook() {
  unsettingWebhook.value = true;
  error.value = '';
  try {
    const res = await api('/telegram/unset-webhook', { method: 'POST' });
    saved.value = true;
    savedMsg.value = res.message || 'Webhook berhasil dihapus.';
    setTimeout(() => { saved.value = false; }, 3000);
  } catch (e) {
    error.value = e.message;
  } finally {
    unsettingWebhook.value = false;
  }
}

async function setCommands() {
  settingCommands.value = true;
  error.value = '';
  try {
    const res = await api('/telegram/set-commands', { method: 'POST' });
    saved.value = true;
    savedMsg.value = res.message || 'Menu bot berhasil diupdate.';
    setTimeout(() => { saved.value = false; }, 3000);
  } catch (e) {
    error.value = e.message;
  } finally {
    settingCommands.value = false;
  }
}

function formatTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleString('id-ID', { hour12: false });
}

onMounted(load);</script>
