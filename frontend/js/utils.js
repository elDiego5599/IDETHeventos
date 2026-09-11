// Este archivo tiene funciones que se usan en varias paginas
// para no repetir codigo

// Guardamos y leemos el token y el usuario en el navegador
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
  // Borra los datos de sesion cuando cerramos sesion
  clear: () => {
    localStorage.removeItem('ideth_token');
    localStorage.removeItem('ideth_user');
  },
  // Revisa si hay un token guardado
  isLoggedIn: () => !!localStorage.getItem('ideth_token')
};

// Muestra un mensaje flotante en la esquina de la pantalla
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

  // El mensaje desaparece despues de 3 segundos
  setTimeout(() => {
    toast.remove();
  }, 3500);
}

// Esta funcion hace las peticiones al backend y agrega el token automaticamente
async function apiRequest(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  // Si estamos logueados, agregamos el token a la peticion
  const token = AuthStorage.getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(endpoint, { ...options, headers });
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      // Si el token ya no sirve, cerramos sesion y mandamos al login
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

// Funciones rapidas para hacer GET, POST, PUT y DELETE
const API = {
  get: (url) => apiRequest(url, { method: 'GET' }),
  post: (url, body) => apiRequest(url, { method: 'POST', body: JSON.stringify(body) }),
  put: (url, body) => apiRequest(url, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (url) => apiRequest(url, { method: 'DELETE' })
};

// Abre un modal (ventana emergente)
function openModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.classList.add('active');
  m.onclick = (event) => {
    if (event.target === m) closeModal(id);
  };
}

// Cierra un modal
function closeModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.remove('active');
}

// Cierra la sesion y vuelve al inicio
function logoutUser() {
  AuthStorage.clear();
  window.location.href = '/';
}

// Cambia los botones del navbar segun si estamos logueados o no
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

// Formatea la fecha para mostrarla bonita (por ahora la deja igual)
function formatDate(str) {
  if (!str) return 'Por confirmar';
  return str;
}
