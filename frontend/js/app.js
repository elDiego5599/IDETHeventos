/**
 * app.js - Logica de la pagina principal
 */

let allEvents = [];

// Al abrir la página: mostramos información simple y pedimos los eventos.
document.addEventListener('DOMContentLoaded', () => {
  // Muestra el nombre del usuario y opciones si está conectado
  updateNavbar();
  // Trae la lista de eventos para que los estudiantes la vean
  loadPublicEvents();
  // Prepara los botones que permiten filtrar la lista (Todos/Próximos/Pasados)
  setupFilterButtons();
});

// Trae la lista de eventos públicos desde la API y renderiza.
async function loadPublicEvents() {
  const container = document.getElementById('events-grid');
  if (!container) return;

  try {
    const events = await API.get('/api/eventos');
    // Guardamos los eventos en memoria para que los filtros sean rápidos
    allEvents = events;
    renderEvents(events);
  } catch (err) {
    // Si falla, mostramos un mensaje fácil de entender
    container.innerHTML = `<div class="empty-state">No se pudo cargar la lista de eventos.</div>`;
  }
}

// Dibuja tarjetas de evento en el grid a partir de un array de eventos.
function renderEvents(events) {
  const container = document.getElementById('events-grid');
  if (!container) return;

  if (events.length === 0) {
    // Mensaje claro para los estudiantes cuando no hay eventos
    container.innerHTML = `<div class="empty-state">No hay eventos publicados en este momento.</div>`;
    return;
  }

  // Construimos HTML para cada evento (título, fecha, lugar, estado, calificación)
  container.innerHTML = events.map(e => {
    const statusBadge = e.es_pasado
      ? '<span class="badge badge-past">Finalizado</span>'
      : '<span class="badge badge-upcoming">Proximo</span>';

    const categoryBadge = `<span class="badge badge-category">${e.categoria_nombre || 'General'}</span>`;

    const ratingText = e.calificacion_promedio
      ? `Calificacion: ${e.calificacion_promedio}/5 (${e.total_calificaciones})`
      : 'Aun no tiene calificaciones';

    return `
      <div class="event-card">
        <div class="event-card-header">
          ${categoryBadge}
          ${statusBadge}
        </div>
        <div class="event-card-body">
          <h3 class="event-card-title">${e.titulo}</h3>
          <p class="event-card-desc">${e.descripcion || 'Sin descripcion.'}</p>
          <div class="event-meta">
            <div><strong>Fecha:</strong> ${e.fecha}</div>
            <div><strong>Lugar:</strong> ${e.ubicacion_nombre || 'Por confirmar'}</div>
            <div><strong>Organiza:</strong> ${e.organizador_nombre || 'Colegio IDETH'}</div>
          </div>
        </div>
        <div class="event-card-footer">
          <span style="font-size: 0.8rem; color: var(--text-muted);">${ratingText}</span>
          <button onclick="openPublicEventDetail(${e.id})" class="btn btn-outline btn-sm">Ver Detalle</button>
        </div>
      </div>
    `;
  }).join('');
}

// Configura los botones que filtran la vista principal (clase .main-filter-btn)
function setupFilterButtons() {
  const btns = document.querySelectorAll('.main-filter-btn');
  // Cada botón pone su estado activo y filtra la lista para mostrar lo que pide
  btns.forEach(b => {
    b.addEventListener('click', () => {
      btns.forEach(x => x.classList.remove('active'));
      b.classList.add('active');

      const f = b.dataset.filter;
      if (f === 'todos') renderEvents(allEvents);
      else if (f === 'proximos') renderEvents(allEvents.filter(e => !e.es_pasado));
      else if (f === 'pasados') renderEvents(allEvents.filter(e => e.es_pasado));
    });
  });
}

// Abre el modal de detalle público para un evento dado. Muestra comentarios y acciones.
async function openPublicEventDetail(id) {
  try {
    const e = await API.get(`/api/eventos/${id}`);
    document.getElementById('modal-detail-title').textContent = e.titulo;

    // Mostramos los comentarios si existen, si no, un texto explicativo
    const commentsHtml = e.comentarios && e.comentarios.length > 0
      ? e.comentarios.map(c => `
          <div class="comment-item">
            <div class="comment-header">
              <span class="comment-author">${c.autor_nombre}</span>
              <span class="comment-date">${c.fecha}</span>
            </div>
            <p class="comment-text">${c.texto}</p>
          </div>
        `).join('')
      : '<p style="color: var(--text-muted); font-size: 0.85rem;">Aun no hay comentarios.</p>';

    document.getElementById('modal-detail-body').innerHTML = `
      <div class="modal-badges">
        <span class="badge badge-category">${e.categoria_nombre || 'General'}</span>
        ${e.es_pasado ? '<span class="badge badge-past">Finalizado</span>' : '<span class="badge badge-upcoming">Proximo</span>'}
      </div>
      <p class="modal-desc">${e.descripcion || 'Sin descripcion.'}</p>
      <div class="event-meta">
        <div><strong>Fecha:</strong> ${e.fecha}</div>
        <div><strong>Lugar:</strong> ${e.ubicacion_nombre || 'Por confirmar'}</div>
        <div><strong>Organiza:</strong> ${e.organizador_nombre || 'Colegio IDETH'}</div>
        <div><strong>Inscritos:</strong> ${e.total_inscritos} estudiantes</div>
        <div><strong>Calificacion promedio:</strong> ${e.calificacion_promedio ? `${e.calificacion_promedio} / 5 (${e.total_calificaciones} votos)` : 'Sin votos'}</div>
      </div>
      <h4 class="modal-section-title">Comentarios de estudiantes</h4>
      <div class="modal-comments-box">${commentsHtml}</div>
    `;

    // Si el estudiante está conectado, mostramos un enlace a su panel;
    // si no, le pedimos que inicie sesión.
    const actionContainer = document.getElementById('modal-detail-action');
    if (AuthStorage.isLoggedIn()) {
      const user = AuthStorage.getUser();
      actionContainer.innerHTML = `<a href="${user.rol === 'admin' ? '/admin' : '/dashboard'}" class="btn btn-primary btn-sm">Ir a mi panel</a>`;
    } else {
      actionContainer.innerHTML = `<a href="/login" class="btn btn-primary btn-sm">Iniciar sesion para participar</a>`;
    }

    openModal('event-detail-modal');
  } catch (err) {
    showToast('Error al cargar detalle del evento', 'error');
  }
}
