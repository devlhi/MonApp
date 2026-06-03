import { createApp } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import App from './App.vue';
import './styles.css';

import LoginPage from './pages/LoginPage.vue';
import DashboardPage from './pages/DashboardPage.vue';
import MonitorsPage from './pages/MonitorsPage.vue';
import DevicesPage from './pages/DevicesPage.vue';
import SlaPage from './pages/SlaPage.vue';
import EventsPage from './pages/EventsPage.vue';
import MapPage from './pages/MapPage.vue';
import AiSmartOidPage from './pages/AiSmartOidPage.vue';
import TelegramWebhookPage from './pages/TelegramWebhookPage.vue';
import AuditLogPage from './pages/AuditLogPage.vue';
import UsersPage from './pages/UsersPage.vue';
import { getToken, getUser } from './services/auth.js';

const routes = [
  { path: '/login', component: LoginPage, meta: { public: true } },
  { path: '/', redirect: '/dashboard' },
  { path: '/dashboard', component: DashboardPage },
  { path: '/monitors', component: MonitorsPage },
  { path: '/devices', component: DevicesPage },
  { path: '/sla', component: SlaPage },
  { path: '/events', component: EventsPage },
  { path: '/map', component: MapPage },
  { path: '/ai-smart-oid', component: AiSmartOidPage },
  { path: '/telegram', component: TelegramWebhookPage },
  { path: '/audit-log', component: AuditLogPage },
  { path: '/users', component: UsersPage, meta: { adminOnly: true } },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to) => {
  if (to.meta.public) return true;
  if (!getToken()) return '/login';
  
  const user = getUser();
  if (user && user.role === 'noc' && to.path !== '/map') {
    return '/map';
  }
  if (to.meta.adminOnly && user?.role !== 'admin') {
    return '/map';
  }
  return true;
});

createApp(App).use(router).mount('#app');
