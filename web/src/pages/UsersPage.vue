<template>
  <section class="card">
    <div class="row" style="justify-content:space-between;margin-bottom:18px">
      <div>
        <strong>Pengguna</strong>
        <div class="muted">Kelola akun login Admin dan NOC.</div>
      </div>
      <button class="btn primary" @click="openAdd">+ Tambah Pengguna</button>
    </div>

    <!-- User table -->
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>#</th>
            <th>Username</th>
            <th>Role</th>
            <th>Dibuat</th>
            <th>Aksi</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading"><td colspan="5" class="muted" style="text-align:center;padding:24px;">Memuat…</td></tr>
          <tr v-else-if="!users.length"><td colspan="5" class="muted" style="text-align:center;padding:24px;">Belum ada pengguna.</td></tr>
          <tr v-for="u in users" :key="u.id">
            <td>{{ u.id }}</td>
            <td>
              <span class="user-avatar-mini">{{ u.username[0].toUpperCase() }}</span>
              {{ u.username }}
              <span v-if="u.id === currentUser?.id" class="badge-self">Anda</span>
            </td>
            <td>
              <span class="role-badge" :class="u.role">{{ u.role }}</span>
            </td>
            <td class="muted" style="font-size:12px">{{ fmtDate(u.created_at) }}</td>
            <td>
              <button class="btn btn-sm" style="margin-right:6px;display:inline-flex;align-items:center;" @click="openChangePassword(u)">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px;"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
                Password
              </button>
              <button
                class="btn btn-sm danger"
                style="display:inline-flex;align-items:center;"
                :disabled="u.id === currentUser?.id"
                :title="u.id === currentUser?.id ? 'Tidak bisa menghapus akun sendiri' : ''"
                @click="deleteUser(u)"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                Hapus
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Add User Modal -->
    <div v-if="showAddModal" class="modal-overlay" @click.self="closeModals">
      <div class="modal-card" style="max-width:420px">
        <div class="modal-header">
          <h3>Tambah Pengguna</h3>
          <button class="btn-close" @click="closeModals">×</button>
        </div>
        <div class="modal-body">
          <div class="form-section">
            <label>
              <span>Username</span>
              <input class="input" v-model="addForm.username" placeholder="contoh: noc_john" autocomplete="off" />
            </label>
            <label>
              <span>Password</span>
              <input class="input" type="password" v-model="addForm.password" placeholder="Min. 6 karakter" autocomplete="new-password" />
            </label>
            <label>
              <span>Role</span>
              <select class="input" v-model="addForm.role">
                <option value="noc">NOC — hanya bisa akses Network Map</option>
                <option value="admin">Admin — akses penuh</option>
              </select>
            </label>
            <div v-if="addError" class="alert error" style="margin-top:8px">{{ addError }}</div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn" @click="closeModals">Batal</button>
          <button class="btn primary" :disabled="addLoading" @click="submitAdd">
            {{ addLoading ? 'Menyimpan…' : 'Simpan' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Change Password Modal -->
    <div v-if="showPwModal" class="modal-overlay" @click.self="closeModals">
      <div class="modal-card" style="max-width:420px">
        <div class="modal-header">
          <h3>Ganti Password — {{ pwTarget?.username }}</h3>
          <button class="btn-close" @click="closeModals">×</button>
        </div>
        <div class="modal-body">
          <div class="form-section">
            <label>
              <span>Password Baru</span>
              <input class="input" type="password" v-model="pwForm.password" placeholder="Min. 6 karakter" autocomplete="new-password" />
            </label>
            <div v-if="pwError" class="alert error" style="margin-top:8px">{{ pwError }}</div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn" @click="closeModals">Batal</button>
          <button class="btn primary" :disabled="pwLoading" @click="submitPassword">
            {{ pwLoading ? 'Menyimpan…' : 'Ganti Password' }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { api } from '../services/api.js';
import { getUser } from '../services/auth.js';

const currentUser = ref(getUser());
const users = ref([]);
const loading = ref(false);

// --- Add modal ---
const showAddModal = ref(false);
const addForm = ref({ username: '', password: '', role: 'noc' });
const addError = ref('');
const addLoading = ref(false);

// --- Change password modal ---
const showPwModal = ref(false);
const pwTarget = ref(null);
const pwForm = ref({ password: '' });
const pwError = ref('');
const pwLoading = ref(false);

function fmtDate(d) {
  if (!d) return '-';
  return new Date(d + (d.includes('Z') ? '' : 'Z')).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

async function load() {
  loading.value = true;
  try {
    users.value = await api('/users');
  } catch (e) {
    console.error('Failed to load users:', e);
    users.value = [];
  } finally {
    loading.value = false;
  }
}

function openAdd() {
  addForm.value = { username: '', password: '', role: 'noc' };
  addError.value = '';
  showAddModal.value = true;
}

async function submitAdd() {
  addError.value = '';
  if (!addForm.value.username.trim()) { addError.value = 'Username wajib diisi'; return; }
  if (addForm.value.password.length < 6) { addError.value = 'Password minimal 6 karakter'; return; }
  addLoading.value = true;
  try {
    await api('/users', {
      method: 'POST',
      body: JSON.stringify(addForm.value),
    });
    closeModals();
    await load();
  } catch (e) {
    addError.value = e.message;
  } finally {
    addLoading.value = false;
  }
}

function openChangePassword(user) {
  pwTarget.value = user;
  pwForm.value = { password: '' };
  pwError.value = '';
  showPwModal.value = true;
}

async function submitPassword() {
  pwError.value = '';
  if (pwForm.value.password.length < 6) { pwError.value = 'Password minimal 6 karakter'; return; }
  pwLoading.value = true;
  try {
    await api(`/users/${pwTarget.value.id}/password`, {
      method: 'PUT',
      body: JSON.stringify({ password: pwForm.value.password }),
    });
    closeModals();
  } catch (e) {
    pwError.value = e.message;
  } finally {
    pwLoading.value = false;
  }
}

async function deleteUser(user) {
  if (!confirm(`Hapus pengguna "${user.username}"? Tindakan ini tidak bisa dibatalkan.`)) return;
  try {
    await api(`/users/${user.id}`, { method: 'DELETE' });
    await load();
  } catch (e) {
    alert('Gagal hapus: ' + e.message);
  }
}

function closeModals() {
  showAddModal.value = false;
  showPwModal.value = false;
}

onMounted(load);
</script>
