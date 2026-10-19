// Logica de la pagina principal (index)
let allEvents = [];
let currentFilter = 'todos';

// Cuando se carga la pagina, actualizamos el menu y cargamos los eventos
document.addEventListener('DOMContentLoaded', () => {
  updateNavbar();
  setupNavbarScroll();
  loadPublicEvents();
  setupFilterButtons();
  setupSearchInput();

  const message = new URLSearchParams(window.location.search).get('mensaje');
  if (message) {
    showToast(message, 'error');
    window.history.replaceState({}, document.title, window.location.pathname);
  }
});

function setupNavbarScroll() {
  const navbar = document.querySelector('.navbar');
  if (!navbar) return;

  const updateNavbarState = () => {
    navbar.classList.toggle('scrolled', window.scrollY > 24);
  };

  updateNavbarState();
  window.addEventListener('scroll', updateNavbarState, { passive: true });
}

// Trae los eventos desde el backend y los muestra
async function loadPublicEvents() {
  const container = document.getElementById('events-grid');
  if (!container) return;

  try {
    const events = await API.get('/api/eventos');
    allEvents = events;
    setupHeroCarousel(events);
    applyCurrentFilters();
  } catch (err) {
    container.innerHTML = `<div class="empty-state">No se pudo cargar la lista de eventos.</div>`;
    setupHeroCarousel([]);
  }
}

function setupHeroCarousel(events) {
  const carousel = document.getElementById('hero-carousel');
  const track = document.getElementById('hero-carousel-track');
  const dotsContainer = document.getElementById('hero-carousel-dots');
  if (!carousel || !track || !dotsContainer) return;

  const recentEvents = events
    .filter(event => event.imagen_url && event.fecha)
    .sort((first, second) => new Date(second.fecha.replace(' ', 'T')) - new Date(first.fecha.replace(' ', 'T')))
    .slice(0, 5);

  if (recentEvents.length === 0) {
    track.innerHTML = '<div class="hero-carousel-empty">Pronto compartiremos nuevas actividades del colegio.</div>';
    dotsContainer.hidden = true;
    carousel.querySelector('.hero-carousel-controls').hidden = true;
    return;
  }

  track.innerHTML = recentEvents.map((event, index) => {
    const date = new Date(`${event.fecha.slice(0, 10)}T12:00:00`);
    const dateLabel = new Intl.DateTimeFormat('es-CO', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(date);
    const imageUrl = getEventThumbnail(event.imagen_url);

    return `
      <button class="hero-carousel-slide${index === 0 ? ' active' : ''}" type="button"
        data-slide-index="${index}" aria-label="Ver detalles de ${event.titulo}" aria-hidden="${index !== 0}">
        <img src="${imageUrl}" alt="${event.titulo}" ${index === 0 ? 'fetchpriority="high"' : 'loading="lazy"'}>
        <span class="hero-carousel-caption">
          <span class="hero-carousel-date">${dateLabel}</span>
          <span class="hero-carousel-title">${event.titulo}</span>
        </span>
      </button>
    `;
  }).join('');

  dotsContainer.innerHTML = recentEvents.map((event, index) => `
    <button class="hero-carousel-dot${index === 0 ? ' active' : ''}" type="button"
      data-slide-index="${index}" aria-label="Mostrar ${event.titulo}" aria-current="${index === 0 ? 'true' : 'false'}"></button>
  `).join('');

  const slides = [...track.querySelectorAll('.hero-carousel-slide')];
  const dots = [...dotsContainer.querySelectorAll('.hero-carousel-dot')];
  const controls = carousel.querySelector('.hero-carousel-controls');
  let activeIndex = 0;
  let timer;

  const showSlide = (index) => {
    activeIndex = (index + slides.length) % slides.length;
    slides.forEach((slide, slideIndex) => {
      const isActive = slideIndex === activeIndex;
      slide.classList.toggle('active', isActive);
      slide.setAttribute('aria-hidden', String(!isActive));
    });
    dots.forEach((dot, dotIndex) => {
      const isActive = dotIndex === activeIndex;
      dot.classList.toggle('active', isActive);
      dot.setAttribute('aria-current', String(isActive));
    });
  };
  const pause = () => window.clearInterval(timer);
  const resume = () => {
    pause();
    if (slides.length > 1 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      timer = window.setInterval(() => showSlide(activeIndex + 1), 5000);
    }
  };

  controls.hidden = slides.length < 2;
  dotsContainer.hidden = slides.length < 2;
  controls.querySelector('[data-carousel-prev]').addEventListener('click', () => showSlide(activeIndex - 1));
  controls.querySelector('[data-carousel-next]').addEventListener('click', () => showSlide(activeIndex + 1));
  dotsContainer.addEventListener('click', (event) => {
    const dot = event.target.closest('[data-slide-index]');
    if (dot) showSlide(Number(dot.dataset.slideIndex));
  });
  track.addEventListener('click', (event) => {
    const slide = event.target.closest('.hero-carousel-slide');
    if (slide) openPublicEventDetail(recentEvents[Number(slide.dataset.slideIndex)].id);
  });
  carousel.addEventListener('mouseenter', pause);
  carousel.addEventListener('mouseleave', resume);
  carousel.addEventListener('focusin', pause);
  carousel.addEventListener('focusout', (event) => {
    if (!carousel.contains(event.relatedTarget)) resume();
  });
  resume();
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

  // Filtro por fecha (desde / hasta)
  const dateFrom = document.getElementById('filter-date-from')?.value || '';
  const dateTo = document.getElementById('filter-date-to')?.value || '';
  if (dateFrom || dateTo) {
    filtered = filtered.filter(e => matchesDateRange(e, dateFrom, dateTo));
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
  setupDateFilter('filter-date-from', 'filter-date-to', 'filter-date-clear', applyCurrentFilters);
}

// Imagen del evento, vacio si no tiene foto (la tarjeta va sin imagen)
function getEventThumbnail(url) {
  if (!url || !url.trim()) return '';
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
    container.innerHTML = `<div class="empty-state">No hay eventos.</div>`;
    return;
  }

  container.innerHTML = events.map(e => {
    let statusBadge = '<span class="badge badge-upcoming">Próximo</span>';
    if (e.estado === 'activo') {
      statusBadge = '<span class="badge badge-active">Hoy</span>';
    } else if (e.es_pasado || e.estado === 'pasado') {
      statusBadge = '<span class="badge badge-past">Finalizado</span>';
    }

    const volunteerBadge = e.permite_voluntarios
      ? '<span class="badge badge-volunteer">Voluntarios</span>'
      : '';

    const categoryBadge = `<span class="badge badge-category">${e.categoria_nombre || 'Deportes'}</span>`;
    const photoUrl = getEventThumbnail(e.imagen_url);
    const photoHtml = photoUrl
      ? `<div class="event-card-img-wrap">
           <img src="${photoUrl}" alt="${e.titulo}" class="event-card-img" onerror="this.src='/static/img/cancha_futbol_ideth.jpeg'">
         </div>`
      : '';

    const mottoHtml = e.frase_motivacional
      ? `<div class="event-motto">"${e.frase_motivacional}"</div>`
      : '';

    return `
      <div class="event-card">
        ${photoHtml}
        <div class="event-card-header">
          ${categoryBadge}
          <div class="event-card-statuses">
            ${volunteerBadge}
            ${statusBadge}
          </div>
        </div>
        <div class="event-card-body">
          <h3 class="event-card-title">${e.titulo}</h3>
          <div class="event-meta">
            <div><strong>Fecha:</strong> ${e.fecha}</div>
          </div>
          <div class="event-card-extra">
            ${mottoHtml}
            <p class="event-card-desc">${e.descripcion || ''}</p>
            <div class="event-card-place"><strong>Lugar:</strong> ${e.ubicacion_nombre || 'Cancha Principal'}</div>
          </div>
          <button type="button" class="event-toggle" aria-expanded="false" onclick="toggleEventCard(this)">Ver más información</button>
        </div>
        <div class="event-card-footer">
          <span class="event-enrollment-count">
            ${e.total_inscritos || 0} inscritos
          </span>
          <button onclick="openPublicEventDetail(${e.id})" class="btn btn-outline btn-sm">Ver detalle</button>
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
    const photoHtml = photoUrl
      ? `<img src="${photoUrl}" alt="${e.titulo}" class="modal-event-cover" onerror="this.src='/static/img/cancha_futbol_ideth.jpeg'">`
      : '';

    // Badges
    let statusBadge = '<span class="badge badge-upcoming">Próximo</span>';
    if (e.estado === 'activo') {
      statusBadge = '<span class="badge badge-active">Hoy</span>';
    } else if (e.es_pasado || e.estado === 'pasado') {
      statusBadge = '<span class="badge badge-past">Finalizado</span>';
    }

    const volunteerBadge = e.permite_voluntarios
      ? '<span class="badge badge-volunteer">Voluntarios</span>'
      : '';

    const mottoHtml = e.frase_motivacional
      ? `<div class="event-motto event-motto-centered">"${e.frase_motivacional}"</div>`
      : '';

    const summaryHtml = (e.es_pasado || e.estado === 'pasado') && e.resumen_pasado
      ? `<div class="event-summary-box">${e.resumen_pasado}</div>`
      : '';

    document.getElementById('modal-detail-body').innerHTML = `
      ${photoHtml}
      <div class="modal-badges">
        <span class="badge badge-category">${e.categoria_nombre || 'Deportes'}</span>
        ${statusBadge}
        ${volunteerBadge}
      </div>
      ${mottoHtml}
      ${summaryHtml}
      <p class="modal-desc">${e.descripcion || ''}</p>
      <div class="event-meta modal-event-meta">
        <div><strong>Lugar:</strong> ${e.ubicacion_nombre || 'Cancha Principal'}</div>
        <div><strong>Fecha:</strong> ${e.fecha}</div>
        <div><strong>Inscritos:</strong> ${e.total_inscritos || 0}</div>
      </div>
    `;

    const actionContainer = document.getElementById('modal-detail-action');
    if (AuthStorage.isLoggedIn()) {
      const user = AuthStorage.getUser();
      actionContainer.innerHTML = `<a href="${user.rol === 'admin' ? '/admin' : '/dashboard'}" class="btn btn-primary btn-sm">Ir a mi panel</a>`;
    } else {
      actionContainer.innerHTML = `<a href="/login" class="btn btn-primary btn-sm">Iniciar sesión para inscribirte</a>`;
    }

    openModal('event-detail-modal');
  } catch (err) {
    showToast('No se pudo cargar el detalle del evento', 'error');
  }
}
