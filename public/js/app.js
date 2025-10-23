async function fetchJson(url, options) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || 'Request failed');
  }
  return data;
}

async function checkHealth() {
  const el = document.getElementById('health');
  try {
    const data = await fetchJson('/healthz');
    el.textContent = JSON.stringify(data);
  } catch (e) {
    el.textContent = e.message;
  }
}

async function checkReady() {
  const el = document.getElementById('ready');
  try {
    const data = await fetchJson('/readyz');
    el.textContent = JSON.stringify(data);
  } catch (e) {
    el.textContent = e.message;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const healthBtn = document.getElementById('btn-health');
  const readyBtn = document.getElementById('btn-ready');
  healthBtn?.addEventListener('click', checkHealth);
  readyBtn?.addEventListener('click', checkReady);
});
