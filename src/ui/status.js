export function setMapStatus(label, state) {
  const el = document.getElementById('map-status');
  if (!el) return;

  el.textContent = label;

  // reset classes
  el.className = 'map-status-pill';

  if (state === 'loading') {
    el.classList.add('map-status--loading');
  } else if (state === 'ready') {
    el.classList.add('map-status--ready');
  } else if (state === 'error') {
    el.classList.add('map-status--error');
  }
}
