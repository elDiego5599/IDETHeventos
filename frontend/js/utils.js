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
        window.location.href = '/?mensaje=' + encodeURIComponent('problema al validar token');
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

// Formatea "2026-02-12 09:50" como "12 feb 2026, 9:50 a. m."
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function formatDate(str) {
  if (!str) return 'Por confirmar';
  const m = String(str).match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (!m) return str;
  const day = `${parseInt(m[3], 10)} ${MESES_CORTOS[parseInt(m[2], 10) - 1]} ${m[1]}`;
  if (m[4] === undefined) return day;
  const hour = parseInt(m[4], 10);
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${day}, ${hour12}:${m[5]} ${hour < 12 ? 'a. m.' : 'p. m.'}`;
}

// Un color fijo por categoria, para las tarjetas sin foto y los graficos
const CATEGORY_COLORS = ['#275da8', '#d9663f', '#287a4b', '#6b4fb5', '#b7791f', '#1f8a91', '#bd443b', '#55657a'];
function categoryColor(name) {
  const text = String(name || 'General');
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return CATEGORY_COLORS[hash % CATEGORY_COLORS.length];
}

// Cuadro de color con el nombre de la categoria cuando el evento no tiene foto
function eventBannerHtml(name) {
  const label = name || 'General';
  return `<div class="event-card-banner" style="--cat-color: ${categoryColor(label)};"><span>${label}</span></div>`;
}

// Quita las comillas que ya trae la frase, para no mostrarlas dobles
function cleanQuote(text) {
  return String(text || '').replace(/^[\s"“”«»]+|[\s"“”«»]+$/g, '');
}

// Ventana de confirmacion propia, devuelve true si la persona confirma
function confirmDialog(message, confirmLabel = 'Confirmar') {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.innerHTML = `
      <div class="modal-container confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-text">
        <div class="modal-body"><p id="confirm-dialog-text" class="confirm-dialog-text"></p></div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline btn-sm" data-answer="no">Cancelar</button>
          <button type="button" class="btn btn-danger btn-sm" data-answer="yes"></button>
        </div>
      </div>`;
    overlay.querySelector('#confirm-dialog-text').textContent = message;
    overlay.querySelector('[data-answer="yes"]').textContent = confirmLabel;
    const finish = answer => {
      document.removeEventListener('keydown', onKey);
      overlay.remove();
      resolve(answer);
    };
    const onKey = event => { if (event.key === 'Escape') finish(false); };
    overlay.addEventListener('click', event => {
      if (event.target === overlay) finish(false);
      const answer = event.target.closest('[data-answer]')?.dataset.answer;
      if (answer) finish(answer === 'yes');
    });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
    overlay.querySelector('[data-answer="no"]').focus();
  });
}

// Marca la pestaña activa para lectores de pantalla
function setActiveTab(btns, panes, activeBtn) {
  btns.forEach(b => {
    const active = b === activeBtn;
    b.classList.toggle('active', active);
    b.setAttribute('aria-selected', active ? 'true' : 'false');
    b.tabIndex = active ? 0 : -1;
  });
  panes.forEach(p => p.classList.toggle('active', p.id === activeBtn.dataset.tab));
}

// Muestra u oculta la informacion extra de una tarjeta de evento
function toggleEventCard(btn) {
  const card = btn.closest('.event-card');
  if (!card) return;
  const expanded = card.classList.toggle('expanded');
  btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  btn.textContent = expanded ? 'Ver menos' : 'Ver más información';
}

// Revisa si la fecha del evento cae dentro del rango elegido (formato AAAA-MM-DD)
function matchesDateRange(event, from, to) {
  const day = (event.fecha || '').slice(0, 10);
  if (!day) return !from && !to;
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

// Conecta los campos de fecha y el boton de limpiar con una funcion de filtrado
function setupDateFilter(fromId, toId, clearId, onChange) {
  const from = document.getElementById(fromId);
  const to = document.getElementById(toId);
  const clear = document.getElementById(clearId);
  [from, to].forEach(input => input?.addEventListener('change', onChange));
  clear?.addEventListener('click', () => {
    if (from) from.value = '';
    if (to) to.value = '';
    onChange();
  });
}
