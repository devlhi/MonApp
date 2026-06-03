<template>
  <div class="login-wrap">
    <div class="login-card">
      <div class="login-brand">
        <div class="login-brand-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 0 1 10 10c0 2.4-.85 4.6-2.28 6.28l-1.42-1.42A7.95 7.95 0 0 0 20 12c0-4.42-3.58-8-8-8s-8 3.58-8 8c0 1.95.7 3.73 1.86 5.12L4.44 18.54A9.95 9.95 0 0 1 2 12 10 10 0 0 1 12 2z"/><path d="M12 6a6 6 0 0 1 6 6c0 1.48-.54 2.82-1.4 3.87l-1.42-1.42A3.97 3.97 0 0 0 16 12a4 4 0 0 0-8 0c0 .9.3 1.7.8 2.3l-1.4 1.4A5.97 5.97 0 0 1 6 12a6 6 0 0 1 6-6z"/><circle cx="12" cy="12" r="2"/></svg>
        </div>
        <div>
          <h1 style="margin:0;font-size:24px">AppMon</h1>
          <div class="muted" style="font-size:12px">Network Operations Monitor</div>
        </div>
      </div>

      <div style="margin-bottom:24px">
        <h2 style="margin:0 0 4px;font-size:18px">Welcome back</h2>
        <div class="muted" style="font-size:13px">Sign in to your monitoring dashboard</div>
      </div>

      <form class="form" style="max-width:100%" @submit.prevent="submit">
        <label>
          <span>Username</span>
          <input class="input" v-model="username" placeholder="Enter username" required autocomplete="username" />
        </label>
        <label>
          <span>Password</span>
          <div class="input-group">
            <input class="input" v-model="password" :type="showPassword ? 'text' : 'password'" placeholder="Enter password" required autocomplete="current-password" />
            <button type="button" class="btn btn-eye" style="color:#8896ab" @click="showPassword = !showPassword">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path v-if="!showPassword" d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle v-if="!showPassword" cx="12" cy="12" r="3"/><path v-if="showPassword" d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><line v-if="showPassword" x1="1" y1="1" x2="23" y2="23"/></svg>
            </button>
          </div>
        </label>
        <button class="btn primary" :disabled="loading" style="margin-top:4px;width:100%">
          <span v-if="loading" style="display:inline-flex;align-items:center;gap:6px">
            <span class="login-spinner"></span> Signing in...
          </span>
          <span v-else>Sign in →</span>
        </button>
      </form>

      <div v-if="error" class="login-error">{{ error }}</div>

      <div class="muted" style="margin-top:20px;font-size:11px;text-align:center">
        &copy; AppMon Network Operations
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { login } from '../services/api.js';
import { setAuth } from '../services/auth.js';

const router = useRouter();
const username = ref('');
const password = ref('');
const loading = ref(false);
const error = ref('');
const showPassword = ref(false);

async function submit() {
  loading.value = true;
  error.value = '';
  try {
    const res = await login(username.value, password.value);
    setAuth(res.token, res.user);
    router.push('/dashboard');
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
