import { ref } from 'vue';

const toasts = ref([]);
let toastId = 0;

export function useToast() {
  function addToast(message, type = 'info', duration = 4000) {
    const id = ++toastId;
    toasts.value.push({ id, message, type, visible: true });
    setTimeout(() => removeToast(id), duration);
    return id;
  }

  function removeToast(id) {
    const idx = toasts.value.findIndex(t => t.id === id);
    if (idx >= 0) toasts.value.splice(idx, 1);
  }

  function success(msg) { return addToast(msg, 'success'); }
  function error(msg) { return addToast(msg, 'error', 6000); }
  function warning(msg) { return addToast(msg, 'warning', 5000); }
  function info(msg) { return addToast(msg, 'info'); }

  return { toasts, addToast, removeToast, success, error, warning, info };
}
