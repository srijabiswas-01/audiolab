(() => {
  const key = 'audiolab-theme';
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  let preference;
  try { preference = localStorage.getItem(key); } catch { /* Use system preference when storage is unavailable. */ }
  if (!['light', 'dark'].includes(preference)) preference = null;

  function apply() {
    const theme = preference || (system.matches ? 'dark' : 'light');
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#171522' : '#403D88');
    window.dispatchEvent(new CustomEvent('audiolab:theme', { detail: theme }));
  }

  window.AudioLabTheme = {
    toggle() {
      preference = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(key, preference); } catch { /* Still allow changing the theme for this visit. */ }
      apply();
    },
  };
  system.addEventListener('change', () => { if (!preference) apply(); });
  window.addEventListener('storage', event => {
    if (event.key !== key && event.key !== null) return;
    preference = ['light', 'dark'].includes(event.newValue) ? event.newValue : null;
    apply();
  });
  apply();
})();
