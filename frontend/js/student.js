// Logica del panel del estudiante
let currentEvent = null;
let allEvents = [];
let myInscriptionsList = [];
let currentFilter = 'todos';

function setStudentText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

// Cuando se carga la pagina revisamos que el usuario este logueado
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

  // Mostramos el nombre del estudiante
  setStudentText('welcome-title', `Hola, ${user.nombre}`);
  setStudentText('student-badge-name', user.nombre);

  setupTabs();
  setupStarRating();
  setupForms();
  setupStudentSearch();
  setupReportProblemForm();
  setupSurveySubmitForm();

  await loadData();
});

// Configura las pestañas para cambiar entre secciones
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

function setupStudentSearch() {
  const input = document.getElementById('student-search-input');
  if (input) {
    input.addEventListener('input', () => applyStudentFilters());
  }
}

// Carga los datos principales del panel
async function loadData() {
  await loadEvents();
  await loadMyInscriptions();
  populateReportEventSelect();
}

function getEventThumbnail(url) {
  if (!url || !url.trim()) return '/static/img/cancha_futbol_ideth.jpeg';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/static/')) return url;
  if (url.startsWith('/')) return url;
  return '/static/' + url;
}

// Trae todos los eventos del backend
async function loadEvents() {
  const container = document.getElementById('student-events-grid');
  if (!container) return;

  try {
    const events = await API.get('/api/eventos');
    allEvents = events;
    applyStudentFilters();
  } catch (err) {
    showToast('Error al cargar eventos escolares', 'error');
  }
}

function applyStudentFilters() {
  const searchVal = (document.getElementById('student-search-input')?.value || '').toLowerCase().trim();

  let filtered = allEvents;

  if (currentFilter === 'proximos') {
    filtered = filtered.filter(e => e.estado === 'proximo' || (!e.es_pasado && e.estado !== 'activo'));
  } else if (currentFilter === 'activos') {
    filtered = filtered.filter(e => e.estado === 'activo');
  } else if (currentFilter === 'pasados') {
    filtered = filtered.filter(e => e.es_pasado || e.estado === 'pasado');
  }

  if (searchVal) {
    filtered = filtered.filter(e =>
      (e.titulo && e.titulo.toLowerCase().includes(searchVal)) ||
      (e.descripcion && e.descripcion.toLowerCase().includes(searchVal)) ||
      (e.frase_motivacional && e.frase_motivacional.toLowerCase().includes(searchVal)) ||
      (e.ubicacion_nombre && e.ubicacion_nombre.toLowerCase().includes(searchVal)) ||
      (e.categoria_nombre && e.categoria_nombre.toLowerCase().includes(searchVal))
    );
  }

  renderStudentEvents(filtered);
}

// Filtra los eventos por tipo
function filterEvents(type, btn) {
  document.querySelectorAll('#tab-cronograma .filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentFilter = type;
  applyStudentFilters();
}

// Llena el select para reportar problemas
function populateReportEventSelect() {
  const select = document.getElementById('report-event-id');
  if (!select) return;
  select.innerHTML = '<option value="">Problema general del colegio o selecciona evento...</option>' +
    allEvents.map(e => `<option value="${e.id}">${e.titulo} (${e.fecha})</option>`).join('');
}

// Trae los eventos donde el estudiante esta inscrito
async function loadMyInscriptions() {
  try {
    const events = await API.get('/api/inscripciones/mis-eventos');
    myInscriptionsList = events;

    setStudentText('stat-my-count', events.length);
    setStudentText('badge-my-count', events.length);

    const container = document.getElementById('my-events-grid');
    if (!container) return;

    if (events.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>No te has inscrito a ningun evento escolar todavia.</p>
          <button onclick="document.querySelector('[data-tab=tab-cronograma]').click()" class="btn btn-primary btn-sm" style="margin-top: 10px;">Ver Cronograma Escolar</button>
        </div>
      `;
      return;
    }

    container.innerHTML = events.map(e => {
      const isVolunteer = e.tipo_participacion === 'voluntario_activo';
      const roleBadge = isVolunteer
        ? '<span class="badge badge-volunteer">Participante Activo / Voluntario</span>'
        : '<span class="badge badge-enrolled">Asistente</span>';

      const photoUrl = getEventThumbnail(e.imagen_url);

      const detalleTexto = isVolunteer && e.detalle_participacion
        ? `<div style="background: #fdf4ff; border: 1px solid #f0abfc; padding: 6px 10px; border-radius: 4px; font-size: 0.82rem; color: #86198f; margin-bottom: 8px;">
             <strong>Tu presentacion:</strong> ${e.detalle_participacion}
           </div>`
        : '';

      return `
        <div class="event-card">
          <div class="event-card-img-wrap">
            <img src="${photoUrl}" alt="${e.titulo}" class="event-card-img" onerror="this.src='https://images.unsplash.com/photo-1577896851231-70ef18881754?w=800&auto=format&fit=crop&q=60'">
          </div>
          <div class="event-card-header">
            <span class="badge badge-category">${e.categoria_nombre || 'General'}</span>
            ${roleBadge}
          </div>
          <div class="event-card-body">
            <h3 class="event-card-title">${e.titulo}</h3>
            ${detalleTexto}
            <div class="event-meta">
              <div><strong>Fecha:</strong> ${e.fecha}</div>
              <div><strong>Zona / Lugar:</strong> ${e.ubicacion_nombre || 'Por confirmar'}</div>
              <div><strong>Inscrito el:</strong> ${e.fecha_registro}</div>
            </div>
          </div>
          <div class="event-card-footer" style="flex-wrap: wrap; gap: 6px;">
            <button onclick="openSchoolPass(${e.id})" class="btn btn-primary btn-sm" title="Generar pase para mostrar al profesor">
              Ver Pase Escolar
            </button>
            <button onclick="cancelEnrollment(${e.id})" class="btn btn-danger btn-sm">Cancelar</button>
            <button onclick="openStudentModal(${e.id})" class="btn btn-outline btn-sm">
              ${e.es_pasado || e.estado === 'pasado' ? 'Ver / Calificar' : 'Ver Detalle'}
            </button>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error(err);
  }
}

// Muestra las tarjetas de eventos en el cronograma
function renderStudentEvents(events) {
  const container = document.getElementById('student-events-grid');
  if (!container) return;

  if (events.length === 0) {
    container.innerHTML = `<div class="empty-state">No se encontraron eventos disponibles con este filtro.</div>`;
    return;
  }

  container.innerHTML = events.map(e => {
    let statusBadge = '<span class="badge badge-upcoming">Proximo</span>';
    if (e.estado === 'activo') {
      statusBadge = '<span class="badge badge-active">En Vivo / Hoy</span>';
    } else if (e.es_pasado || e.estado === 'pasado') {
      statusBadge = '<span class="badge badge-past">Finalizado</span>';
    }

    const enrolledBadge = e.esta_inscrito
      ? '<span class="badge badge-enrolled">Inscrito</span>'
      : '';

    const isUpcoming = e.estado === 'proximo' && !e.es_pasado;
    const volunteerBadge = e.permite_voluntarios && isUpcoming
      ? '<span class="badge badge-volunteer">Acepta Voluntarios</span>'
      : '';

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
          <div style="display: flex; gap: 4px; align-items: center; flex-wrap: wrap;">
            <span class="badge badge-category">${e.categoria_nombre || 'Deportes'}</span>
            ${enrolledBadge}
            ${volunteerBadge}
          </div>
          ${statusBadge}
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
          <button onclick="openStudentModal(${e.id})" class="btn ${e.esta_inscrito ? 'btn-secondary' : 'btn-primary'} btn-sm">
            ${e.es_pasado || e.estado === 'pasado' ? 'Ver / Calificar' : e.estado === 'activo' ? 'Ver Detalle' : e.esta_inscrito ? 'Ver Detalle' : 'Ver e Inscribirme'}
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// Abre el modal con el detalle del evento y las opciones para inscribirse, calificar, comentar y responder encuestas
async function openStudentModal(id) {
  try {
    const e = await API.get(`/api/eventos/${id}`);
    currentEvent = e;

    setStudentText('modal-title', e.titulo);
    setStudentText('modal-cat', e.categoria_nombre || 'General');
    setStudentText('modal-desc', e.descripcion || 'Sin descripcion.');
    setStudentText('modal-date', e.fecha);
    setStudentText('modal-loc', e.ubicacion_nombre || 'Por confirmar');
    setStudentText('modal-org', e.organizador_nombre || 'Colegio IDETH');
    setStudentText('modal-enrolled-count', e.total_inscritos || 0);

    // Foto de portada
    const coverEl = document.getElementById('modal-cover');
    coverEl.onerror = () => { coverEl.src = '/static/img/cancha_futbol_ideth.jpeg'; };
    coverEl.src = getEventThumbnail(e.imagen_url);
    coverEl.style.display = 'block';

    // Frase motivacional
    const mottoBox = document.getElementById('modal-motto-box');
    if (e.frase_motivacional) {
      setStudentText('modal-motto', `"${e.frase_motivacional}"`);
      mottoBox.style.display = 'block';
    } else {
      mottoBox.style.display = 'none';
    }

    // Resumen de eventos pasados
    const summaryBox = document.getElementById('modal-summary-box');
    if ((e.es_pasado || e.estado === 'pasado') && e.resumen_pasado) {
      setStudentText('modal-summary-desc', e.resumen_pasado);
      summaryBox.style.display = 'block';
    } else {
      summaryBox.style.display = 'none';
    }

    // Badge voluntariado
    const volBadge = document.getElementById('modal-volunteer-badge');
    volBadge.style.display = e.permite_voluntarios ? 'inline-block' : 'none';

    // Estado
    const statusEl = document.getElementById('modal-status');
    if (e.estado === 'activo') {
      statusEl.className = 'badge badge-active';
      statusEl.textContent = 'En Vivo / Hoy';
    } else if (e.es_pasado || e.estado === 'pasado') {
      statusEl.className = 'badge badge-past';
      statusEl.textContent = 'Finalizado';
    } else {
      statusEl.className = 'badge badge-upcoming';
      statusEl.textContent = 'Proximo';
    }

    renderEnrollmentAction(e);

    // Calificacion con estrellas y comentarios
    const ratingBox = document.getElementById('star-rating-box');
    const ratingHint = document.getElementById('star-rating-hint');
    const commentFormBox = document.getElementById('comment-form-box');

    if (e.es_pasado || e.estado === 'pasado') {
      ratingBox.style.display = 'block';
      commentFormBox.style.display = 'block';
      updateStarUI(e.mi_calificacion || 0);
      ratingHint.textContent = 'Haz clic en una estrella para calificar (1 a 5):';
    } else {
      ratingBox.style.display = 'none';
      commentFormBox.style.display = 'none';
    }

    renderComments(e.comentarios || []);

    // Encuestas escolares
    await loadEventSurvey(e.id);

    openModal('student-event-modal');
  } catch (err) {
    showToast(err.message || 'Error al cargar evento', 'error');
  }
}

// Boton de inscripcion con condicional de participacion voluntaria
function renderEnrollmentAction(e) {
  const container = document.getElementById('modal-enroll-action');
  if (!container) return;

  const isPast = e.es_pasado || e.estado === 'pasado';
  const isActive = e.estado === 'activo';

  if (isPast) {
    container.innerHTML = `
      <div class="event-action-notice">
        Este evento ya finalizo. Puedes calificarlo y compartir tu experiencia.
      </div>
    `;
    return;
  }

  if (isActive) {
    container.innerHTML = `
      <div class="event-action-notice">
        Este evento ya comenzo. La inscripcion ya no esta disponible.
      </div>
    `;
    return;
  }

  if (e.esta_inscrito) {
    const isVolunteer = e.mi_tipo_participacion === 'voluntario_activo';
    const detailText = isVolunteer && e.mi_detalle_participacion
      ? `<div style="margin-top: 4px; font-size: 0.82rem; color: #6b21a8;">Participas con: <strong>${e.mi_detalle_participacion}</strong></div>`
      : '';

    container.innerHTML = `
      <div class="modal-enroll-status">
        <div>
          <span>Estas inscrito ${isVolunteer ? 'como Participante Activo / Voluntario' : 'como Asistente'}.</span>
          ${detailText}
        </div>
        <button onclick="cancelEnrollment(${e.id})" class="btn btn-danger btn-sm">Cancelar Inscripcion</button>
      </div>
    `;
  } else {
    // Si el evento permite voluntarios, mostramos la opcion condicional
    if (e.permite_voluntarios) {
      container.innerHTML = `
        <div class="volunteer-box">
          <div style="font-size: 0.88rem; font-weight: 700; margin-bottom: 6px; color: #4338ca;">
            Este evento escolar acepta participacion de estudiantes!
          </div>
          <div style="font-size: 0.82rem; color: var(--text-muted); margin-bottom: 10px;">
            Elige como te gustaria participar:
          </div>
          <div class="volunteer-option-group">
            <label class="radio-label">
              <input type="radio" name="participation_type" value="asistente" checked onchange="toggleVolunteerInput(false)">
              Asistir como publico / espectador
            </label>
            <label class="radio-label">
              <input type="radio" name="participation_type" value="voluntario_activo" onchange="toggleVolunteerInput(true)">
              Participar activamente (declamar poema, leer cuento, arbitrar, staff)
            </label>
          </div>
          <div id="volunteer-detail-group" style="display: none; margin-top: 10px;">
            <label class="form-label" style="font-size: 0.82rem;" for="volunteer-detail-input">
              ¿Que vas a presentar o en que vas a participar?
            </label>
            <input type="text" id="volunteer-detail-input" class="form-control" placeholder="Ej: Declamar poema 'A Margarita Debayle' / Cuento propio / Arbitro de linea">
          </div>
        </div>
        <button onclick="enrollInEvent(${e.id}, true)" class="btn btn-primary btn-block">Confirmar mi Inscripcion</button>
      `;
    } else {
      container.innerHTML = `
        <button onclick="enrollInEvent(${e.id}, false)" class="btn btn-primary btn-block">Inscribirme a este Evento</button>
      `;
    }
  }
}

function toggleVolunteerInput(show) {
  const group = document.getElementById('volunteer-detail-group');
  if (group) group.style.display = show ? 'block' : 'none';
}

// Inscribe al estudiante en el evento
async function enrollInEvent(id, hasCondition) {
  let tipo_participacion = 'asistente';
  let detalle_participacion = null;

  if (hasCondition) {
    const radio = document.querySelector('input[name="participation_type"]:checked');
    if (radio && radio.value === 'voluntario_activo') {
      tipo_participacion = 'voluntario_activo';
      detalle_participacion = (document.getElementById('volunteer-detail-input')?.value || '').trim();
      if (!detalle_participacion) {
        showToast('Por favor escribe que poema, cuento o actividad vas a presentar', 'error');
        return;
      }
    }
  }

  try {
    const res = await API.post(`/api/inscripciones/${id}`, {
      tipo_participacion,
      detalle_participacion
    });
    showToast(res.mensaje, 'success');
    await loadData();
    await openStudentModal(id);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Cancela la inscripcion
async function cancelEnrollment(id) {
  if (!confirm('Deseas cancelar tu inscripcion a este evento escolar?')) return;
  try {
    const res = await API.delete(`/api/inscripciones/${id}`);
    showToast(res.mensaje, 'info');
    await loadData();
    closeModal('student-event-modal');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Generar Comprobante / Pase Escolar (Idea adicional 3)
function openSchoolPass(eventId) {
  const item = myInscriptionsList.find(e => e.id === eventId);
  if (!item) return;

  const user = AuthStorage.getUser();
  const isVolunteer = item.tipo_participacion === 'voluntario_activo';
  const roleText = isVolunteer ? 'Participante Activo / Voluntario' : 'Asistente Escolar';
  const presentationText = isVolunteer && item.detalle_participacion ? item.detalle_participacion : 'Asistencia general al evento';
  const passCode = `IDETH-${item.id}${user.id}-${Math.floor(1000 + Math.random() * 9000)}`;

  const content = `
    <div class="school-pass-card">
      <div class="pass-header">
        <img src="/static/img/logoColegio.jpeg" alt="Logo Colegio IDETH" class="pass-logo">
        <div>
          <div class="pass-school-name">COLEGIO IDETH</div>
          <div class="pass-school-sub">Comprobante Oficial de Inscripcion</div>
        </div>
      </div>

      <div class="pass-title">${item.titulo}</div>

      <div class="pass-grid">
        <div>
          <div class="pass-field-label">Estudiante:</div>
          <div class="pass-field-val">${user.nombre}</div>
        </div>
        <div>
          <div class="pass-field-label">Correo Institucional:</div>
          <div class="pass-field-val">${user.email}</div>
        </div>
        <div>
          <div class="pass-field-label">Fecha del Evento:</div>
          <div class="pass-field-val">${item.fecha}</div>
        </div>
        <div>
          <div class="pass-field-label">Zona / Lugar:</div>
          <div class="pass-field-val">${item.ubicacion_nombre || 'Sede Colegio'}</div>
        </div>
        <div>
          <div class="pass-field-label">Rol en la actividad:</div>
          <div class="pass-field-val">${roleText}</div>
        </div>
        <div>
          <div class="pass-field-label">Presentacion / Funcion:</div>
          <div class="pass-field-val">${presentationText}</div>
        </div>
      </div>

      <div class="pass-footer">
        <div>
          <span>Codigo de validacion: <strong>${passCode}</strong></span>
          <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 2px;">Presenta este pase impreso o en pantalla a tu profesor.</div>
        </div>
        <div class="pass-stamp">Valido IDETH</div>
      </div>
    </div>
  `;

  document.getElementById('pass-modal-content').innerHTML = content;
  openModal('pass-modal');
}

// Carga encuesta escolar si el evento tiene una activa
async function loadEventSurvey(eventoId) {
  const surveyBox = document.getElementById('modal-survey-box');
  const answeredBox = document.getElementById('modal-survey-answered');
  surveyBox.style.display = 'none';
  answeredBox.style.display = 'none';

  try {
    const data = await API.get(`/api/encuestas/evento/${eventoId}`);
    if (!data.tiene_encuesta) return;

    if (data.ya_respondio) {
      answeredBox.style.display = 'block';
      return;
    }

    surveyBox.style.display = 'block';
    document.getElementById('survey-active-id').value = data.id;
    setStudentText('survey-title-display', data.titulo);

    // Pregunta cerrada 1
    setStudentText('survey-q1-label', data.pregunta_1);
    const opts1 = (data.opciones_1 || '').split(',').map(o => o.trim()).filter(Boolean);
    document.getElementById('survey-q1-options').innerHTML = opts1.map((opt, idx) => `
      <label class="radio-label">
        <input type="radio" name="survey_q1" value="${opt}" ${idx === 0 ? 'checked' : ''} required>
        ${opt}
      </label>
    `).join('');

    // Pregunta cerrada 2 (si existe)
    const q2Container = document.getElementById('survey-q2-container');
    if (data.pregunta_2) {
      q2Container.style.display = 'block';
      setStudentText('survey-q2-label', data.pregunta_2);
      const opts2 = (data.opciones_2 || '').split(',').map(o => o.trim()).filter(Boolean);
      document.getElementById('survey-q2-options').innerHTML = opts2.map((opt, idx) => `
        <label class="radio-label">
          <input type="radio" name="survey_q2" value="${opt}" ${idx === 0 ? 'checked' : ''}>
          ${opt}
        </label>
      `).join('');
    } else {
      q2Container.style.display = 'none';
    }

    // Pregunta abierta
    setStudentText('survey-qopen-label', data.pregunta_abierta || 'Tu opinion libre:');
    document.getElementById('survey-open-text').value = '';
  } catch (err) {
    console.error(err);
  }
}

// Configura el envio de la encuesta
function setupSurveySubmitForm() {
  const form = document.getElementById('form-submit-survey');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const encuestaId = document.getElementById('survey-active-id').value;
    const r1 = document.querySelector('input[name="survey_q1"]:checked')?.value || '';
    const r2 = document.querySelector('input[name="survey_q2"]:checked')?.value || null;
    const rOpen = document.getElementById('survey-open-text').value.trim();

    try {
      const res = await API.post(`/api/encuestas/${encuestaId}/responder`, {
        respuesta_1: r1,
        respuesta_2: r2,
        respuesta_abierta: rOpen
      });
      showToast(res.mensaje, 'success');
      document.getElementById('modal-survey-box').style.display = 'none';
      document.getElementById('modal-survey-answered').style.display = 'block';
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

// Configura el formulario para reportar inconvenientes o problemas
function setupReportProblemForm() {
  const form = document.getElementById('form-report-problem');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const eventSelect = document.getElementById('report-event-id');
    const evento_id = eventSelect.value ? parseInt(eventSelect.value, 10) : null;
    const tipo_problema = document.getElementById('report-type').value;
    const descripcion = document.getElementById('report-desc').value.trim();

    try {
      const res = await API.post('/api/reportes', {
        evento_id,
        tipo_problema,
        descripcion
      });
      showToast(res.mensaje, 'success');
      form.reset();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

// Configura las estrellas para calificar
function setupStarRating() {
  const stars = document.querySelectorAll('.star-item');
  stars.forEach(star => {
    star.addEventListener('click', async () => {
      if (!currentEvent || (!currentEvent.es_pasado && currentEvent.estado !== 'pasado')) return;
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
    container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.84rem;">Aun no hay comentarios sobre este evento escolar.</p>`;
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

