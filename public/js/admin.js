let jwtToken = '';

async function fetchJson(url, options) {
  const headers = { 'Content-Type': 'application/json' };
  if (jwtToken) headers.Authorization = `Bearer ${jwtToken}`;
  const res = await fetch(url, {
    headers,
    credentials: 'same-origin',
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || 'Request failed');
  return data;
}

async function login(e) {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  try {
    const data = await fetchJson('/api/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    jwtToken = data.token;
    document.getElementById('token').textContent = jwtToken;
    document.getElementById('admin-status').textContent = 'Logged in';
  } catch (err) {
    document.getElementById('admin-status').textContent = err.message;
  }
}

async function getAdminStatus() {
  try {
    const data = await fetchJson('/admin/status');
    document.getElementById('status').textContent = JSON.stringify(data);
  } catch (err) {
    document.getElementById('status').textContent = err.message;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('login-form')?.addEventListener('submit', login);
  document
    .getElementById('btn-status')
    ?.addEventListener('click', getAdminStatus);
});
