/**
 * app.js - Lógica de la Página de Inicio (Index)
 * Carga eventos públicos, categorías dinámicas y modal de detalles para visitantes.
 */

let allEvents = [];
let allCategories = [];
let currentFilter = 'todos';

document.addEventListener('DOMContentLoaded', () => {
  loadCategories();
  loadPublicEvents();
  setupFilterButtons();
});

// Cargar categorías para la barra de filtros
async function loadCategories() {
  try {
    const categories = await API.get('/api/categorias');
    allCategories = categories;
    const filterContainer = document.getElementById('category-filters');
    if (!filterContainer) return;

    // Agregar botones de categoría
    categories.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'filter-btn';
      btn.dataset.category = cat.id;
      btn.textContent = cat.nombre;
      btn.addEventListener('click', () => filterByCategory(cat.id, btn));
      filterContainer.appendChild(btn);
    });
  } catch (err) {
    console.error('Error al cargar categorías:', err);
  }
}

// Cargar eventos desde el backend
async function loadPublicEvents() {
  const container = document.getElementById('events-grid');
  if (!container) return;

  try {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">
        <p>Cargando los eventos del colegio...</p>
      </div>
    `;

    const events = await API.get('/api/eventos');
    allEvents = events;
    renderEvents(events);
  } catch (err) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--danger);">
        <p>Hubo un problema al conectar con el servidor.</p>
      </div>
    `;
  }
}

// Renderizar tarjetas de eventos en el grid
function renderEvents(events) {
  const container = document.getElementById('events-grid');
  if (!container) return;

  if (events.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 50px; background: white; border-radius: var(--radius-md); border: 1px dashed var(--border-color);">
        <p style="font-size: 1.1rem; color: var(--text-muted); margin-bottom: 8px;">No hay eventos disponibles en este momento.</p>
        <span style="font-size: 0.9rem; color: var(--text-light);">Vuelve a revisar pronto para conocer nuevas actividades.</span>
      </div>
    `;
    return;
  }

  container.innerHTML = events.map(event => {
    const isPast = event.es_pasado;
    const statusBadge = isPast 
      ? '<span class="badge badge-status-past">Finalizado</span>'
      : '<span class="badge badge-status-upcoming">Próximo</span>';

    const categoryBadge = event.categoria_nombre 
      ? `<span class="badge badge-category">${event.categoria_nombre}</span>` 
      : '<span class="badge badge-category">General</span>';

    const ratingStars = event.calificacion_promedio 
      ? `<div class="rating-display"><span class="star-icon">★</span> ${event.calificacion_promedio} (${event.total_calificaciones})</div>`
      : `<div class="rating-display" style="color: var(--text-light); font-weight: normal;">Sin calificaciones</div>`;

    return `
      <div class="event-card">
        <div class="event-card-header">
          ${categoryBadge}
          ${statusBadge}
        </div>
        <div class="event-card-body">
          <h3 class="event-card-title">${event.titulo}</h3>
          <p class="event-card-desc">${event.descripcion || 'Sin descripción detallada disponible.'}</p>
          
          <div class="event-meta">
            <div class="event-meta-item">
              <span class="icon">📅</span>
              <span><strong>Fecha:</strong> ${formatDate(event.fecha)}</span>
            </div>
            <div class="event-meta-item">
              <span class="icon">📍</span>
              <span><strong>Lugar:</strong> ${event.ubicacion_nombre || 'Por confirmar'}</span>
            </div>
            <div class="event-meta-item">
              <span class="icon">👥</span>
              <span><strong>Organiza:</strong> ${event.organizador_nombre || 'Colegio IDETH'}</span>
            </div>
          </div>
        </div>
        
        <div class="event-card-footer">
          ${ratingStars}
          <button onclick="openPublicEventDetail(${event.id})" class="btn btn-outline btn-sm">
            Ver Detalle →
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// Configurar botones de filtro generales (Todos / Próximos / Pasados)
function setupFilterButtons() {
  const filterBtns = document.querySelectorAll('.main-filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('#category-filters .filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filterType = btn.dataset.filter;
      if (filterType === 'todos') {
        renderEvents(allEvents);
      } else if (filterType === 'proximos') {
        renderEvents(allEvents.filter(e => !e.es_pasado));
      } else if (filterType === 'pasados') {
        renderEvents(allEvents.filter(e => e.es_pasado));
      }
    });
  });
}

// Filtrar por categoría
function filterByCategory(categoryId, activeBtn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.main-filter-btn').forEach(b => b.classList.remove('active'));
  activeBtn.classList.add('active');

  const filtered = allEvents.filter(e => e.categoria_id === categoryId);
  renderEvents(filtered);
}

// Modal de detalle de evento para la vista pública
async function openPublicEventDetail(eventId) {
  try {
    const event = await API.get(`/api/eventos/${eventId}`);
    const modalBody = document.getElementById('public-event-detail-body');
    const modalTitle = document.getElementById('public-event-detail-title');
    const enrollBtnContainer = document.getElementById('public-event-action');

    if (!modalBody || !modalTitle) return;

    modalTitle.textContent = event.titulo;

    const commentsHtml = event.comentarios && event.comentarios.length > 0
      ? event.comentarios.map(c => `
          <div style="background: var(--bg-main); padding: 12px 14px; border-radius: var(--radius-sm); margin-bottom: 8px;">
            <div style="display: flex; justify-content: space-between; font-size: 0.82rem; color: var(--text-muted); margin-bottom: 4px;">
              <strong>${c.autor_nombre} (${c.autor_rol})</strong>
              <span>${c.fecha}</span>
            </div>
            <p style="font-size: 0.9rem; color: var(--text-main);">${c.texto}</p>
          </div>
        `).join('')
      : '<p style="color: var(--text-muted); font-size: 0.88rem;">Aún no hay comentarios sobre este evento.</p>';

    modalBody.innerHTML = `
      <div style="margin-bottom: 18px;">
        <span class="badge badge-category">${event.categoria_nombre || 'General'}</span>
        ${event.es_pasado ? '<span class="badge badge-status-past" style="margin-left: 6px;">Finalizado</span>' : '<span class="badge badge-status-upcoming" style="margin-left: 6px;">Próximo</span>'}
      </div>

      <p style="font-size: 1rem; color: var(--text-main); margin-bottom: 20px; line-height: 1.6;">
        ${event.descripcion || 'Sin descripción detallada.'}
      </p>

      <div class="event-meta" style="margin-bottom: 24px;">
        <div class="event-meta-item"><span>📅 <strong>Fecha:</strong> ${formatDate(event.fecha)}</span></div>
        <div class="event-meta-item"><span>📍 <strong>Ubicación:</strong> ${event.ubicacion_nombre || 'Por definir'}</span></div>
        <div class="event-meta-item"><span>👥 <strong>Organizador:</strong> ${event.organizador_nombre || 'Colegio IDETH'}</span></div>
        <div class="event-meta-item"><span>⭐ <strong>Calificación promedio:</strong> ${event.calificacion_promedio ? `${event.calificacion_promedio} / 5 (${event.total_calificaciones} calificaciones)` : 'Sin calificar aún'}</span></div>
      </div>

      <h4 style="font-size: 1.05rem; margin-bottom: 12px; color: var(--text-main);">Comentarios de estudiantes</h4>
      <div style="max-height: 200px; overflow-y: auto; margin-bottom: 20px;">
        ${commentsHtml}
      </div>
    `;

    // Botón de acción: si está logueado lleva al dashboard, si no invita a registrarse
    if (AuthStorage.isLoggedIn()) {
      const user = AuthStorage.getUser();
      enrollBtnContainer.innerHTML = `
        <a href="${user.rol === 'admin' ? '/admin' : '/dashboard'}" class="btn btn-primary">
          Ir al Panel para Gestionar / Inscribirme
        </a>
      `;
    } else {
      enrollBtnContainer.innerHTML = `
        <button onclick="closeModal('event-detail-modal'); openModal('login-modal');" class="btn btn-primary">
          Inicia Sesión para Inscribirte y Comentar
        </button>
      `;
    }

    openModal('event-detail-modal');
  } catch (err) {
    showToast('No se pudo cargar la información del evento.', 'error');
  }
}

// Formateador de fecha amigable (Ej: "15 de Sep de 2026, 02:30 PM")
function formatDate(dateStr) {
  if (!dateStr) return 'Fecha por confirmar';
  try {
    const parts = dateStr.split(' ');
    const dateParts = parts[0].split('-');
    const timePart = parts[1] || '';

    const year = dateParts[0];
    const monthIndex = parseInt(dateParts[1], 10) - 1;
    const day = dateParts[2];

    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const monthName = months[monthIndex] || '';

    return `${day} ${monthName} ${year} - ${timePart} hrs`;
  } catch {
    return dateStr;
  }
}
