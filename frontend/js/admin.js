// Logica del panel de administrador
let cachedCats = [];
let cachedLocs = [];
let cachedOrgs = [];
let cachedEvents = [];
let editingEventId = null;
let adminEventsPage = 1;
const ADMIN_EVENTS_PER_PAGE = 6;

const PHOTO_PRESETS = {
  futbol: 'img/cancha_futbol_ideth.jpeg',
  cancha2: 'img/cancha_partido_2.jpeg',
  ciencia: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=800&auto=format&fit=crop&q=60',
  literatura: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=800&auto=format&fit=crop&q=60',
  arte: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=800&auto=format&fit=crop&q=60',
  auditorio: 'https://images.unsplash.com/photo-1511578314322-379afb476865?w=800&auto=format&fit=crop&q=60'
};

function setPresetPhoto(tipo) {
  if (PHOTO_PRESETS[tipo]) {
    document.getElementById('event-img-url').value = PHOTO_PRESETS[tipo];
    showToast(`Foto de ${tipo} asignada`, 'info');
  }
}

async function uploadEventImage(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  const formData = new FormData();
  formData.append('file', file);

  try {
    showToast('Subiendo foto...', 'info');
    const token = AuthStorage.getToken();
    const res = await fetch('/api/upload-imagen', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Error al subir foto');
    document.getElementById('event-img-url').value = data.url;
    showToast('Foto cargada', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Cuando se carga la pagina revisamos que sea admin y cargamos todo
document.addEventListener('DOMContentLoaded', async () => {
  const user = AuthStorage.getUser();
  if (!AuthStorage.isLoggedIn() || !user || user.rol !== 'admin') {
    showToast('Acceso solo para administradores', 'error');
    setTimeout(() => { window.location.href = '/login'; }, 800);
    return;
  }

  document.getElementById('admin-badge-name').textContent = user.nombre;

  setupAdminTabs();
  setupCatalogForms();
  setupEventForm();
  setupSurveyForm();
  initSurveyPresets();

  // Cargamos los datos del panel
  await loadStats();
  await loadCatalogs();
  await loadEvents();
  await loadUsers();
  await loadProblems();
  await loadSurveys();
  await loadSuggestions();
});

// Cambia entre las pestañas del panel
function setupAdminTabs() {
  const btns = document.querySelectorAll('.tab-admin-btn');
  const panes = document.querySelectorAll('.admin-tab-pane');

  btns.forEach(btn => {
    btn.addEventListener('click', () => setActiveTab(btns, panes, btn));
  });
}

// Cambia a una pestaña del panel desde otro boton
function goToAdminTab(tabId) {
  const btn = document.querySelector(`.tab-admin-btn[data-tab="${tabId}"]`);
  if (btn) {
    btn.click();
    btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

// Carga las estadisticas numericas del colegio
async function loadStats() {
  try {
    const stats = await API.get('/api/stats');
    document.getElementById('stat-events').textContent = stats.total_eventos || 0;
    document.getElementById('stat-students').textContent = stats.total_estudiantes || 0;
    document.getElementById('stat-inscriptions').textContent = stats.total_inscripciones || 0;
    document.getElementById('stat-problems').textContent = stats.total_problemas || 0;
    document.getElementById('stat-surveys').textContent = stats.total_encuestas || 0;
    document.getElementById('stat-suggestions').textContent = stats.total_sugerencias || 0;
    renderAttentionPanel(stats);
    renderCategoryChart(stats.eventos_por_categoria || []);
    renderTopEventsChart(stats.inscripciones_por_evento || []);
    renderReportsDonut(stats.reportes_por_estado || {});
  } catch (err) {
    console.error(err);
  }
}

// Escapa texto antes de ponerlo en el HTML
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Tarjetas grandes con lo que el admin debe revisar primero
function renderAttentionPanel(stats) {
  const pending = (stats.reportes_por_estado || {}).pendiente || 0;
  document.getElementById('attention-reports-number').textContent = pending;
  document.getElementById('attention-reports').classList.toggle('has-pending', pending > 0);
  document.getElementById('attention-suggestions-number').textContent = stats.total_sugerencias || 0;
  document.getElementById('attention-suggestions').classList.toggle('has-pending', (stats.total_sugerencias || 0) > 0);

  const next = stats.proximo_evento;
  document.getElementById('attention-event-title').textContent = next ? next.titulo : 'Sin eventos próximos';
  document.getElementById('attention-event-sub').textContent = next
    ? `${formatDate(next.fecha)}, ${next.total_inscritos} inscritos`
    : 'Crea un evento.';
}

// Barras horizontales con un color por categoria
function renderCategoryChart(items) {
  const box = document.getElementById('chart-categories');
  if (!box) return;
  if (items.length === 0) {
    box.innerHTML = '<div class="chart-empty">Sin eventos.</div>';
    return;
  }
  const max = Math.max(...items.map(i => i.total), 1);
  box.innerHTML = items.map(item => `
    <div class="bar-row">
      <span class="bar-label" title="${escapeHtml(item.nombre)}">${escapeHtml(item.nombre)}</span>
      <div class="bar-track"><div class="bar-fill" style="width: ${Math.max(item.total / max * 100, 4)}%; background: ${categoryColor(item.nombre)};"></div></div>
      <span class="bar-value">${item.total}</span>
    </div>
  `).join('');
}

// Los 5 eventos con mas inscritos
function renderTopEventsChart(items) {
  const box = document.getElementById('chart-top-events');
  if (!box) return;
  if (items.length === 0 || items.every(i => i.total === 0)) {
    box.innerHTML = '<div class="chart-empty">Sin inscripciones.</div>';
    return;
  }
  const max = Math.max(...items.map(i => i.total), 1);
  box.innerHTML = items.map(item => `
    <div class="bar-row">
      <span class="bar-label" title="${escapeHtml(item.titulo)}">${escapeHtml(item.titulo)}</span>
      <div class="bar-track"><div class="bar-fill" style="width: ${Math.max(item.total / max * 100, 4)}%; background: var(--primary);"></div></div>
      <span class="bar-value">${item.total}</span>
    </div>
  `).join('');
}

// Dona con los reportes pendientes, en revision y resueltos
function renderReportsDonut(counts) {
  const box = document.getElementById('chart-reports');
  if (!box) return;
  const parts = [
    { key: 'pendiente', label: 'Pendientes', color: '#bd443b' },
    { key: 'en revision', label: 'En revisión', color: '#d99a1f' },
    { key: 'resuelto', label: 'Resueltos', color: '#287a4b' }
  ];
  const total = parts.reduce((sum, p) => sum + (counts[p.key] || 0), 0);
  if (total === 0) {
    box.innerHTML = '<div class="chart-empty">Sin reportes.</div>';
    return;
  }
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const arcs = parts.map(p => {
    const value = counts[p.key] || 0;
    const length = value / total * circumference;
    const arc = `<circle cx="60" cy="60" r="${radius}" fill="none" stroke="${p.color}" stroke-width="16" stroke-dasharray="${length} ${circumference - length}" stroke-dashoffset="${-offset}" transform="rotate(-90 60 60)"/>`;
    offset += length;
    return arc;
  }).join('');
  box.innerHTML = `
    <div class="donut-wrap">
      <svg viewBox="0 0 120 120" class="donut-svg" role="img" aria-label="Reportes por estado">
        <circle cx="60" cy="60" r="${radius}" fill="none" stroke="#e8eef5" stroke-width="16"/>
        ${arcs}
        <text x="60" y="58" text-anchor="middle" class="donut-total">${total}</text>
        <text x="60" y="73" text-anchor="middle" class="donut-caption">reportes</text>
      </svg>
      <ul class="donut-legend">
        ${parts.map(p => `<li><span class="legend-dot" style="background: ${p.color};"></span>${p.label}<strong>${counts[p.key] || 0}</strong></li>`).join('')}
      </ul>
    </div>
  `;
}

// Carga la tabla de eventos para el admin
async function loadEvents() {
  const tbody = document.getElementById('admin-events-tbody');
  if (!tbody) return;

  try {
    const events = await API.get('/api/eventos?tipo=todos');
    cachedEvents = events;

    if (events.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="empty-state">No hay eventos.</td></tr>`;
      renderAdminEventsPagination(0);
      return;
    }

    const totalPages = Math.ceil(events.length / ADMIN_EVENTS_PER_PAGE);
    adminEventsPage = Math.min(Math.max(adminEventsPage, 1), totalPages);
    const startIndex = (adminEventsPage - 1) * ADMIN_EVENTS_PER_PAGE;
    const pageEvents = events.slice(startIndex, startIndex + ADMIN_EVENTS_PER_PAGE);
    renderAdminEventsPagination(events.length);

    tbody.innerHTML = pageEvents.map(e => {
      const imgThumb = e.imagen_url
        ? `<img src="${e.imagen_url}" style="width: 44px; height: 34px; object-fit: cover; border-radius: 4px;">`
        : `<span style="font-size: 0.75rem; color: var(--text-muted);">Sin foto</span>`;

      const volunteerBadge = e.permite_voluntarios
        ? '<span class="badge badge-volunteer">Sí</span>'
        : '<span style="font-size: 0.76rem; color: var(--text-muted);">No</span>';

      return `
        <tr>
          <td data-label="ID"><strong>#${e.id}</strong></td>
          <td data-label="Portada">${imgThumb}</td>
          <td data-label="Título">
            <strong>${e.titulo}</strong>
            ${e.estado === 'activo' ? '<span class="badge badge-active" style="margin-left: 4px;">Hoy</span>' : ''}
            ${e.es_pasado ? '<span class="badge badge-past" style="margin-left: 4px;">Finalizado</span>' : ''}
            ${e.frase_motivacional ? `<br><small style="color: var(--text-muted); font-style: italic;">“${cleanQuote(e.frase_motivacional)}”</small>` : ''}
          </td>
          <td data-label="Fecha">${formatDate(e.fecha)}</td>
          <td data-label="Lugar"><strong>${e.ubicacion_nombre || 'N/A'}</strong></td>
          <td data-label="Voluntarios">${volunteerBadge}</td>
          <td data-label="Inscritos">
            <button onclick="viewEventInscriptions(${e.id}, '${e.titulo.replace(/'/g, "\\'")}')" class="btn btn-outline btn-sm" title="Ver lista de inscritos">
              ${e.total_inscritos}
            </button>
          </td>
          <td data-label="Acciones">
            <div class="table-actions">
              <button onclick="openEditEvent(${e.id})" class="btn btn-primary btn-sm">Editar</button>
              <button onclick="deleteEvent(${e.id})" class="btn btn-ghost-danger btn-sm">Eliminar</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    showToast('No se pudieron cargar los eventos', 'error');
  }
}

// Botones para pasar entre paginas de la tabla de eventos
function renderAdminEventsPagination(total) {
  const box = document.getElementById('admin-events-pagination');
  if (!box) return;
  const totalPages = Math.ceil(total / ADMIN_EVENTS_PER_PAGE);
  if (totalPages <= 1) {
    box.innerHTML = total ? `<span class="pagination-info">${total} eventos</span>` : '';
    return;
  }
  const first = (adminEventsPage - 1) * ADMIN_EVENTS_PER_PAGE + 1;
  const last = Math.min(adminEventsPage * ADMIN_EVENTS_PER_PAGE, total);
  const numbers = Array.from({ length: totalPages }, (_, i) => i + 1).map(n => `
    <button type="button" class="page-btn ${n === adminEventsPage ? 'active' : ''}" onclick="goToEventsPage(${n})" aria-label="Pagina ${n}">${n}</button>
  `).join('');
  box.innerHTML = `
    <span class="pagination-info">Mostrando ${first}-${last} de ${total} eventos</span>
    <div class="pagination-controls">
      <button type="button" class="page-btn" onclick="goToEventsPage(${adminEventsPage - 1})" ${adminEventsPage === 1 ? 'disabled' : ''}>Anterior</button>
      ${numbers}
      <button type="button" class="page-btn" onclick="goToEventsPage(${adminEventsPage + 1})" ${adminEventsPage === totalPages ? 'disabled' : ''}>Siguiente</button>
    </div>
  `;
}

function goToEventsPage(page) {
  adminEventsPage = page;
  loadEvents();
}

// Abre el modal para crear un evento nuevo
function openCreateEvent() {
  editingEventId = null;
  document.getElementById('event-modal-title').textContent = 'Crear evento';
  document.getElementById('form-event-admin').reset();
  document.getElementById('event-id').value = '';
  document.getElementById('event-volunteers').checked = false;
  populateSelects();
  openModal('event-form-modal');
}

// Abre el modal para editar un evento existente
async function openEditEvent(id) {
  try {
    const e = await API.get(`/api/eventos/${id}`);
    editingEventId = id;

    document.getElementById('event-modal-title').textContent = `Editar evento`;
    document.getElementById('event-id').value = e.id;
    document.getElementById('event-titulo').value = e.titulo;
    document.getElementById('event-motto').value = e.frase_motivacional || '';
    document.getElementById('event-img-url').value = e.imagen_url || '';
    document.getElementById('event-desc').value = e.descripcion || '';
    document.getElementById('event-fecha').value = e.fecha.replace(' ', 'T');
    document.getElementById('event-volunteers').checked = Boolean(e.permite_voluntarios);
    document.getElementById('event-summary').value = e.resumen_pasado || '';

    populateSelects();
    document.getElementById('event-cat').value = e.categoria_id || '';
    document.getElementById('event-loc').value = e.ubicacion_id || '';
    document.getElementById('event-org').value = e.organizador_id || '';

    openModal('event-form-modal');
  } catch (err) {
    showToast('No se pudo cargar el evento', 'error');
  }
}

// Configura el formulario de crear y editar eventos
function setupEventForm() {
  const form = document.getElementById('form-event-admin');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const titulo = document.getElementById('event-titulo').value.trim();
    const frase_motivacional = document.getElementById('event-motto').value.trim();
    const imagen_url = document.getElementById('event-img-url').value.trim();
    const descripcion = document.getElementById('event-desc').value.trim();
    const rawFecha = document.getElementById('event-fecha').value;
    const fecha = rawFecha.replace('T', ' ');
    const categoria_id = parseInt(document.getElementById('event-cat').value, 10) || null;
    const ubicacion_id = parseInt(document.getElementById('event-loc').value, 10) || null;
    const organizador_id = parseInt(document.getElementById('event-org').value, 10) || null;
    const permite_voluntarios = document.getElementById('event-volunteers').checked;
    const resumen_pasado = document.getElementById('event-summary').value.trim();

    const payload = {
      titulo,
      frase_motivacional,
      imagen_url,
      descripcion,
      fecha,
      categoria_id,
      ubicacion_id,
      organizador_id,
      permite_voluntarios,
      resumen_pasado
    };

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

// Ver lista de inscritos por evento
async function viewEventInscriptions(eventId, titulo) {
  try {
    document.getElementById('inscriptions-modal-title').textContent = `${titulo}`;
    const tbody = document.getElementById('inscriptions-tbody');
    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center;">Cargando...</td></tr>`;
    openModal('event-inscriptions-modal');

    const list = await API.get(`/api/eventos/${eventId}/inscritos`);
    if (!list || list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="empty-state">Sin inscritos.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(i => {
      const isVolunteer = i.tipo_participacion === 'voluntario_activo';
      const roleBadge = isVolunteer
        ? '<span class="badge badge-volunteer">Voluntario</span>'
        : '<span class="badge badge-category">Asistente</span>';

      const propuesta = isVolunteer && i.detalle_participacion
        ? `${i.detalle_participacion}`
        : '-';

      return `
        <tr>
          <td><strong>${i.nombre}</strong></td>
          <td>${i.email}</td>
          <td>${roleBadge}</td>
          <td>${propuesta}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    showToast('No se pudieron cargar los inscritos', 'error');
  }
}

// Elimina un evento
async function deleteEvent(id) {
  if (!(await confirmDialog('¿Eliminar el evento? Se borran sus inscripciones.', 'Eliminar'))) return;
  try {
    const res = await API.delete(`/api/eventos/${id}`);
    showToast(res.mensaje, 'info');
    await loadEvents();
    await loadStats();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Carga las categorias, ubicaciones y organizadores
async function loadCatalogs() {
  try {
    const cats = await API.get('/api/categorias');
    const locs = await API.get('/api/ubicaciones');
    const orgs = await API.get('/api/organizadores');

    cachedCats = cats;
    cachedLocs = locs;
    cachedOrgs = orgs;

    renderCatalogList('list-cats', cats, 'cat');
    renderCatalogList('list-locs', locs, 'loc');
    renderCatalogList('list-orgs', orgs, 'org');

    document.getElementById('count-cats').textContent = cats.length;
    document.getElementById('count-locs').textContent = locs.length;
    document.getElementById('count-orgs').textContent = orgs.length;
  } catch (err) {
    console.error(err);
  }
}

function renderCatalogList(containerId, items, tipo) {
  const c = document.getElementById(containerId);
  if (!c) return;
  if (items.length === 0) {
    c.innerHTML = `<li class="catalog-list-item" style="color: var(--text-muted);">Vacío.</li>`;
    return;
  }
  let funcionEliminar = '';
  if (tipo === 'cat') funcionEliminar = 'deleteCategory';
  if (tipo === 'loc') funcionEliminar = 'deleteLocation';
  if (tipo === 'org') funcionEliminar = 'deleteOrganizer';

  c.innerHTML = items.map(item => `
    <li class="catalog-list-item">
      <span>${item.nombre}</span>
      <button onclick="${funcionEliminar}(${item.id})" class="btn btn-outline btn-sm" style="color: var(--danger); border-color: var(--danger);">Eliminar</button>
    </li>
  `).join('');
}

function populateSelects() {
  document.getElementById('event-cat').innerHTML = '<option value="">Selecciona una categoría</option>' +
    cachedCats.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');

  document.getElementById('event-loc').innerHTML = '<option value="">Selecciona un lugar</option>' +
    cachedLocs.map(l => `<option value="${l.id}">${l.nombre}</option>`).join('');

  document.getElementById('event-org').innerHTML = '<option value="">Selecciona un organizador</option>' +
    cachedOrgs.map(o => `<option value="${o.id}">${o.nombre}</option>`).join('');
}

function setupCatalogForms() {
  document.getElementById('form-add-cat')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('input-cat');
    try {
      await API.post('/api/categorias', { nombre: input.value.trim() });
      input.value = '';
      showToast('Categoría creada', 'success');
      await loadCatalogs();
    } catch (err) { showToast(err.message, 'error'); }
  });

  document.getElementById('form-add-loc')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('input-loc');
    try {
      await API.post('/api/ubicaciones', { nombre: input.value.trim() });
      input.value = '';
      showToast('Lugar creado', 'success');
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
  if (!(await confirmDialog('¿Eliminar la categoría?', 'Eliminar'))) return;
  try {
    await API.delete(`/api/categorias/${id}`);
    await loadCatalogs();
  } catch (err) { showToast(err.message, 'error'); }
}

async function deleteLocation(id) {
  if (!(await confirmDialog('¿Eliminar el lugar?', 'Eliminar'))) return;
  try {
    await API.delete(`/api/ubicaciones/${id}`);
    await loadCatalogs();
  } catch (err) { showToast(err.message, 'error'); }
}

async function deleteOrganizer(id) {
  if (!(await confirmDialog('¿Eliminar el organizador?', 'Eliminar'))) return;
  try {
    await API.delete(`/api/organizadores/${id}`);
    await loadCatalogs();
  } catch (err) { showToast(err.message, 'error'); }
}

// Carga la tabla de usuarios
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

      const actions = isSelf ? '<em>Tu cuenta</em>' : `
        <div class="table-actions">
          <button onclick="changeRole(${u.id}, '${targetRole}')" class="btn btn-outline btn-sm">Hacer ${targetRole}</button>
          <button onclick="deleteUser(${u.id})" class="btn btn-ghost-danger btn-sm">Eliminar</button>
        </div>
      `;

      return `
        <tr>
          <td data-label="Nombre">${u.nombre}</td>
          <td data-label="Correo">${u.email}</td>
          <td data-label="Rol">${roleBadge}</td>
          <td data-label="Acciones">${actions}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    showToast('No se pudieron cargar los usuarios', 'error');
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
  if (!(await confirmDialog('¿Eliminar el usuario? Se borran sus inscripciones.', 'Eliminar'))) return;
  try {
    const res = await API.delete(`/api/usuarios/${id}`);
    showToast(res.mensaje, 'info');
    await loadUsers();
    await loadStats();
  } catch (err) { showToast(err.message, 'error'); }
}

// Carga los problemas reportados por estudiantes
async function loadProblems() {
  const container = document.getElementById('admin-problems-container');
  if (!container) return;

  try {
    const problems = await API.get('/api/reportes');
    const summary = document.getElementById('report-summary');
    if (summary) {
      const count = estado => problems.filter(p => p.estado === estado).length;
      summary.innerHTML = `
        <div class="report-summary-item status-pendiente"><strong>${count('pendiente')}</strong><span>Pendientes</span></div>
        <div class="report-summary-item status-revision"><strong>${count('en revision')}</strong><span>En revision</span></div>
        <div class="report-summary-item status-resuelto"><strong>${count('resuelto')}</strong><span>Resueltos</span></div>
      `;
    }
    if (problems.length === 0) {
      container.innerHTML = `<div class="empty-state">No hay reportes.</div>`;
      return;
    }

    container.innerHTML = problems.map(p => {
      let statusClass = 'status-pendiente';
      if (p.estado === 'en revision') statusClass = 'status-revision';
      if (p.estado === 'resuelto') statusClass = 'status-resuelto';

      return `
        <div class="report-card">
          <div class="report-header">
            <div>
              <span class="report-type">${p.tipo_problema}</span>
              ${p.evento_titulo ? `<span style="font-weight: 600; margin-left: 8px;">en "${p.evento_titulo}"</span>` : ''}
            </div>
            <span class="report-status ${statusClass}">${p.estado}</span>
          </div>
          <p class="report-desc">${p.descripcion}</p>
          <div class="report-meta" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <span><strong>${p.autor_nombre}</strong>, ${formatDate(p.fecha)}</span>
            <div style="display: flex; gap: 6px;">
              ${p.estado !== 'resuelto' ? `<button onclick="updateProblemStatus(${p.id}, 'resuelto')" class="btn btn-primary btn-sm">Marcar resuelto</button>` : ''}
              ${p.estado === 'pendiente' ? `<button onclick="updateProblemStatus(${p.id}, 'en revision')" class="btn btn-outline btn-sm">Poner en revisión</button>` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    showToast('No se pudieron cargar los reportes', 'error');
  }
}

async function updateProblemStatus(id, estado) {
  try {
    await API.put(`/api/reportes/${id}/estado`, { estado });
    showToast(`Reporte: ${estado}`, 'success');
    await loadProblems();
    await loadStats();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Encuestas Escolares
async function loadSurveys() {
  const container = document.getElementById('admin-surveys-container');
  if (!container) return;

  try {
    // Si hay eventos, mostramos botones para ver encuestas
    if (cachedEvents.length === 0) {
      container.innerHTML = `<div class="empty-state">No hay eventos.</div>`;
      return;
    }

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 10px;">
        ${cachedEvents.map(e => `
          <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <strong>${e.titulo}</strong>
              <div style="font-size: 0.8rem; color: var(--text-muted);">${formatDate(e.fecha)}${e.ubicacion_nombre ? ', ' + e.ubicacion_nombre : ''}</div>
            </div>
            <button onclick="checkEventSurvey(${e.id}, '${e.titulo.replace(/'/g, "\\'")}')" class="btn btn-outline btn-sm">Ver encuesta</button>
          </div>
        `).join('')}
      </div>
    `;
  } catch (err) {
    console.error(err);
  }
}

// Opciones de seleccion para las preguntas cerradas de la encuesta
function applySurveyPreset(n) {
  const select = document.getElementById(`survey-preset-${n}`);
  const input = document.getElementById(`survey-opt${n}`);
  if (!select || !input) return;
  const custom = select.value === 'custom';
  input.style.display = custom ? 'block' : 'none';
  if (!custom) input.value = select.value;
  renderOptionChips(n);
}

function renderOptionChips(n) {
  const chips = document.getElementById(`survey-chips-${n}`);
  const input = document.getElementById(`survey-opt${n}`);
  if (!chips || !input) return;
  chips.innerHTML = input.value.split(',').map(o => o.trim()).filter(Boolean)
    .map(o => `<span class="option-chip">${escapeHtml(o)}</span>`).join('');
}

function initSurveyPresets() {
  const q2 = document.getElementById('survey-preset-2');
  if (q2) q2.value = 'Sí,Tal vez,No';
  applySurveyPreset(1);
  applySurveyPreset(2);
  document.getElementById('survey-opt1')?.addEventListener('input', () => renderOptionChips(1));
  document.getElementById('survey-opt2')?.addEventListener('input', () => renderOptionChips(2));
}

function openCreateSurveyModal() {
  const select = document.getElementById('survey-event-id');
  select.innerHTML = '<option value="">Selecciona un evento</option>' +
    cachedEvents.map(e => `<option value="${e.id}">${e.titulo} (${formatDate(e.fecha)})</option>`).join('');
  openModal('survey-form-modal');
}

function setupSurveyForm() {
  const form = document.getElementById('form-survey-admin');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const evento_id = parseInt(document.getElementById('survey-event-id').value, 10);
    const titulo = document.getElementById('survey-title').value.trim();
    const pregunta_1 = document.getElementById('survey-q1').value.trim();
    const opciones_1 = document.getElementById('survey-opt1').value.trim();
    if (opciones_1.split(',').filter(o => o.trim()).length < 2) {
      showToast('La pregunta 1 necesita al menos dos opciones', 'error');
      return;
    }
    const pregunta_2 = document.getElementById('survey-q2').value.trim();
    const opciones_2 = document.getElementById('survey-opt2').value.trim();
    const pregunta_abierta = document.getElementById('survey-qopen').value.trim();

    try {
      const res = await API.post('/api/encuestas', {
        evento_id,
        titulo,
        pregunta_1,
        opciones_1,
        pregunta_2: pregunta_2 || null,
        opciones_2: opciones_2 || null,
        pregunta_abierta
      });
      showToast(res.mensaje, 'success');
      closeModal('survey-form-modal');
      await loadStats();
      await loadSurveys();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

async function checkEventSurvey(eventoId, eventoTitulo) {
  try {
    const data = await API.get(`/api/encuestas/evento/${eventoId}`);
    if (!data.tiene_encuesta) {
      if (await confirmDialog('Este evento no tiene encuesta. ¿Crear una?', 'Crear')) {
        openCreateSurveyModal();
        document.getElementById('survey-event-id').value = eventoId;
      }
      return;
    }
    // Traemos los resultados
    const res = await API.get(`/api/encuestas/${data.id}/resultados`);
    document.getElementById('survey-results-title').textContent = `${res.encuesta.titulo}`;

    const body = document.getElementById('survey-results-body');
    const openAnswersHtml = res.respuestas && res.respuestas.length > 0
      ? res.respuestas.map(r => `
          <div class="survey-result-item">
            <div><strong>${r.autor_nombre}</strong>:</div>
            <div>1: <span class="badge badge-category">${r.respuesta_1}</span></div>
            ${r.respuesta_2 ? `<div>2: <span class="badge badge-category">${r.respuesta_2}</span></div>` : ''}
            <div style="margin-top: 4px; font-style: italic; color: #1e3a8a;">"${r.respuesta_abierta || 'Sin comentario'}"</div>
          </div>
        `).join('')
      : '<p style="color: var(--text-muted); font-size: 0.85rem;">Sin respuestas.</p>';

    body.innerHTML = `
      <div style="margin-bottom: 12px;">
        <h4 style="margin-bottom: 4px;">Respuestas: <strong>${res.total_respuestas}</strong></h4>
        <p style="font-size: 0.84rem; color: var(--text-muted);">${res.encuesta.pregunta_1}</p>
      </div>
      <h5 style="margin-bottom: 8px;">Opiniones</h5>
      <div style="max-height: 280px; overflow-y: auto;">${openAnswersHtml}</div>
    `;

    openModal('survey-results-modal');
  } catch (err) {
    showToast('No se pudo cargar la encuesta', 'error');
  }
}

// Carga las sugerencias
async function loadSuggestions() {
  const container = document.getElementById('admin-suggestions-container');
  if (!container) return;

  try {
    const sugs = await API.get('/api/sugerencias');
    if (sugs.length === 0) {
      container.innerHTML = `<div class="empty-state">No hay sugerencias.</div>`;
      return;
    }

    container.innerHTML = sugs.map(s => `
      <div class="suggestion-admin-card">
        <div>
          <span class="suggestion-author">${s.autor_nombre}</span>
          <span class="suggestion-date">${s.autor_email}, ${formatDate(s.fecha)}</span>
          <p class="suggestion-text">${s.texto}</p>
        </div>
        <button onclick="deleteSuggestion(${s.id})" class="btn btn-outline btn-sm">Marcar revisada</button>
      </div>
    `).join('');
  } catch (err) {
    showToast('No se pudieron cargar las sugerencias', 'error');
  }
}

async function deleteSuggestion(id) {
  try {
    await API.delete(`/api/sugerencias/${id}`);
    showToast('Sugerencia revisada', 'info');
    await loadSuggestions();
    await loadStats();
  } catch (err) { showToast(err.message, 'error'); }
}

