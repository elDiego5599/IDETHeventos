// Logica del panel de administrador
let cachedCats = [];
let cachedLocs = [];
let cachedOrgs = [];
let cachedEvents = [];
let editingEventId = null;

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
    showToast('Subiendo foto del evento...', 'info');
    const token = AuthStorage.getToken();
    const res = await fetch('/api/upload-imagen', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Error al subir foto');
    document.getElementById('event-img-url').value = data.url;
    showToast('Foto cargada exitosamente', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Cuando se carga la pagina revisamos que sea admin y cargamos todo
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
  setupSurveyForm();

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
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('active'));
      panes.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const target = document.getElementById(btn.dataset.tab);
      if (target) target.classList.add('active');
    });
  });
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
  } catch (err) {
    console.error(err);
  }
}

// Carga la tabla de eventos para el admin
async function loadEvents() {
  const tbody = document.getElementById('admin-events-tbody');
  if (!tbody) return;

  try {
    const events = await API.get('/api/eventos?tipo=todos');
    cachedEvents = events;

    if (events.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="empty-state">No hay eventos creados todavia.</td></tr>`;
      return;
    }

    tbody.innerHTML = events.map(e => {
      const imgThumb = e.imagen_url
        ? `<img src="${e.imagen_url}" style="width: 44px; height: 34px; object-fit: cover; border-radius: 4px;">`
        : `<span style="font-size: 0.75rem; color: var(--text-muted);">Sin foto</span>`;

      const volunteerBadge = e.permite_voluntarios
        ? '<span class="badge badge-volunteer">Si (Poemas/Staff)</span>'
        : '<span style="font-size: 0.76rem; color: var(--text-muted);">Solo publico</span>';

      return `
        <tr>
          <td><strong>#${e.id}</strong></td>
          <td>${imgThumb}</td>
          <td>
            <strong>${e.titulo}</strong>
            ${e.estado === 'activo' ? '<span class="badge badge-active" style="margin-left: 4px;">En Vivo</span>' : ''}
            ${e.es_pasado ? '<span class="badge badge-past" style="margin-left: 4px;">Finalizado</span>' : ''}
            ${e.frase_motivacional ? `<br><small style="color: var(--text-muted); font-style: italic;">"${e.frase_motivacional}"</small>` : ''}
          </td>
          <td>${e.fecha}</td>
          <td><strong>${e.ubicacion_nombre || 'N/A'}</strong></td>
          <td>${volunteerBadge}</td>
          <td>
            <button onclick="viewEventInscriptions(${e.id}, '${e.titulo.replace(/'/g, "\\'")}')" class="btn btn-outline btn-sm" title="Ver lista de inscritos">
              ${e.total_inscritos} inscritos
            </button>
          </td>
          <td>
            <div class="table-actions">
              <button onclick="openEditEvent(${e.id})" class="btn btn-outline btn-sm">Editar</button>
              <button onclick="deleteEvent(${e.id})" class="btn btn-danger btn-sm">Eliminar</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    showToast('Error al cargar eventos', 'error');
  }
}

// Abre el modal para crear un evento nuevo
function openCreateEvent() {
  editingEventId = null;
  document.getElementById('event-modal-title').textContent = 'Crear Evento Escolar';
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

    document.getElementById('event-modal-title').textContent = `Editar Evento #${id}`;
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
    showToast('Error al cargar datos del evento', 'error');
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
    document.getElementById('inscriptions-modal-title').textContent = `Inscritos: ${titulo}`;
    const tbody = document.getElementById('inscriptions-tbody');
    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center;">Cargando inscritos...</td></tr>`;
    openModal('event-inscriptions-modal');

    const list = await API.get(`/api/eventos/${eventId}/inscritos`);
    if (!list || list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="empty-state">No hay estudiantes inscritos aun.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(i => {
      const isVolunteer = i.tipo_participacion === 'voluntario_activo';
      const roleBadge = isVolunteer
        ? '<span class="badge badge-volunteer">Participante Activo</span>'
        : '<span class="badge badge-category">Asistente</span>';

      const propuesta = isVolunteer && i.detalle_participacion
        ? `<strong>Presenta:</strong> ${i.detalle_participacion}`
        : '<em>(Publico general)</em>';

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
    showToast('Error al cargar inscritos', 'error');
  }
}

// Elimina un evento
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
    c.innerHTML = `<li class="catalog-list-item" style="color: var(--text-muted);">Sin elementos.</li>`;
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
  document.getElementById('event-cat').innerHTML = '<option value="">Selecciona categoria...</option>' +
    cachedCats.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');

  document.getElementById('event-loc').innerHTML = '<option value="">Selecciona zona escolar...</option>' +
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
      showToast('Zona / Ubicacion creada', 'success');
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

// Carga los problemas reportados por estudiantes
async function loadProblems() {
  const container = document.getElementById('admin-problems-container');
  if (!container) return;

  try {
    const problems = await API.get('/api/reportes');
    if (problems.length === 0) {
      container.innerHTML = `<div class="empty-state">No hay inconvenientes reportados. Todo marcha bien!</div>`;
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
            <span>Reportado por: <strong>${p.autor_nombre}</strong> (${p.autor_email}) - ${p.fecha}</span>
            <div style="display: flex; gap: 6px;">
              ${p.estado !== 'resuelto' ? `<button onclick="updateProblemStatus(${p.id}, 'resuelto')" class="btn btn-primary btn-sm">Marcar Resuelto</button>` : ''}
              ${p.estado === 'pendiente' ? `<button onclick="updateProblemStatus(${p.id}, 'en revision')" class="btn btn-outline btn-sm">Poner en Revision</button>` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    showToast('Error al cargar reportes de problemas', 'error');
  }
}

async function updateProblemStatus(id, estado) {
  try {
    await API.put(`/api/reportes/${id}/estado`, { estado });
    showToast(`Inconveniente marcado como '${estado}'`, 'success');
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
      container.innerHTML = `<div class="empty-state">No hay eventos para encuestas.</div>`;
      return;
    }

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 10px;">
        ${cachedEvents.map(e => `
          <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <strong>${e.titulo}</strong>
              <div style="font-size: 0.8rem; color: var(--text-muted);">Fecha: ${e.fecha} | Zona: ${e.ubicacion_nombre || 'N/A'}</div>
            </div>
            <button onclick="checkEventSurvey(${e.id}, '${e.titulo.replace(/'/g, "\\'")}')" class="btn btn-outline btn-sm">Consultar Encuesta</button>
          </div>
        `).join('')}
      </div>
    `;
  } catch (err) {
    console.error(err);
  }
}

function openCreateSurveyModal() {
  const select = document.getElementById('survey-event-id');
  select.innerHTML = '<option value="">Selecciona el evento...</option>' +
    cachedEvents.map(e => `<option value="${e.id}">${e.titulo} (${e.fecha})</option>`).join('');
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
      if (confirm(`El evento '${eventoTitulo}' no tiene una encuesta activa todavia. ¿Deseas crear una ahora?`)) {
        openCreateSurveyModal();
        document.getElementById('survey-event-id').value = eventoId;
      }
      return;
    }
    // Traemos los resultados
    const res = await API.get(`/api/encuestas/${data.id}/resultados`);
    document.getElementById('survey-results-title').textContent = `Resultados: ${res.encuesta.titulo}`;

    const body = document.getElementById('survey-results-body');
    const openAnswersHtml = res.respuestas && res.respuestas.length > 0
      ? res.respuestas.map(r => `
          <div class="survey-result-item">
            <div><strong>${r.autor_nombre}</strong>:</div>
            <div>- Respuesta cerrada 1: <span class="badge badge-category">${r.respuesta_1}</span></div>
            ${r.respuesta_2 ? `<div>- Respuesta cerrada 2: <span class="badge badge-category">${r.respuesta_2}</span></div>` : ''}
            <div style="margin-top: 4px; font-style: italic; color: #1e3a8a;">"${r.respuesta_abierta || 'Sin comentarios'}"</div>
          </div>
        `).join('')
      : '<p style="color: var(--text-muted); font-size: 0.85rem;">Aun ningun estudiante ha respondido esta encuesta.</p>';

    body.innerHTML = `
      <div style="margin-bottom: 12px;">
        <h4 style="margin-bottom: 4px;">Total de estudiantes que respondieron: <strong>${res.total_respuestas}</strong></h4>
        <p style="font-size: 0.84rem; color: var(--text-muted);">Pregunta principal: ${res.encuesta.pregunta_1}</p>
      </div>
      <h5 style="margin-bottom: 8px;">Respuestas y opiniones libres recibidas:</h5>
      <div style="max-height: 280px; overflow-y: auto;">${openAnswersHtml}</div>
    `;

    openModal('survey-results-modal');
  } catch (err) {
    showToast('Error al consultar encuesta', 'error');
  }
}

// Carga las sugerencias
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

