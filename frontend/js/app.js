// Logica de la pagina principal (index)
let allEvents = [];
let currentFilter = 'todos';

// Cuando se carga la pagina, actualizamos el menu y cargamos los eventos
document.addEventListener('DOMContentLoaded', () => {
  updateNavbar();
  loadPublicEvents();
  setupFilterButtons();
  setupSearchInput();
});

// Trae los eventos desde el backend y los muestra
async function loadPublicEvents() {
  const container = document.getElementById('events-grid');
  if (!container) return;

  try {
    const events = await API.get('/api/eventos');
    allEvents = events;
    applyCurrentFilters();
  } catch (err) {
    container.innerHTML = `<div class="empty-state">No se pudo cargar la lista de eventos.</div>`;
  }
}

// Filtra y busca eventos en tiempo real
function applyCurrentFilters() {
  const searchVal = (document.getElementById('main-search-input')?.value || '').toLowerCase().trim();

  let filtered = allEvents;

  // Filtro por estado
  if (currentFilter === 'proximos') {
    filtered = filtered.filter(e => e.estado === 'proximo' || (!e.es_pasado && e.estado !== 'activo'));
  } else if (currentFilter === 'activos') {
    filtered = filtered.filter(e => e.estado === 'activo');
  } else if (currentFilter === 'pasados') {
    filtered = filtered.filter(e => e.es_pasado || e.estado === 'pasado');
  }

  // Buscador por texto en tiempo real
  if (searchVal) {
    filtered = filtered.filter(e =>
      (e.titulo && e.titulo.toLowerCase().includes(searchVal)) ||
      (e.descripcion && e.descripcion.toLowerCase().includes(searchVal)) ||
      (e.frase_motivacional && e.frase_motivacional.toLowerCase().includes(searchVal)) ||
      (e.ubicacion_nombre && e.ubicacion_nombre.toLowerCase().includes(searchVal)) ||
      (e.categoria_nombre && e.categoria_nombre.toLowerCase().includes(searchVal))
    );
  }

  renderEvents(filtered);
}

function setupSearchInput() {
  const input = document.getElementById('main-search-input');
  if (input) {
    input.addEventListener('input', () => applyCurrentFilters());
  }
}

// Imagen por defecto del colegio si el evento no tiene foto
function getEventThumbnail(url) {
  if (!url || !url.trim()) return '/static/img/cancha_futbol_ideth.jpeg';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/static/')) return url;
  if (url.startsWith('/')) return url;
  return '/static/' + url;
}

// Muestra las tarjetas de eventos de forma limpia y sin exceso de texto
function renderEvents(events) {
  const container = document.getElementById('events-grid');
  if (!container) return;

  if (events.length === 0) {
    container.innerHTML = `<div class="empty-state">No se encontraron eventos con este criterio de busqueda.</div>`;
    return;
  }

  container.innerHTML = events.map(e => {
    let statusBadge = '<span class="badge badge-upcoming">Proximo</span>';
    if (e.estado === 'activo') {
      statusBadge = '<span class="badge badge-active">En Vivo / Hoy</span>';
    } else if (e.es_pasado || e.estado === 'pasado') {
      statusBadge = '<span class="badge badge-past">Finalizado</span>';
    }

    const volunteerBadge = e.permite_voluntarios
      ? '<span class="badge badge-volunteer">Voluntariado</span>'
      : '';

    const categoryBadge = `<span class="badge badge-category">${e.categoria_nombre || 'Deportes'}</span>`;
    const photoUrl = getEventThumbnail(e.imagen_url);

    const mottoHtml = e.frase_motivacional
      ? `<div style="font-style: italic; color: #b45309; font-size: 0.84rem; margin-bottom: 8px;">"${e.frase_motivacional}"</div>`
      : '';

    return `
      <div class="event-card">
        <div class="event-card-img-wrap">
          <img src="${photoUrl}" alt="${e.titulo}" class="event-card-img" onerror="this.src='/static/img/cancha_futbol_ideth.jpeg'">
        </div>
        <div class="event-card-header">
          ${categoryBadge}
          <div style="display: flex; gap: 4px; align-items: center;">
            ${volunteerBadge}
            ${statusBadge}
          </div>
        </div>
        <div class="event-card-body">
          <h3 class="event-card-title">${e.titulo}</h3>
          ${mottoHtml}
          <p class="event-card-desc">${e.descripcion || 'Actividad deportiva escolar.'}</p>
          <div class="event-meta">
            <div><strong>Lugar:</strong> ${e.ubicacion_nombre || 'Cancha Principal'}</div>
            <div><strong>Fecha:</strong> ${e.fecha}</div>
          </div>
        </div>
        <div class="event-card-footer">
          <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600;">
            ${e.total_inscritos || 0} inscritos
          </span>
          <button onclick="openPublicEventDetail(${e.id})" class="btn btn-outline btn-sm">Ver Detalle</button>
        </div>
      </div>
    `;
  }).join('');
}

// Configura los botones de filtro
function setupFilterButtons() {
  const btns = document.querySelectorAll('.main-filter-btn');
  btns.forEach(b => {
    b.addEventListener('click', () => {
      btns.forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      currentFilter = b.dataset.filter || 'todos';
      applyCurrentFilters();
    });
  });
}

// Abre el modal con el detalle completo de un evento
async function openPublicEventDetail(id) {
  try {
    const e = await API.get(`/api/eventos/${id}`);
    document.getElementById('modal-detail-title').textContent = e.titulo;

    const photoUrl = getEventThumbnail(e.imagen_url);

    // Badges
    let statusBadge = '<span class="badge badge-upcoming">Proximo</span>';
    if (e.estado === 'activo') {
      statusBadge = '<span class="badge badge-active">En Vivo / Hoy</span>';
    } else if (e.es_pasado || e.estado === 'pasado') {
      statusBadge = '<span class="badge badge-past">Finalizado</span>';
    }

    const volunteerBadge = e.permite_voluntarios
      ? '<span class="badge badge-volunteer">Voluntariado</span>'
      : '';

    const mottoHtml = e.frase_motivacional
      ? `<div style="font-style: italic; color: #b45309; font-size: 0.9rem; margin-bottom: 12px; text-align: center;">"${e.frase_motivacional}"</div>`
      : '';

    const summaryHtml = (e.es_pasado || e.estado === 'pasado') && e.resumen_pasado
      ? `<div style="background: #f0fdf4; border-left: 3px solid #16a34a; padding: 10px 14px; border-radius: 6px; font-size: 0.88rem; color: #166534; margin-bottom: 14px;"><strong>Resumen:</strong> ${e.resumen_pasado}</div>`
      : '';

    document.getElementById('modal-detail-body').innerHTML = `
      <img src="${photoUrl}" alt="${e.titulo}" class="modal-event-cover" onerror="this.src='/static/img/cancha_futbol_ideth.jpeg'">
      <div class="modal-badges" style="margin-bottom: 8px;">
        <span class="badge badge-category">${e.categoria_nombre || 'Deportes'}</span>
        ${statusBadge}
        ${volunteerBadge}
      </div>
      ${mottoHtml}
      ${summaryHtml}
      <p style="font-size: 0.92rem; color: var(--text-dark); line-height: 1.5; margin-bottom: 14px;">${e.descripcion || 'Actividad deportiva escolar.'}</p>
      <div class="event-meta" style="background: #f8fafc; padding: 12px; border-radius: 8px; margin-bottom: 12px;">
        <div><strong>Lugar:</strong> ${e.ubicacion_nombre || 'Cancha Principal'}</div>
        <div><strong>Fecha:</strong> ${e.fecha}</div>
        <div><strong>Inscritos:</strong> ${e.total_inscritos || 0} estudiantes</div>
      </div>
    `;

    const actionContainer = document.getElementById('modal-detail-action');
    if (AuthStorage.isLoggedIn()) {
      const user = AuthStorage.getUser();
      actionContainer.innerHTML = `<a href="${user.rol === 'admin' ? '/admin' : '/dashboard'}" class="btn btn-primary btn-sm">Ir a mi panel de ${user.rol === 'admin' ? 'Administrador' : 'Estudiante'}</a>`;
    } else {
      actionContainer.innerHTML = `<a href="/login" class="btn btn-primary btn-sm">Iniciar sesion para inscribirse u opinar</a>`;
    }

    openModal('event-detail-modal');
  } catch (err) {
    showToast('No se pudo cargar el detalle del evento', 'error');
  }
}
