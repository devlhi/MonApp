import { ref, watch } from 'vue';

const isDark = ref(localStorage.getItem('appmon_theme') === 'dark');

function applyTheme(dark) {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  localStorage.setItem('appmon_theme', dark ? 'dark' : 'light');
}

watch(isDark, applyTheme, { immediate: true });

export function useDarkMode() {
  function toggle() { isDark.value = !isDark.value; }
  return { isDark, toggle };
}
