const loader = document.getElementById('startup-loader');
const app = document.getElementById('app');
document.getElementById('startup-retry').addEventListener('click', () => location.reload());

try {
  const studio = await import('./app.js');
  await studio.ready;
  // Let the completed workspace paint before revealing it. No artificial delay.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    loader.classList.add('is-ready');
    loader.setAttribute('aria-hidden', 'true');
    app.removeAttribute('inert');
    app.setAttribute('aria-busy', 'false');
    loader.addEventListener('transitionend', () => loader.remove(), { once: true });
    setTimeout(() => loader.remove(), 350); // Also completes with reduced motion.
  }));
} catch {
  app.setAttribute('aria-busy', 'false');
  loader.classList.add('has-error');
  loader.querySelector('h1').textContent = 'Your studio couldn’t load.';
  document.getElementById('startup-status').textContent = 'Check your connection and try opening AudioLab again.';
  document.getElementById('startup-retry').hidden = false;
}
