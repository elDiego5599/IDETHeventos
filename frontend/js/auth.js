/**
 * auth.js - Manejo de formularios de Inicio de Sesión, Registro y Control de Acceso
 */

document.addEventListener('DOMContentLoaded', () => {
  setupAuthModals();
  setupAuthForms();
  updateNavigationUI();
});

// Control para abrir y cerrar modales de autenticación
function setupAuthModals() {
  const loginModal = document.getElementById('login-modal');
  const registerModal = document.getElementById('register-modal');

  const btnOpenLogin = document.getElementById('btn-open-login');
  const btnOpenRegister = document.getElementById('btn-open-register');
  const heroBtnRegister = document.getElementById('hero-btn-register');

  const switchToRegister = document.getElementById('switch-to-register');
  const switchToLogin = document.getElementById('switch-to-login');

  const closeButtons = document.querySelectorAll('.modal-close, .btn-close-modal');

  // Abrir Modal Login
  if (btnOpenLogin) {
    btnOpenLogin.addEventListener('click', (e) => {
      e.preventDefault();
      openModal('login-modal');
    });
  }

  // Abrir Modal Registro
  if (btnOpenRegister) {
    btnOpenRegister.addEventListener('click', (e) => {
      e.preventDefault();
      openModal('register-modal');
    });
  }

  if (heroBtnRegister) {
    heroBtnRegister.addEventListener('click', (e) => {
      e.preventDefault();
      if (AuthStorage.isLoggedIn()) {
        const user = AuthStorage.getUser();
        window.location.href = user?.rol === 'admin' ? '/admin' : '/dashboard';
      } else {
        openModal('register-modal');
      }
    });
  }

  // Cambiar entre Login y Registro
  if (switchToRegister) {
    switchToRegister.addEventListener('click', (e) => {
      e.preventDefault();
      closeModal('login-modal');
      openModal('register-modal');
    });
  }

  if (switchToLogin) {
    switchToLogin.addEventListener('click', (e) => {
      e.preventDefault();
      closeModal('register-modal');
      openModal('login-modal');
    });
  }

  // Cerrar Modales
  closeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      closeModal('login-modal');
      closeModal('register-modal');
      closeModal('event-detail-modal');
    });
  });

  // Cerrar al hacer clic en el fondo oscuro
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('active');
      }
    });
  });
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('active');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('active');
}

// Configuración de los formularios de Login y Registro
function setupAuthForms() {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');

  // Formulario de Inicio de Sesión
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;
      const btnSubmit = loginForm.querySelector('button[type="submit"]');

      try {
        btnSubmit.disabled = true;
        btnSubmit.textContent = 'Iniciando sesión...';

        const data = await API.post('/api/auth/login', { email, password });
        AuthStorage.setToken(data.token);
        AuthStorage.setUser(data.usuario);

        showToast(`¡Bienvenido de nuevo, ${data.usuario.nombre}!`, 'success');
        closeModal('login-modal');

        // Redirigir según el rol
        setTimeout(() => {
          if (data.usuario.rol === 'admin') {
            window.location.href = '/admin';
          } else {
            window.location.href = '/dashboard';
          }
        }, 1000);

      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        btnSubmit.disabled = false;
        btnSubmit.textContent = 'Ingresar al Portal';
      }
    });
  }

  // Formulario de Registro (Nuevo estudiante)
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nombre = document.getElementById('reg-nombre').value.trim();
      const email = document.getElementById('reg-email').value.trim();
      const password = document.getElementById('reg-password').value;
      const btnSubmit = registerForm.querySelector('button[type="submit"]');

      if (password.length < 6) {
        showToast('La contraseña debe tener al menos 6 caracteres', 'error');
        return;
      }

      try {
        btnSubmit.disabled = true;
        btnSubmit.textContent = 'Creando cuenta...';

        const data = await API.post('/api/auth/register', { nombre, email, password });
        AuthStorage.setToken(data.token);
        AuthStorage.setUser(data.usuario);

        showToast('¡Cuenta creada con éxito! Bienvenido al portal escolar.', 'success');
        closeModal('register-modal');

        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 1000);

      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        btnSubmit.disabled = false;
        btnSubmit.textContent = 'Registrarme como Estudiante';
      }
    });
  }
}

// Actualiza los botones de la barra de navegación según el estado de la sesión
function updateNavigationUI() {
  const navAuthButtons = document.getElementById('nav-auth-buttons');
  const user = AuthStorage.getUser();

  if (!navAuthButtons) return;

  if (user && AuthStorage.isLoggedIn()) {
    const dashboardLink = user.rol === 'admin' ? '/admin' : '/dashboard';
    const roleBadge = user.rol === 'admin' ? '🛡️ Admin' : '🎓 Estudiante';

    navAuthButtons.innerHTML = `
      <span style="font-size: 0.88rem; color: var(--text-muted); font-weight: 600;">
        ${roleBadge} | <strong>${user.nombre.split(' ')[0]}</strong>
      </span>
      <a href="${dashboardLink}" class="btn btn-primary btn-sm">Mi Panel</a>
      <button onclick="logoutUser()" class="btn btn-outline btn-sm">Salir</button>
    `;
  }
}

// Función global de cerrar sesión
function logoutUser() {
  AuthStorage.clear();
  showToast('Has cerrado sesión correctamente.', 'info');
  setTimeout(() => {
    window.location.href = '/';
  }, 800);
}
