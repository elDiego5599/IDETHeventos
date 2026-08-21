/**
 * admin.js - Panel de Administracion
 */

let cachedCats = [];
let cachedLocs = [];
let cachedOrgs = [];
let editingEventId = null;

document.addEventListener('DOMContentLoaded', async () => {
  const user = AuthStorage.getUser();
  if (!AuthStorage.isLoggedIn() || !user || user.rol !== 'admin') {
    showToast('Acceso denegado: Se requiere rol de Administrador', 'error');
    setTimeout(() => { window.location.href = '/login'; }, 800);
    return;
  }

  document.getElementById('admin-badge-name').textContent = user.nombre;

  setupAdminTabs();
  setupCatalogForms();
  setupEventForm();

  await Promise.all([
    loadStats(),
    loadCatalogs(),
    loadEvents(),
    loadUsers(),
    loadSuggestions()
  ]);
});

function setupAdminTabs() {
  const btns = document.querySelectorAll('.tab-admin-btn');
  const panes = document.querySelectorAll('.admin-tab-pane');

  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => {
        b.classList.remove('btn-primary');
        b.classList.add('btn-outline');
      });
      panes.forEach(p => p.classList.remove('active'));

      btn.classList.remove('btn-outline');
      btn.classList.add('btn-primary');

      const target = document.getElementById(btn.dataset.tab);
      if (target) target.classList.add('active');
    });
  });
}

async function loadStats() {
  try {
    const stats = await API.get('/api/stats');
    document.getElementById('stat-events').textContent = stats.total_eventos || 0;
    document.getElementById('stat-students').textContent = stats.total_estudiantes || 0;
    document.getElementById('stat-inscriptions').textContent = stats.total_inscripciones || 0;
    document.getElementById('stat-suggestions').textContent = stats.total_sugerencias || 0;
  } catch (err) {
    console.error(err);
  }
}

async function loadEvents() {
  const tbody = document.getElementById('admin-events-tbody');
  if (!tbody) return;

  try {
    const events = await API.get('/api/eventos?tipo=todos');
    if (events.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-state">No hay eventos creados.</td></tr>`;
      return;
    }

    tbody.innerHTML = events.map(e => `
      <tr>
        <td><strong>#${e.id}</strong></td>
        <td>${e.titulo} ${e.es_pasado ? '<span class="badge badge-past">Finalizado</span>' : ''}</td>
        <td>${e.fecha}</td>
        <td><span class="badge badge-category">${e.categoria_nombre || 'N/A'}</span></td>
        <td>${e.ubicacion_nombre || 'N/A'}</td>
        <td>${e.total_inscritos}</td>
        <td>
          <div class="table-actions">
            <button onclick="openEditEvent(${e.id})" class="btn btn-outline btn-sm">Editar</button>
            <button onclick="deleteEvent(${e.id})" class="btn btn-danger btn-sm">Eliminar</button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    showToast('Error al cargar eventos', 'error');
  }
}

function openCreateEvent() {
  editingEventId = null;
  document.getElementById('event-modal-title').textContent = 'Crear Evento';
  document.getElementById('form-event-admin').reset();
  document.getElementById('event-id').value = '';
  populateSelects();
  openModal('event-form-modal');
}

async function openEditEvent(id) {
  try {
    const e = await API.get(`/api/eventos/${id}`);
    editingEventId = id;

    document.getElementById('event-modal-title').textContent = `Editar Evento #${id}`;
    document.getElementById('event-id').value = e.id;
    document.getElementById('event-titulo').value = e.titulo;
    document.getElementById('event-desc').value = e.descripcion || '';
    document.getElementById('event-fecha').value = e.fecha.replace(' ', 'T');

    populateSelects();
    document.getElementById('event-cat').value = e.categoria_id || '';
    document.getElementById('event-loc').value = e.ubicacion_id || '';
    document.getElementById('event-org').value = e.organizador_id || '';

    openModal('event-form-modal');
  } catch (err) {
    showToast('Error al cargar datos del evento', 'error');
  }
}

function setupEventForm() {
  const form = document.getElementById('form-event-admin');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const titulo = document.getElementById('event-titulo').value.trim();
    const descripcion = document.getElementById('event-desc').value.trim();
    const rawFecha = document.getElementById('event-fecha').value;
    const fecha = rawFecha.replace('T', ' ');
    const categoria_id = parseInt(document.getElementById('event-cat').value, 10) || null;
    const ubicacion_id = parseInt(document.getElementById('event-loc').value, 10) || null;
    const organizador_id = parseInt(document.getElementById('event-org').value, 10) || null;

    const payload = { titulo, descripcion, fecha, categoria_id, ubicacion_id, organizador_id };
    const btn = document.getElementById('btn-save-event');

    try {
      btn.disabled = true;
      if (editingEventId) {
        const res = await API.put(`/api/eventos/${editingEventId}`, payload);
        showToast(res.mensaje, 'success');
      } else {
        const res = await API.post('/api/eventos', payload);
        showToast(res.mensaje, 'success');
      }
      closeModal('event-form-modal');
      await loadEvents();
      await loadStats();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });
}

async function deleteEvent(id) {
  if (!confirm(`Eliminar permanentemente el evento #${id}?`)) return;
  try {
    const res = await API.delete(`/api/eventos/${id}`);
    showToast(res.mensaje, 'info');
    await loadEvents();
    await loadStats();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadCatalogs() {
  try {
    const [cats, locs, orgs] = await Promise.all([
      API.get('/api/categorias'),
      API.get('/api/ubicaciones'),
      API.get('/api/organizadores')
    ]);
    cachedCats = cats;
    cachedLocs = locs;
    cachedOrgs = orgs;

    renderCatalogList('list-cats', cats, deleteCategory);
    renderCatalogList('list-locs', locs, deleteLocation);
    renderCatalogList('list-orgs', orgs, deleteOrganizer);

    document.getElementById('count-cats').textContent = cats.length;
    document.getElementById('count-locs').textContent = locs.length;
    document.getElementById('count-orgs').textContent = orgs.length;
  } catch (err) {
    console.error(err);
  }
}

function renderCatalogList(containerId, items, deleteCb) {
  const c = document.getElementById(containerId);
  if (!c) return;
  if (items.length === 0) {
    c.innerHTML = `<li class="catalog-list-item" style="color: var(--text-muted);">Sin elementos.</li>`;
    return;
  }
  c.innerHTML = items.map(item => `
    <li class="catalog-list-item">
      <span>${item.nombre}</span>
      <button onclick="${deleteCb.name}(${item.id})" class="btn btn-outline btn-sm" style="color: var(--danger); border-color: var(--danger);">Eliminar</button>
    </li>
  `).join('');
}

function populateSelects() {
  document.getElementById('event-cat').innerHTML = '<option value="">Selecciona categoria...</option>' +
    cachedCats.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');

  document.getElementById('event-loc').innerHTML = '<option value="">Selecciona ubicacion...</option>' +
    cachedLocs.map(l => `<option value="${l.id}">${l.nombre}</option>`).join('');

  document.getElementById('event-org').innerHTML = '<option value="">Selecciona organizador...</option>' +
    cachedOrgs.map(o => `<option value="${o.id}">${o.nombre}</option>`).join('');
}

function setupCatalogForms() {
  document.getElementById('form-add-cat')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('input-cat');
    try {
      await API.post('/api/categorias', { nombre: input.value.trim() });
      input.value = '';
      showToast('Categoria creada', 'success');
      await loadCatalogs();
    } catch (err) { showToast(err.message, 'error'); }
  });

  document.getElementById('form-add-loc')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('input-loc');
    try {
      await API.post('/api/ubicaciones', { nombre: input.value.trim() });
      input.value = '';
      showToast('Ubicacion creada', 'success');
      await loadCatalogs();
    } catch (err) { showToast(err.message, 'error'); }
  });

  document.getElementById('form-add-org')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('input-org');
    try {
      await API.post('/api/organizadores', { nombre: input.value.trim() });
      input.value = '';
      showToast('Organizador creado', 'success');
      await loadCatalogs();
    } catch (err) { showToast(err.message, 'error'); }
  });
}

async function deleteCategory(id) {
  if (!confirm('Eliminar esta categoria?')) return;
  try {
    await API.delete(`/api/categorias/${id}`);
    await loadCatalogs();
  } catch (err) { showToast(err.message, 'error'); }
}

async function deleteLocation(id) {
  if (!confirm('Eliminar esta ubicacion?')) return;
  try {
    await API.delete(`/api/ubicaciones/${id}`);
    await loadCatalogs();
  } catch (err) { showToast(err.message, 'error'); }
}

async function deleteOrganizer(id) {
  if (!confirm('Eliminar este organizador?')) return;
  try {
    await API.delete(`/api/organizadores/${id}`);
    await loadCatalogs();
  } catch (err) { showToast(err.message, 'error'); }
}

async function loadUsers() {
  const tbody = document.getElementById('admin-users-tbody');
  if (!tbody) return;

  try {
    const users = await API.get('/api/usuarios');
    const cur = AuthStorage.getUser();

    tbody.innerHTML = users.map(u => {
      const isSelf = u.id === cur?.id;
      const roleBadge = u.rol === 'admin' ? '<span class="badge badge-past">Admin</span>' : '<span class="badge badge-upcoming">Estudiante</span>';
      const targetRole = u.rol === 'admin' ? 'estudiante' : 'admin';

      const actions = isSelf ? '<em>(Tu cuenta)</em>' : `
        <div class="table-actions">
          <button onclick="changeRole(${u.id}, '${targetRole}')" class="btn btn-outline btn-sm">Hacer ${targetRole}</button>
          <button onclick="deleteUser(${u.id})" class="btn btn-danger btn-sm">Eliminar</button>
        </div>
      `;

      return `
        <tr>
          <td><strong>#${u.id}</strong></td>
          <td>${u.nombre}</td>
          <td>${u.email}</td>
          <td>${roleBadge}</td>
          <td>${actions}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    showToast('Error al cargar usuarios', 'error');
  }
}

async function changeRole(id, newRole) {
  try {
    const res = await API.put(`/api/usuarios/${id}/rol`, { rol: newRole });
    showToast(res.mensaje, 'success');
    await loadUsers();
    await loadStats();
  } catch (err) { showToast(err.message, 'error'); }
}

async function deleteUser(id) {
  if (!confirm('Eliminar este usuario del sistema?')) return;
  try {
    const res = await API.delete(`/api/usuarios/${id}`);
    showToast(res.mensaje, 'info');
    await loadUsers();
    await loadStats();
  } catch (err) { showToast(err.message, 'error'); }
}

async function loadSuggestions() {
  const container = document.getElementById('admin-suggestions-container');
  if (!container) return;

  try {
    const sugs = await API.get('/api/sugerencias');
    if (sugs.length === 0) {
      container.innerHTML = `<div class="empty-state">No hay sugerencias en el buzon.</div>`;
      return;
    }

    container.innerHTML = sugs.map(s => `
      <div class="suggestion-admin-card">
        <div>
          <span class="suggestion-author">${s.autor_nombre}</span>
          <span class="suggestion-date">(${s.autor_email}) - ${s.fecha}</span>
          <p class="suggestion-text">${s.texto}</p>
        </div>
        <button onclick="deleteSuggestion(${s.id})" class="btn btn-outline btn-sm">Marcar Revisada</button>
      </div>
    `).join('');
  } catch (err) {
    showToast('Error al cargar sugerencias', 'error');
  }
}

async function deleteSuggestion(id) {
  try {
    await API.delete(`/api/sugerencias/${id}`);
    showToast('Sugerencia archivada', 'info');
    await loadSuggestions();
    await loadStats();
  } catch (err) { showToast(err.message, 'error'); }
}
