/**
 * api.js - Módulo para comunicarse con la API de FastAPI
 * Gestiona peticiones HTTP, tokens JWT en LocalStorage y notificaciones Toast.
 */

const API_BASE_URL = ''; // Al estar servido por FastAPI, la ruta base es relativa ('')

// Utilidades de LocalStorage para la Sesión
const AuthStorage = {
  getToken: () => localStorage.getItem('ideth_token'),
  setToken: (token) => localStorage.setItem('ideth_token', token),
  getUser: () => {
    const userStr = localStorage.getItem('ideth_user');
    try {
      return userStr ? JSON.parse(userStr) : null;
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

// Sistema de Notificaciones Toast flotantes
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
  
  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
  toast.innerHTML = `<span><strong>${icon}</strong> ${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Wrapper para Peticiones Fetch con JWT
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const token = AuthStorage.getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const errorMsg = data?.detail || data?.mensaje || 'Ocurrió un error en la solicitud.';
      
      // Si el token expiró o no es válido (401), limpiar sesión y redirigir
      if (response.status === 401 && AuthStorage.isLoggedIn()) {
        AuthStorage.clear();
        showToast('Tu sesión ha expirado. Por favor ingresa de nuevo.', 'error');
        setTimeout(() => {
          window.location.href = '/';
        }, 1500);
      }
      
      throw new Error(errorMsg);
    }

    return data;
  } catch (error) {
    console.error(`Error en API [${endpoint}]:`, error.message);
    throw error;
  }
}

// Métodos HTTP rápidos
const API = {
  get: (endpoint) => apiRequest(endpoint, { method: 'GET' }),
  post: (endpoint, body) => apiRequest(endpoint, { method: 'POST', body: JSON.stringify(body) }),
  put: (endpoint, body) => apiRequest(endpoint, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (endpoint) => apiRequest(endpoint, { method: 'DELETE' })
};
