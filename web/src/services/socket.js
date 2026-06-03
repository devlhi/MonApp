import { io } from 'socket.io-client';
import { getToken } from './auth.js';

let socket = null;
const listeners = new Map(); // Map<event, Set<callback>>

/**
 * Get or create the singleton socket instance.
 * Multiple components can subscribe to events without creating new connections.
 */
export function getOrCreateSocket() {
  if (socket && socket.connected) return socket;
  if (socket) socket.disconnect();

  socket = io({
    auth: { token: getToken() },
    reconnection: true,
    reconnectionDelay: 2000,
    reconnectionAttempts: 10,
  });

  // Re-dispatch events to all registered listeners
  socket.onAny((event, ...args) => {
    const callbacks = listeners.get(event);
    if (callbacks) {
      callbacks.forEach((cb) => {
        try { cb(...args); } catch (e) { console.error(`Socket listener error [${event}]:`, e); }
      });
    }
  });

  return socket;
}

/**
 * Subscribe to a socket event. Returns an unsubscribe function.
 */
export function onSocketEvent(event, callback) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(callback);
  // Ensure socket is connected
  getOrCreateSocket();
  return () => {
    const set = listeners.get(event);
    if (set) { set.delete(callback); if (set.size === 0) listeners.delete(event); }
  };
}

/**
 * Legacy helper: connect socket with handler object.
 * Kept for backward compatibility with existing pages.
 */
export function connectSocket(handlers = {}) {
  const unsubs = [];
  if (handlers.onConnect) unsubs.push(onSocketEvent('connect', handlers.onConnect));
  if (handlers.onDisconnect) unsubs.push(onSocketEvent('disconnect', handlers.onDisconnect));
  if (handlers.onSnapshot) unsubs.push(onSocketEvent('snapshot', handlers.onSnapshot));
  if (handlers.onState) unsubs.push(onSocketEvent('state', handlers.onState));
  if (handlers.onEvent) unsubs.push(onSocketEvent('event', handlers.onEvent));
  return { unsubs, socket: getOrCreateSocket() };
}

/**
 * Get the current socket instance (may be null).
 */
export function getSocket() {
  return socket;
}

/**
 * Disconnect and cleanup the socket entirely.
 * Only call this on app teardown, not on individual component unmount.
 */
export function disconnectSocket() {
  if (socket) socket.disconnect();
  socket = null;
  listeners.clear();
}
