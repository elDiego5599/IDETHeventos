/**
 * admin.js - Controlador del Panel de Administración
 * CRUD completo de eventos, catálogos (categorías, ubicaciones, organizadores), usuarios y sugerencias.
 */

let cachedCategories = [];
let cachedLocations = [];
let cachedOrganizers = [];
let editingEventId = null;

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Proteger ruta: verificar que sea Administrador
  const user = AuthStorage.getUser();
  if (!AuthStorage.isLoggedIn() || !user || user.rol !== 'admin') {
    showToast('Acceso denegado: Se requieren permisos de Administrador.', 'error');
    setTimeout(() => { window.location.href = '/'; }, 1000);
    return;
  }

  // 2. Personalizar header
  const nameBadge = document.getElementById('admin-name-badge');
  if (nameBadge) nameBadge.textContent = `🛡️ Admin: ${user.nombre}`;

  // 3. Configurar pestañas y formularios
  setupAdminTabs();
  setupCatalogForms();
  setupEventForm();

  // 4. Cargar datos iniciales
  await loadAdminStats();
  await loadCatalogsData();
  await loadAdminEvents();
  await loadAdminUsers();
  await loadAdminSuggestions();
});

// Cambiar entre pestañas en el panel admin
function setupAdminTabs() {
  const buttons = document.querySelectorAll('.tab-admin-btn');
  const panes = document.querySelectorAll('.admin-tab-pane');

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => {
        b.classList.remove('btn-primary');
        b.classList.add('btn-outline');
      });
      panes.forEach(p => p.style.display = 'none');

      btn.classList.remove('btn-outline');
      btn.classList.add('btn-primary');

      const targetPane = document.getElementById(btn.dataset.tab);
      if (targetPane) targetPane.style.display = 'block';
    });
  });
}

// Cargar métricas del dashboard
async function loadAdminStats() {
  try {
    const stats = await API.get('/api/stats');
    document.getElementById('stat-total-events').textContent = stats.total_eventos || 0;
    document.getElementById('stat-total-students').textContent = stats.total_estudiantes || 0;
    document.getElementById('stat-total-inscriptions').textContent = stats.total_inscripciones || 0;
    document.getElementById('stat-total-suggestions').textContent = stats.total_sugerencias || 0;
  } catch (err) {
    console.error('Error cargando estadísticas:', err);
  }
}

// =====================================================================
// GESTIÓN DE EVENTOS (CRUD)
// =====================================================================

async function loadAdminEvents() {
  const tbody = document.getElementById('admin-events-tbody');
  if (!tbody) return;

  try {
    const events = await API.get('/api/eventos?tipo=todos');
    
    if (events.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 30px;">No hay eventos creados. Haz clic en "Crear Nuevo Evento".</td></tr>`;
      return;
    }

    tbody.innerHTML = events.map(e => `
      <tr>
        <td><strong>#${e.id}</strong></td>
        <td>
          <strong>${e.titulo}</strong>
          ${e.es_pasado ? '<span class="badge badge-status-past" style="margin-left: 6px;">Finalizado</span>' : ''}
        </td>
        <td>${e.fecha}</td>
        <td><span class="badge badge-category">${e.categoria_nombre || 'N/A'}</span></td>
        <td>${e.ubicacion_nombre || 'N/A'}</td>
        <td>${e.organizador_nombre || 'IDETH'}</td>
        <td><span class="badge badge-enrolled">${e.total_inscritos} estudiantes</span></td>
        <td>
          <div class="table-actions">
            <button onclick="openEditEventModal(${e.id})" class="btn btn-outline btn-sm">Editar</button>
            <button onclick="deleteEvent(${e.id})" class="btn btn-danger btn-sm">Eliminar</button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    showToast('Error al cargar la lista de eventos.', 'error');
  }
}

function openCreateEventModal() {
  editingEventId = null;
  document.getElementById('event-form-modal-title').textContent = 'Crear Nuevo Evento Escolar';
  document.getElementById('event-admin-form').reset();
  document.getElementById('event-form-id').value = '';
  populateSelectOptions();

  openModal('event-form-modal');
}

async function openEditEventModal(eventId) {
  try {
    const event = await API.get(`/api/eventos/${eventId}`);
    editingEventId = eventId;

    document.getElementById('event-form-modal-title').textContent = `Editar Evento #${eventId}`;
    document.getElementById('event-form-id').value = event.id;
    document.getElementById('event-form-titulo').value = event.titulo;
    document.getElementById('event-form-descripcion').value = event.descripcion || '';
    
    // Formatear fecha para el input datetime-local (YYYY-MM-DDTHH:MM)
    const formattedDate = event.fecha.replace(' ', 'T');
    document.getElementById('event-form-fecha').value = formattedDate;

    populateSelectOptions();
    document.getElementById('event-form-categoria').value = event.categoria_id || '';
    document.getElementById('event-form-ubicacion').value = event.ubicacion_id || '';
    document.getElementById('event-form-organizador').value = event.organizador_id || '';

    openModal('event-form-modal');
  } catch (err) {
    showToast('No se pudo cargar la información del evento.', 'error');
  }
}

function closeEventFormModal() {
  closeModal('event-form-modal');
  editingEventId = null;
}

function setupEventForm() {
  const form = document.getElementById('event-admin-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const titulo = document.getElementById('event-form-titulo').value.trim();
    const descripcion = document.getElementById('event-form-descripcion').value.trim();
    const rawFecha = document.getElementById('event-form-fecha').value; // Ej: 2026-09-15T14:30
    const fecha = rawFecha.replace('T', ' '); // Formato: 2026-09-15 14:30
    const categoria_id = parseInt(document.getElementById('event-form-categoria').value, 10) || null;
    const ubicacion_id = parseInt(document.getElementById('event-form-ubicacion').value, 10) || null;
    const organizador_id = parseInt(document.getElementById('event-form-organizador').value, 10) || null;

    const payload = { titulo, descripcion, fecha, categoria_id, ubicacion_id, organizador_id };
    const btn = document.getElementById('btn-save-event');

    try {
      btn.disabled = true;
      if (editingEventId) {
        // Actualizar evento existente
        const res = await API.put(`/api/eventos/${editingEventId}`, payload);
        showToast(res.mensaje, 'success');
      } else {
        // Crear nuevo evento
        const res = await API.post('/api/eventos', payload);
        showToast(res.mensaje, 'success');
      }

      closeEventFormModal();
      await loadAdminEvents();
      await loadAdminStats();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });
}

async function deleteEvent(eventId) {
  if (!confirm(`¿Estás seguro de que deseas eliminar permanentemente el evento #${eventId}?`)) return;

  try {
    const res = await API.delete(`/api/eventos/${eventId}`);
    showToast(res.mensaje, 'success');
    await loadAdminEvents();
    await loadAdminStats();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// =====================================================================
// GESTIÓN DE CATÁLOGOS (CATEGORÍAS, UBICACIONES, ORGANIZADORES)
// =====================================================================

async function loadCatalogsData() {
  try {
    const [cats, locs, orgs] = await Promise.all([
      API.get('/api/categorias'),
      API.get('/api/ubicaciones'),
      API.get('/api/organizadores')
    ]);

    cachedCategories = cats;
    cachedLocations = locs;
    cachedOrganizers = orgs;

    renderCatalogList('list-categories', cats, deleteCategory);
    renderCatalogList('list-locations', locs, deleteLocation);
    renderCatalogList('list-organizers', orgs, deleteOrganizer);

    document.getElementById('count-categories').textContent = cats.length;
    document.getElementById('count-locations').textContent = locs.length;
    document.getElementById('count-organizers').textContent = orgs.length;

  } catch (err) {
    console.error('Error al cargar catálogos:', err);
  }
}

function renderCatalogList(containerId, items, deleteCallback) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (items.length === 0) {
    container.innerHTML = `<li style="padding: 10px; color: var(--text-muted); font-size: 0.85rem;">No hay registros.</li>`;
    return;
  }

  container.innerHTML = items.map(item => `
    <li class="catalog-list-item">
      <span>${item.nombre}</span>
      <button onclick="${deleteCallback.name}(${item.id})" class="btn btn-outline btn-sm" style="padding: 2px 8px; color: var(--danger); border-color: var(--danger);">✕</button>
    </li>
  `).join('');
}

function populateSelectOptions() {
  const catSelect = document.getElementById('event-form-categoria');
  const locSelect = document.getElementById('event-form-ubicacion');
  const orgSelect = document.getElementById('event-form-organizador');

  if (catSelect) {
    catSelect.innerHTML = '<option value="">Selecciona una categoría...</option>' +
      cachedCategories.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
  }

  if (locSelect) {
    locSelect.innerHTML = '<option value="">Selecciona una ubicación...</option>' +
      cachedLocations.map(l => `<option value="${l.id}">${l.nombre}</option>`).join('');
  }

  if (orgSelect) {
    orgSelect.innerHTML = '<option value="">Selecciona un organizador...</option>' +
      cachedOrganizers.map(o => `<option value="${o.id}">${o.nombre}</option>`).join('');
  }
}

function setupCatalogForms() {
  // Categorías
  const formCat = document.getElementById('form-add-category');
  if (formCat) {
    formCat.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = document.getElementById('input-cat-name');
      try {
        await API.post('/api/categorias', { nombre: input.value.trim() });
        showToast('Categoría agregada con éxito.', 'success');
        input.value = '';
        await loadCatalogsData();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  // Ubicaciones
  const formLoc = document.getElementById('form-add-location');
  if (formLoc) {
    formLoc.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = document.getElementById('input-loc-name');
      try {
        await API.post('/api/ubicaciones', { nombre: input.value.trim() });
        showToast('Ubicación agregada con éxito.', 'success');
        input.value = '';
        await loadCatalogsData();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  // Organizadores
  const formOrg = document.getElementById('form-add-organizer');
  if (formOrg) {
    formOrg.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = document.getElementById('input-org-name');
      try {
        await API.post('/api/organizadores', { nombre: input.value.trim() });
        showToast('Organizador agregado con éxito.', 'success');
        input.value = '';
        await loadCatalogsData();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }
}

async function deleteCategory(id) {
  if (!confirm('¿Eliminar esta categoría?')) return;
  try {
    await API.delete(`/api/categorias/${id}`);
    showToast('Categoría eliminada', 'info');
    await loadCatalogsData();
  } catch (err) { showToast(err.message, 'error'); }
}

async function deleteLocation(id) {
  if (!confirm('¿Eliminar esta ubicación?')) return;
  try {
    await API.delete(`/api/ubicaciones/${id}`);
    showToast('Ubicación eliminada', 'info');
    await loadCatalogsData();
  } catch (err) { showToast(err.message, 'error'); }
}

async function deleteOrganizer(id) {
  if (!confirm('¿Eliminar este organizador?')) return;
  try {
    await API.delete(`/api/organizadores/${id}`);
    showToast('Organizador eliminado', 'info');
    await loadCatalogsData();
  } catch (err) { showToast(err.message, 'error'); }
}

// =====================================================================
// GESTIÓN DE USUARIOS
// =====================================================================

async function loadAdminUsers() {
  const tbody = document.getElementById('admin-users-tbody');
  if (!tbody) return;

  try {
    const users = await API.get('/api/usuarios');
    const currentUser = AuthStorage.getUser();

    tbody.innerHTML = users.map(u => {
      const isSelf = u.id === currentUser?.id;
      const roleBadge = u.rol === 'admin'
        ? '<span class="badge" style="background:#fee2e2; color:#b91c1c;">Administrador</span>'
        : '<span class="badge" style="background:#e0e7ff; color:#3730a3;">Estudiante</span>';

      const nextRole = u.rol === 'admin' ? 'estudiante' : 'admin';
      const switchRoleBtn = isSelf ? '' : `
        <button onclick="changeUserRole(${u.id}, '${nextRole}')" class="btn btn-outline btn-sm">
          Convertir a ${nextRole}
        </button>
      `;

      const deleteBtn = isSelf ? '' : `
        <button onclick="deleteUser(${u.id})" class="btn btn-danger btn-sm">Eliminar</button>
      `;

      return `
        <tr>
          <td><strong>#${u.id}</strong></td>
          <td>${u.nombre} ${isSelf ? '<em>(Tú)</em>' : ''}</td>
          <td>${u.email}</td>
          <td>${roleBadge}</td>
          <td>
            <div class="table-actions">
              ${switchRoleBtn}
              ${deleteBtn}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    showToast('Error al cargar la lista de usuarios.', 'error');
  }
}

async function changeUserRole(userId, newRole) {
  if (!confirm(`¿Cambiar el rol de este usuario a '${newRole}'?`)) return;

  try {
    const res = await API.put(`/api/usuarios/${userId}/rol`, { rol: newRole });
    showToast(res.mensaje, 'success');
    await loadAdminUsers();
    await loadAdminStats();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteUser(userId) {
  if (!confirm('¿Estás seguro de eliminar este usuario? Sus datos de acceso serán removidos.')) return;

  try {
    const res = await API.delete(`/api/usuarios/${userId}`);
    showToast(res.mensaje, 'success');
    await loadAdminUsers();
    await loadAdminStats();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// =====================================================================
// REVISIÓN DE SUGERENCIAS
// =====================================================================

async function loadAdminSuggestions() {
  const container = document.getElementById('admin-suggestions-container');
  if (!container) return;

  try {
    const suggestions = await API.get('/api/sugerencias');

    if (suggestions.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px; background: white; border-radius: var(--radius-md); border: 1px dashed var(--border-color);">
          <p style="color: var(--text-muted);">No hay sugerencias pendientes en el buzón.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = suggestions.map(s => `
      <div class="suggestion-admin-card">
        <div style="flex: 1;">
          <div style="display: flex; gap: 10px; align-items: baseline; margin-bottom: 6px;">
            <span class="suggestion-author">🎓 ${s.autor_nombre}</span>
            <span class="suggestion-date">(${s.autor_email}) • ${s.fecha}</span>
          </div>
          <p style="font-size: 0.95rem; color: var(--text-main); line-height: 1.5;">${s.texto}</p>
        </div>
        <button onclick="deleteSuggestion(${s.id})" class="btn btn-outline btn-sm" style="color: var(--accent); border-color: var(--accent);">
          ✓ Marcar Revisada
        </button>
      </div>
    `).join('');
  } catch (err) {
    showToast('Error al cargar sugerencias.', 'error');
  }
}

async function deleteSuggestion(id) {
  try {
    await API.delete(`/api/sugerencias/${id}`);
    showToast('Sugerencia archivada/marcada como revisada.', 'info');
    await loadAdminSuggestions();
    await loadAdminStats();
  } catch (err) {
    showToast(err.message, 'error');
  }
}
