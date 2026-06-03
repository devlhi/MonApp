import { getToken, clearAuth } from './auth.js';

export async function api(path, opts = {}) {
  const token = getToken();
  const headers = {
    'content-type': 'application/json',
    ...(opts.headers || {}),
  };
  if (token) headers.authorization = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, {
    ...opts,
    headers,
  });

  if (!res.ok) {
    if (res.status === 401) {
      clearAuth();
      window.location.href = '/login';
    }
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

export async function login(username, password) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'login failed');
  }
  return res.json();
}
