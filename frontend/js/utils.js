/**
 * utils.js - Utilidades de API, sesion y notificaciones
 */

const AuthStorage = {
  getToken: () => localStorage.getItem('ideth_token'),
  setToken: (token) => localStorage.setItem('ideth_token', token),
  getUser: () => {
    try {
      const u = localStorage.getItem('ideth_user');
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  },
  setUser: (user) => localStorage.setItem('ideth_user', JSON.stringify(user)),
  clear: () => {
    localStorage.removeItem('ideth_token');
    localStorage.removeItem('ideth_user');
  },
  isLoggedIn: () => !!localStorage.getItem('ideth_token')
};

function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3500);
}

async function apiRequest(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const token = AuthStorage.getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(endpoint, { ...options, headers });
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      if (res.status === 401 && AuthStorage.isLoggedIn()) {
        AuthStorage.clear();
        window.location.href = '/login';
      }
      throw new Error(data?.detail || data?.mensaje || 'Error en la solicitud');
    }
    return data;
  } catch (err) {
    console.error('API Error:', err.message);
    throw err;
  }
}

const API = {
  get: (url) => apiRequest(url, { method: 'GET' }),
  post: (url, body) => apiRequest(url, { method: 'POST', body: JSON.stringify(body) }),
  put: (url, body) => apiRequest(url, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (url) => apiRequest(url, { method: 'DELETE' })
};

function openModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.add('active');
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.remove('active');
}

function logoutUser() {
  AuthStorage.clear();
  window.location.href = '/';
}

function updateNavbar() {
  const container = document.getElementById('nav-auth-buttons');
  if (!container) return;

  const user = AuthStorage.getUser();
  if (user && AuthStorage.isLoggedIn()) {
    const dashboardUrl = user.rol === 'admin' ? '/admin' : '/dashboard';
    const roleLabel = user.rol === 'admin' ? 'Admin' : 'Estudiante';
    container.innerHTML = `
      <span class="nav-user-info">${roleLabel}: ${user.nombre.split(' ')[0]}</span>
      <a href="${dashboardUrl}" class="btn btn-primary btn-sm">Mi Panel</a>
      <button onclick="logoutUser()" class="btn btn-outline btn-sm">Salir</button>
    `;
  }
}

function formatDate(str) {
  if (!str) return 'Por confirmar';
  return str;
}
