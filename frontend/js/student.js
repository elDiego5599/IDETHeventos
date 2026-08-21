/**
 * student.js - Controlador del Dashboard de Estudiante
 * Gestiona la visualización de cronogramas, inscripciones, estrellas 1-5, comentarios y buzón de sugerencias.
 */

let currentEventData = null;
let allStudentEvents = [];
let myEnrolledEvents = [];
let currentFilterType = 'todos';

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Proteger ruta: verificar que el usuario esté logueado
  const user = AuthStorage.getUser();
  if (!AuthStorage.isLoggedIn() || !user) {
    window.location.href = '/';
    return;
  }

  // Si es admin, redirigir a su panel correspondiente
  if (user.rol === 'admin') {
    window.location.href = '/admin';
    return;
  }

  // 2. Personalizar la bienvenida
  setupUserInfo(user);
  setupTabs();
  setupStarRatings();
  setupForms();

  // 3. Cargar datos iniciales
  await loadDashboardData();
});

// Configurar información del estudiante en la cabecera
function setupUserInfo(user) {
  const welcomeTitle = document.getElementById('welcome-title');
  const badgeName = document.getElementById('student-name-badge');

  if (welcomeTitle) welcomeTitle.textContent = `¡Hola, ${user.nombre}! 👋`;
  if (badgeName) badgeName.textContent = `🎓 ${user.nombre}`;
}

// Configurar pestañas del dashboard
function setupTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const targetTabId = btn.dataset.tab;
      const targetContent = document.getElementById(targetTabId);
      if (targetContent) targetContent.classList.add('active');
    });
  });
}

// Cargar todos los eventos e inscripciones del estudiante
async function loadDashboardData() {
  await Promise.all([
    loadAllEvents(),
    loadMyInscriptions()
  ]);
}

// Cargar listado general de eventos
async function loadAllEvents() {
  const container = document.getElementById('student-events-grid');
  if (!container) return;

  try {
    const events = await API.get('/api/eventos');
    allStudentEvents = events;
    renderStudentEvents(events);
  } catch (err) {
    showToast('Error al cargar la lista de eventos.', 'error');
  }
}

// Cargar eventos donde el estudiante está inscrito
async function loadMyInscriptions() {
  try {
    const events = await API.get('/api/inscripciones/mis-eventos');
    myEnrolledEvents = events;

    // Actualizar contadores y badges
    const statEnrolled = document.getElementById('stat-enrolled-count');
    const badgeEnrolled = document.getElementById('badge-my-events');
    if (statEnrolled) statEnrolled.textContent = events.length;
    if (badgeEnrolled) badgeEnrolled.textContent = events.length;

    renderMyEvents(events);
  } catch (err) {
    console.error('Error al cargar mis inscripciones:', err);
  }
}

// Renderizar eventos en la pestaña de Cronograma
function renderStudentEvents(events) {
  const container = document.getElementById('student-events-grid');
  if (!container) return;

  if (events.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 40px; background: white; border-radius: var(--radius-md); border: 1px dashed var(--border-color);">
        <p style="color: var(--text-muted);">No se encontraron eventos en esta sección.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = events.map(event => {
    const isPast = event.es_pasado;
    const statusBadge = isPast 
      ? '<span class="badge badge-status-past">Finalizado</span>'
      : '<span class="badge badge-status-upcoming">Próximo</span>';

    const enrolledBadge = event.esta_inscrito
      ? '<span class="badge badge-enrolled">✓ Inscrito</span>'
      : '';

    const categoryBadge = `<span class="badge badge-category">${event.categoria_nombre || 'General'}</span>`;

    const ratingStars = event.calificacion_promedio 
      ? `<div class="rating-display"><span class="star-icon">★</span> ${event.calificacion_promedio} (${event.total_calificaciones})</div>`
      : `<div class="rating-display" style="color: var(--text-light); font-weight: normal;">Sin calificaciones</div>`;

    return `
      <div class="event-card">
        <div class="event-card-header">
          <div style="display: flex; gap: 6px; align-items: center;">
            ${categoryBadge}
            ${enrolledBadge}
          </div>
          ${statusBadge}
        </div>
        <div class="event-card-body">
          <h3 class="event-card-title">${event.titulo}</h3>
          <p class="event-card-desc">${event.descripcion || 'Sin descripción disponible.'}</p>
          
          <div class="event-meta">
            <div class="event-meta-item"><span>📅 <strong>Fecha:</strong> ${formatDate(event.fecha)}</span></div>
            <div class="event-meta-item"><span>📍 <strong>Lugar:</strong> ${event.ubicacion_nombre || 'Por confirmar'}</span></div>
            <div class="event-meta-item"><span>👥 <strong>Organiza:</strong> ${event.organizador_nombre || 'Colegio IDETH'}</span></div>
          </div>
        </div>
        
        <div class="event-card-footer">
          ${ratingStars}
          <button onclick="openStudentEventModal(${event.id})" class="btn ${event.esta_inscrito ? 'btn-secondary' : 'btn-primary'} btn-sm">
            ${event.esta_inscrito ? 'Ver / Calificar' : 'Ver e Inscribirme'}
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// Renderizar eventos en la pestaña de "Mis Inscripciones"
function renderMyEvents(events) {
  const container = document.getElementById('my-events-grid');
  if (!container) return;

  if (events.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 50px; background: white; border-radius: var(--radius-md); border: 1px dashed var(--border-color);">
        <p style="font-size: 1.1rem; color: var(--text-muted); margin-bottom: 10px;">Aún no te has inscrito a ningún evento escolar.</p>
        <button onclick="document.querySelector('[data-tab=tab-cronograma]').click()" class="btn btn-primary btn-sm">
          Explorar Cronograma de Eventos
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = events.map(event => {
    return `
      <div class="event-card" style="border-left: 4px solid var(--accent);">
        <div class="event-card-header">
          <span class="badge badge-category">${event.categoria_nombre || 'General'}</span>
          <span class="badge badge-enrolled">✓ Inscrito</span>
        </div>
        <div class="event-card-body">
          <h3 class="event-card-title">${event.titulo}</h3>
          <p class="event-card-desc">${event.descripcion || ''}</p>
          
          <div class="event-meta">
            <div class="event-meta-item"><span>📅 <strong>Fecha:</strong> ${formatDate(event.fecha)}</span></div>
            <div class="event-meta-item"><span>📍 <strong>Lugar:</strong> ${event.ubicacion_nombre || 'Por confirmar'}</span></div>
            <div class="event-meta-item"><span>🕒 <strong>Inscrito el:</strong> ${event.fecha_registro}</span></div>
          </div>
        </div>
        
        <div class="event-card-footer">
          <button onclick="cancelEnrollment(${event.id})" class="btn btn-danger btn-sm">
            Cancelar Inscripción
          </button>
          <button onclick="openStudentEventModal(${event.id})" class="btn btn-primary btn-sm">
            Ver / Calificar
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// Filtro rápido por tipo (Todos / Próximos / Pasados)
function filterStudentEvents(type, btnElement) {
  document.querySelectorAll('#tab-cronograma .filter-btn').forEach(b => b.classList.remove('active'));
  btnElement.classList.add('active');
  currentFilterType = type;

  if (type === 'todos') {
    renderStudentEvents(allStudentEvents);
  } else if (type === 'proximos') {
    renderStudentEvents(allStudentEvents.filter(e => !e.es_pasado));
  } else if (type === 'pasados') {
    renderStudentEvents(allStudentEvents.filter(e => e.es_pasado));
  }
}

// Abrir modal con detalle completo, estrellas y comentarios
async function openStudentEventModal(eventId) {
  try {
    const event = await API.get(`/api/eventos/${eventId}`);
    currentEventData = event;

    // Rellenar datos en el modal
    document.getElementById('modal-event-title').textContent = event.titulo;
    document.getElementById('modal-category-badge').textContent = event.categoria_nombre || 'General';
    document.getElementById('modal-event-description').textContent = event.descripcion || 'Sin descripción detallada.';
    document.getElementById('modal-event-date').textContent = formatDate(event.fecha);
    document.getElementById('modal-event-location').textContent = event.ubicacion_nombre || 'Por confirmar';
    document.getElementById('modal-event-organizer').textContent = event.organizador_nombre || 'Colegio IDETH';
    document.getElementById('modal-event-enrolled-count').textContent = event.total_inscritos || 0;

    // Badges de estado e inscripción
    const statusBadge = document.getElementById('modal-status-badge');
    if (event.es_pasado) {
      statusBadge.className = 'badge badge-status-past';
      statusBadge.textContent = 'Finalizado';
    } else {
      statusBadge.className = 'badge badge-status-upcoming';
      statusBadge.textContent = 'Próximo';
    }

    const enrolledIndicator = document.getElementById('modal-enrolled-indicator');
    enrolledIndicator.style.display = event.esta_inscrito ? 'inline-block' : 'none';

    // Botón de Inscripción / Desinscripción
    renderEnrollmentActionButton(event);

    // Pintar estrellas según la calificación previa del estudiante
    updateStarUI(event.mi_calificacion || 0);
    const ratingStatusText = document.getElementById('rating-status-text');
    if (event.mi_calificacion) {
      ratingStatusText.textContent = `Ya calificaste este evento con ${event.mi_calificacion} estrellas. (Puedes cambiarla haciendo clic)`;
    } else {
      ratingStatusText.textContent = 'Haz clic en las estrellas para dejar tu puntuación:';
    }

    // Renderizar comentarios
    renderCommentsList(event.comentarios || []);

    const modal = document.getElementById('event-action-modal');
    modal.classList.add('active');

  } catch (err) {
    showToast('No se pudo cargar la información del evento.', 'error');
  }
}

function closeStudentModal() {
  const modal = document.getElementById('event-action-modal');
  if (modal) modal.classList.remove('active');
  currentEventData = null;
}

// Renderiza el botón de acción de inscripción en el modal
function renderEnrollmentActionButton(event) {
  const container = document.getElementById('modal-enrollment-action-container');
  if (!container) return;

  if (event.esta_inscrito) {
    container.innerHTML = `
      <div style="background: var(--accent-light); padding: 14px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
        <span style="color: #065f46; font-weight: 600; font-size: 0.92rem;">
          ✓ ¡Estás formalmente inscrito en este evento escolar!
        </span>
        <button onclick="cancelEnrollment(${event.id})" class="btn btn-danger btn-sm">
          Cancelar Inscripción
        </button>
      </div>
    `;
  } else {
    container.innerHTML = `
      <button onclick="enrollInEvent(${event.id})" class="btn btn-primary btn-lg btn-block">
        ✍️ Inscribirme a este Evento
      </button>
    `;
  }
}

// Inscribirse a un evento
async function enrollInEvent(eventId) {
  try {
    const res = await API.post(`/api/inscripciones/${eventId}`);
    showToast(res.mensaje, 'success');
    await loadDashboardData();
    // Refrescar modal si está abierto
    if (currentEventData && currentEventData.id === eventId) {
      await openStudentEventModal(eventId);
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Cancelar inscripción
async function cancelEnrollment(eventId) {
  if (!confirm('¿Estás seguro de cancelar tu inscripción a este evento?')) return;

  try {
    const res = await API.delete(`/api/inscripciones/${eventId}`);
    showToast(res.mensaje, 'info');
    await loadDashboardData();
    if (currentEventData && currentEventData.id === eventId) {
      await openStudentEventModal(eventId);
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Configurar interacción con las 5 estrellas
function setupStarRatings() {
  const stars = document.querySelectorAll('.star-item');
  
  stars.forEach(star => {
    star.addEventListener('click', async () => {
      if (!currentEventData) return;
      const score = parseInt(star.dataset.val, 10);

      try {
        const res = await API.post('/api/calificaciones', {
          evento_id: currentEventData.id,
          puntuacion: score
        });

        showToast(res.mensaje, 'success');
        updateStarUI(score);
        document.getElementById('rating-status-text').textContent = `¡Calificaste con ${score} estrellas!`;
        
        // Actualizar datos globales de eventos
        await loadAllEvents();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}

function updateStarUI(selectedScore) {
  const stars = document.querySelectorAll('.star-item');
  stars.forEach(star => {
    const val = parseInt(star.dataset.val, 10);
    if (val <= selectedScore) {
      star.classList.add('active');
    } else {
      star.classList.remove('active');
    }
  });
}

// Renderizar muro de comentarios
function renderCommentsList(comments) {
  const list = document.getElementById('modal-comments-list');
  if (!list) return;

  if (comments.length === 0) {
    list.innerHTML = `<p style="color: var(--text-muted); font-size: 0.88rem; text-align: center; padding: 12px;">Sé el primero en compartir tu experiencia sobre esta actividad.</p>`;
    return;
  }

  list.innerHTML = comments.map(c => `
    <div style="background: var(--bg-main); padding: 12px 14px; border-radius: var(--radius-sm); margin-bottom: 8px;">
      <div style="display: flex; justify-content: space-between; font-size: 0.82rem; color: var(--text-muted); margin-bottom: 4px;">
        <strong>🎓 ${c.autor_nombre}</strong>
        <span>${c.fecha}</span>
      </div>
      <p style="font-size: 0.92rem; color: var(--text-main);">${c.texto}</p>
    </div>
  `).join('');
}

// Configurar formularios de comentarios y sugerencias
function setupForms() {
  // 1. Formulario de Comentario de Evento
  const commentForm = document.getElementById('add-comment-form');
  if (commentForm) {
    commentForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentEventData) return;

      const input = document.getElementById('comment-text');
      const text = input.value.trim();
      if (!text) return;

      const btn = document.getElementById('btn-submit-comment');
      try {
        btn.disabled = true;
        const res = await API.post('/api/comentarios', {
          evento_id: currentEventData.id,
          texto: text
        });

        showToast(res.mensaje, 'success');
        input.value = '';

        // Recargar comentarios del evento actual
        const updatedEvent = await API.get(`/api/eventos/${currentEventData.id}`);
        currentEventData = updatedEvent;
        renderCommentsList(updatedEvent.comentarios || []);

      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        btn.disabled = false;
      }
    });
  }

  // 2. Formulario de Buzón de Sugerencias
  const suggestionForm = document.getElementById('suggestion-form');
  if (suggestionForm) {
    suggestionForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const textarea = document.getElementById('suggestion-text');
      const text = textarea.value.trim();
      if (!text) return;

      const btn = document.getElementById('btn-send-suggestion');
      try {
        btn.disabled = true;
        btn.textContent = 'Enviando...';

        const res = await API.post('/api/sugerencias', { texto: text });
        showToast(res.mensaje, 'success');
        textarea.value = '';

      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Enviar Sugerencia';
      }
    });
  }
}
