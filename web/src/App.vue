<template>
  <router-view v-if="isLoginRoute" />
  <div v-else class="app-shell">
    <!-- Mobile Backdrop -->
    <div class="sidebar-backdrop" :class="{ active: sidebarOpen }" @click="sidebarOpen = false"></div>

    <!-- Sidebar -->
    <aside class="sidebar" :class="{ open: sidebarOpen }">
      <div class="sidebar-brand">
        <div class="brand-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 0 1 10 10c0 2.4-.85 4.6-2.28 6.28l-1.42-1.42A7.95 7.95 0 0 0 20 12c0-4.42-3.58-8-8-8s-8 3.58-8 8c0 1.95.7 3.73 1.86 5.12L4.44 18.54A9.95 9.95 0 0 1 2 12 10 10 0 0 1 12 2z"/><path d="M12 6a6 6 0 0 1 6 6c0 1.48-.54 2.82-1.4 3.87l-1.42-1.42A3.97 3.97 0 0 0 16 12a4 4 0 0 0-8 0c0 .9.3 1.7.8 2.3l-1.4 1.4A5.97 5.97 0 0 1 6 12a6 6 0 0 1 6-6z"/><circle cx="12" cy="12" r="2"/></svg>
        </div>
        <div>
          <div class="brand">AppMon</div>
          <div class="muted" style="font-size:11px">Network Operations</div>
        </div>
      </div>

      <nav class="nav">
        <template v-if="user?.role !== 'noc'">
          <div class="nav-section">Main</div>
          <RouterLink to="/dashboard" @click="sidebarOpen = false">
            <span class="nav-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="17" x2="9" y2="9"/><line x1="13" y1="17" x2="13" y2="5"/><line x1="17" y1="17" x2="17" y2="13"/></svg>
            </span>
            Dashboard
          </RouterLink>
          <RouterLink to="/monitors" @click="sidebarOpen = false">
            <span class="nav-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
            </span>
            Monitors
          </RouterLink>
          <RouterLink to="/devices" @click="sidebarOpen = false">
            <span class="nav-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>
            </span>
            Devices
          </RouterLink>

          <div class="nav-section">Reports</div>
          <RouterLink to="/sla" @click="sidebarOpen = false">
            <span class="nav-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
            </span>
            SLA Report
          </RouterLink>
          <RouterLink to="/events" @click="sidebarOpen = false">
            <span class="nav-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            </span>
            Events
          </RouterLink>
        </template>

        <div class="nav-section" v-if="user?.role !== 'noc'">Tools</div>
        <RouterLink to="/map" @click="sidebarOpen = false">
          <span class="nav-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>
          </span>
          Network Map
        </RouterLink>
        <RouterLink v-if="user?.role !== 'noc'" to="/audit-log" @click="sidebarOpen = false">
          <span class="nav-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
          </span>
          Audit Log
        </RouterLink>

        <template v-if="user?.role !== 'noc'">
          <div class="nav-section">Integrations</div>
          <RouterLink to="/ai-smart-oid" @click="sidebarOpen = false">
            <span class="nav-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="15" x2="23" y2="15"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="15" x2="4" y2="15"/></svg>
            </span>
            AI Settings
          </RouterLink>
          <RouterLink to="/telegram" @click="sidebarOpen = false">
            <span class="nav-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </span>
            Telegram
          </RouterLink>
          <RouterLink to="/users" @click="sidebarOpen = false">
            <span class="nav-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </span>
            Pengguna
          </RouterLink>
        </template>
      </nav>

      <div class="sidebar-footer">
        <div class="sidebar-user">
          <div class="user-avatar">{{ (user?.username || 'A')[0].toUpperCase() }}</div>
          <div>
            <div style="font-weight:700;font-size:13px;color:#e2e8f0">{{ user?.username || '-' }}</div>
            <div class="muted" style="font-size:11px;color:#64748b">{{ user?.role || 'admin' }}</div>
          </div>
        </div>
        <button class="btn btn-sm" style="width:100%;margin-top:6px;background:rgba(255,255,255,0.06);border-color:rgba(255,255,255,0.1);color:#94a3b8" @click="logout">Logout</button>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="main">
      <div class="topbar">
        <div class="topbar-left">
          <button class="hamburger" @click="sidebarOpen = !sidebarOpen"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg></button>
          <div class="topbar-breadcrumb">Home / <span>{{ title }}</span></div>
        </div>
        <div class="topbar-right">
          <button class="theme-toggle" @click="toggleDark" :title="isDark ? 'Light mode' : 'Dark mode'">
            <svg v-if="isDark" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          </button>
          <NotificationCenter />
          <div class="topbar-time">{{ now }}</div>
        </div>
      </div>
      <div class="main-content">
        <router-view v-slot="{ Component }">
          <transition name="page" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </div>
    </main>
  </div>
  <ToastContainer />
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { clearAuth, getUser } from './services/auth.js';
import { useDarkMode } from './composables/useDarkMode.js';
import ToastContainer from './components/ToastContainer.vue';
import NotificationCenter from './components/NotificationCenter.vue';

const route = useRoute();
const router = useRouter();
const user = ref(getUser());
const now = ref('');
const sidebarOpen = ref(false);
let timer;

watch(() => route.path, () => {
  user.value = getUser();
});

const { isDark, toggle: toggleDark } = useDarkMode();

const isLoginRoute = computed(() => route.path === '/login');

const title = computed(() => {
  const map = {
    '/dashboard': 'Dashboard', '/monitors': 'Monitors', '/devices': 'Devices',
    '/sla': 'SLA Report', '/events': 'Events', '/map': 'Network Map',
    '/ai-smart-oid': 'AI Settings', '/telegram': 'Telegram Webhook', '/audit-log': 'Audit Log', '/users': 'Pengguna',
  };
  return map[route.path] || 'AppMon';
});

const subtitle = computed(() => {
  const map = {
    '/dashboard': 'Real-time monitoring overview & health status',
    '/monitors': 'Manage ping, TCP & SNMP interface monitors',
    '/devices': 'Network device inventory & SNMP configuration',
    '/sla': 'Uptime & performance reports per monitor',
    '/events': 'Status change timeline across all monitors',
    '/map': 'Geographic network topology & traffic visualization',
    '/ai-smart-oid': 'Smart OID discovery & SNMP capability analysis',
    '/telegram': 'Alert webhook & notification configuration',
    '/audit-log': 'System activity & user action history',
  };
  return map[route.path] || 'Network Operations Monitor';
});

function tick() { now.value = new Date().toLocaleString(); }
function logout() { clearAuth(); router.push('/login'); }

// Close sidebar on route change (mobile)
router.afterEach(() => { sidebarOpen.value = false; });

// Close sidebar on escape key
function handleKeydown(e) { if (e.key === 'Escape') sidebarOpen.value = false; }

onMounted(() => { tick(); timer = setInterval(tick, 1000); document.addEventListener('keydown', handleKeydown); });
onUnmounted(() => { if (timer) clearInterval(timer); document.removeEventListener('keydown', handleKeydown); });
</script>
