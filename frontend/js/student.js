/**
 * student.js - Controlador del Dashboard de Estudiante
 */

let currentEvent = null;
let allEvents = [];

document.addEventListener('DOMContentLoaded', async () => {
  const user = AuthStorage.getUser();
  if (!AuthStorage.isLoggedIn() || !user) {
    window.location.href = '/login';
    return;
  }
  if (user.rol === 'admin') {
    window.location.href = '/admin';
    return;
  }

  document.getElementById('welcome-title').textContent = `Hola, ${user.nombre}`;
  document.getElementById('student-badge-name').textContent = user.nombre;

  setupTabs();
  setupStarRating();
  setupForms();
  await loadData();
});

function setupTabs() {
  const btns = document.querySelectorAll('.tab-btn');
  const panes = document.querySelectorAll('.tab-content');

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

async function loadData() {
  await Promise.all([loadEvents(), loadMyInscriptions()]);
}

async function loadEvents() {
  const container = document.getElementById('student-events-grid');
  if (!container) return;

  try {
    const events = await API.get('/api/eventos');
    allEvents = events;
    renderStudentEvents(events);
  } catch (err) {
    showToast('Error al cargar eventos', 'error');
  }
}

async function loadMyInscriptions() {
  try {
    const events = await API.get('/api/inscripciones/mis-eventos');
    document.getElementById('stat-my-count').textContent = events.length;
    document.getElementById('badge-my-count').textContent = events.length;

    const container = document.getElementById('my-events-grid');
    if (!container) return;

    if (events.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>No te has inscrito a ningun evento todavia.</p>
          <button onclick="document.querySelector('[data-tab=tab-cronograma]').click()" class="btn btn-primary btn-sm" style="margin-top: 10px;">Ver Cronograma</button>
        </div>
      `;
      return;
    }

    container.innerHTML = events.map(e => `
      <div class="event-card">
        <div class="event-card-header">
          <span class="badge badge-category">${e.categoria_nombre || 'General'}</span>
          <span class="badge badge-enrolled">Inscrito</span>
        </div>
        <div class="event-card-body">
          <h3 class="event-card-title">${e.titulo}</h3>
          <p class="event-card-desc">${e.descripcion || ''}</p>
          <div class="event-meta">
            <div><strong>Fecha:</strong> ${e.fecha}</div>
            <div><strong>Lugar:</strong> ${e.ubicacion_nombre || 'Por confirmar'}</div>
            <div><strong>Inscrito el:</strong> ${e.fecha_registro}</div>
          </div>
        </div>
        <div class="event-card-footer">
          <button onclick="cancelEnrollment(${e.id})" class="btn btn-danger btn-sm">Cancelar Inscripcion</button>
          <button onclick="openStudentModal(${e.id})" class="btn btn-outline btn-sm">Ver / Calificar</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error(err);
  }
}

function renderStudentEvents(events) {
  const container = document.getElementById('student-events-grid');
  if (!container) return;

  if (events.length === 0) {
    container.innerHTML = `<div class="empty-state">No hay eventos disponibles.</div>`;
    return;
  }

  container.innerHTML = events.map(e => {
    const statusBadge = e.es_pasado
      ? '<span class="badge badge-past">Finalizado</span>'
      : '<span class="badge badge-upcoming">Proximo</span>';

    const enrolledBadge = e.esta_inscrito ? '<span class="badge badge-enrolled">Inscrito</span>' : '';

    return `
      <div class="event-card">
        <div class="event-card-header">
          <div>
            <span class="badge badge-category">${e.categoria_nombre || 'General'}</span>
            ${enrolledBadge}
          </div>
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
          <span style="font-size: 0.8rem; color: var(--text-muted);">${e.calificacion_promedio ? `${e.calificacion_promedio}/5` : 'Sin calificar'}</span>
          <button onclick="openStudentModal(${e.id})" class="btn ${e.esta_inscrito ? 'btn-secondary' : 'btn-primary'} btn-sm">
            ${e.esta_inscrito ? 'Ver / Calificar' : 'Ver e Inscribirme'}
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function filterEvents(type, btn) {
  document.querySelectorAll('#tab-cronograma .filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  if (type === 'todos') renderStudentEvents(allEvents);
  else if (type === 'proximos') renderStudentEvents(allEvents.filter(e => !e.es_pasado));
  else if (type === 'pasados') renderStudentEvents(allEvents.filter(e => e.es_pasado));
}

async function openStudentModal(id) {
  try {
    const e = await API.get(`/api/eventos/${id}`);
    currentEvent = e;

    document.getElementById('modal-title').textContent = e.titulo;
    document.getElementById('modal-cat').textContent = e.categoria_nombre || 'General';
    document.getElementById('modal-desc').textContent = e.descripcion || 'Sin descripcion.';
    document.getElementById('modal-date').textContent = e.fecha;
    document.getElementById('modal-loc').textContent = e.ubicacion_nombre || 'Por confirmar';
    document.getElementById('modal-org').textContent = e.organizador_nombre || 'Colegio IDETH';
    document.getElementById('modal-enrolled-count').textContent = e.total_inscritos || 0;

    const statusEl = document.getElementById('modal-status');
    statusEl.className = e.es_pasado ? 'badge badge-past' : 'badge badge-upcoming';
    statusEl.textContent = e.es_pasado ? 'Finalizado' : 'Proximo';

    renderEnrollmentButton(e);

    const ratingBox = document.getElementById('star-rating-box');
    const ratingHint = document.getElementById('star-rating-hint');
    if (e.es_pasado) {
      ratingBox.style.display = 'block';
      updateStarUI(e.mi_calificacion || 0);
      ratingHint.textContent = 'Haz clic en una estrella para calificar (1 a 5):';
    } else {
      ratingBox.style.display = 'none';
    }

    renderComments(e.comentarios || []);

    openModal('student-event-modal');
  } catch (err) {
    showToast('Error al cargar evento', 'error');
  }
}

function renderEnrollmentButton(e) {
  const container = document.getElementById('modal-enroll-action');
  if (e.esta_inscrito) {
    container.innerHTML = `
      <div class="modal-enroll-status">
        <span>Estas formalmente inscrito a este evento.</span>
        <button onclick="cancelEnrollment(${e.id})" class="btn btn-danger btn-sm">Cancelar Inscripcion</button>
      </div>
    `;
  } else {
    container.innerHTML = `
      <button onclick="enrollInEvent(${e.id})" class="btn btn-primary btn-block">Inscribirme a este Evento</button>
    `;
  }
}

async function enrollInEvent(id) {
  try {
    const res = await API.post(`/api/inscripciones/${id}`);
    showToast(res.mensaje, 'success');
    await loadData();
    await openStudentModal(id);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function cancelEnrollment(id) {
  if (!confirm('Deseas cancelar tu inscripcion a este evento?')) return;
  try {
    const res = await API.delete(`/api/inscripciones/${id}`);
    showToast(res.mensaje, 'info');
    await loadData();
    closeModal('student-event-modal');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function setupStarRating() {
  const stars = document.querySelectorAll('.star-item');
  stars.forEach(star => {
    star.addEventListener('click', async () => {
      if (!currentEvent || !currentEvent.es_pasado) return;
      const score = parseInt(star.dataset.val, 10);
      try {
        const res = await API.post('/api/calificaciones', {
          evento_id: currentEvent.id,
          puntuacion: score
        });
        showToast(res.mensaje, 'success');
        updateStarUI(score);
        await loadEvents();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}

function updateStarUI(score) {
  const stars = document.querySelectorAll('.star-item');
  stars.forEach(s => {
    const val = parseInt(s.dataset.val, 10);
    if (val <= score) s.classList.add('active');
    else s.classList.remove('active');
  });
}

function renderComments(comments) {
  const container = document.getElementById('modal-comments-list');
  if (comments.length === 0) {
    container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.84rem;">Aun no hay comentarios sobre este evento.</p>`;
    return;
  }
  container.innerHTML = comments.map(c => `
    <div class="comment-item">
      <div class="comment-header">
        <span class="comment-author">${c.autor_nombre}</span>
        <span class="comment-date">${c.fecha}</span>
      </div>
      <p class="comment-text">${c.texto}</p>
    </div>
  `).join('');
}

function setupForms() {
  const cForm = document.getElementById('form-add-comment');
  if (cForm) {
    cForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentEvent) return;
      const input = document.getElementById('input-comment-text');
      const text = input.value.trim();
      if (!text) return;

      try {
        await API.post('/api/comentarios', { evento_id: currentEvent.id, texto: text });
        input.value = '';
        const updated = await API.get(`/api/eventos/${currentEvent.id}`);
        currentEvent = updated;
        renderComments(updated.comentarios || []);
        showToast('Comentario publicado', 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  const sForm = document.getElementById('form-suggestion');
  if (sForm) {
    sForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const area = document.getElementById('input-suggestion-text');
      const text = area.value.trim();
      if (!text) return;

      try {
        const res = await API.post('/api/sugerencias', { texto: text });
        area.value = '';
        showToast(res.mensaje, 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }
}
