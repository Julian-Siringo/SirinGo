/* ============================================================
   auth.js
   ------------------------------------------------------------
   Maneja: registro, login, logout y actualización del header
   (versión desktop y versión mobile) según el estado de sesión
   de Supabase Auth. Se incluye en TODAS las páginas.
   ============================================================ */

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ------------------------- header dinámico ------------------------- */

async function actualizarHeader() {
  const sesion = await SirinGoDB.getSesion();
  const zonas = document.querySelectorAll('[data-zona-sesion]');
  if (!zonas.length) return;

  const html = !sesion
    ? `
      <a href="login.html" class="btn btn-outline btn-sm">Iniciar sesión</a>
      <a href="registro.html" class="btn btn-primary btn-sm">Registrarse</a>
    `
    : `
      <span class="saludo-usuario">Hola, ${escaparHTML(sesion.nombre)}</span>
      <a href="pedidos.html" class="btn btn-ghost btn-sm">Mis pedidos</a>
      ${sesion.rol === 'admin' ? `<a href="admin.html" class="btn btn-ghost btn-sm">Panel admin</a>` : ''}
      <button class="btn btn-outline btn-sm btn-cerrar-sesion" type="button">Cerrar sesión</button>
    `;

  zonas.forEach(zona => { zona.innerHTML = html; });

  document.querySelectorAll('.btn-cerrar-sesion').forEach(btn => {
    btn.addEventListener('click', async () => {
      await SirinGoDB.cerrarSesion();
      window.location.href = 'index.html';
    });
  });
}

function escaparHTML(texto) {
  const div = document.createElement('div');
  div.textContent = texto ?? '';
  return div.innerHTML;
}

/* ------------------------- protección de rutas ------------------------- */

async function protegerRutaAdmin() {
  const sesion = await SirinGoDB.getSesion();
  if (!sesion || sesion.rol !== 'admin') {
    window.location.href = 'login.html';
    return null;
  }
  return sesion;
}

/* Para páginas que solo requieren estar logueado (cualquier rol),
   como "Mis pedidos" o "Continuar pago". */
async function protegerRutaUsuario() {
  const sesion = await SirinGoDB.getSesion();
  if (!sesion) {
    window.location.href = 'login.html';
    return null;
  }
  return sesion;
}

async function redirigirSiYaLogueado() {
  const sesion = await SirinGoDB.getSesion();
  if (sesion) {
    window.location.href = sesion.rol === 'admin' ? 'admin.html' : 'index.html';
  }
}

/* ------------------------- feedback visual ------------------------- */

function mostrarMensaje(contenedor, texto, tipo = 'error') {
  contenedor.textContent = texto;
  contenedor.className = `mensaje-form mensaje-${tipo}`;
  contenedor.hidden = false;
}

function ocultarMensaje(contenedor) {
  contenedor.hidden = true;
  contenedor.textContent = '';
}

/* ------------------------- formulario de registro ------------------------- */

function inicializarFormularioRegistro() {
  const form = document.getElementById('formRegistro');
  if (!form) return;

  const mensaje = document.getElementById('mensajeRegistro');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    ocultarMensaje(mensaje);

    const nombre = form.elements.nombre.value.trim();
    const apellido = form.elements.apellido.value.trim();
    const email = form.elements.email.value.trim();
    const password = form.elements.password.value;
    const confirmar = form.elements.confirmarPassword.value;

    if (!nombre || !apellido || !email || !password || !confirmar) {
      mostrarMensaje(mensaje, 'Completá todos los campos obligatorios.');
      return;
    }
    if (!REGEX_EMAIL.test(email)) {
      mostrarMensaje(mensaje, 'Ingresá un email válido.');
      return;
    }
    if (password.length < 8) {
      mostrarMensaje(mensaje, 'La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (password !== confirmar) {
      mostrarMensaje(mensaje, 'Las contraseñas no coinciden.');
      return;
    }

    const botonSubmit = form.querySelector('button[type="submit"]');
    botonSubmit.disabled = true;

    const resultado = await SirinGoDB.crearUsuario({ nombre, apellido, email, password });

    botonSubmit.disabled = false;

    if (!resultado.ok) {
      mostrarMensaje(mensaje, resultado.motivo);
      return;
    }

    mostrarMensaje(mensaje, '¡Cuenta creada con éxito! Redirigiendo a inicio de sesión...', 'exito');
    form.reset();
    setTimeout(() => { window.location.href = 'login.html'; }, 1600);
  });
}

/* ------------------------- formulario de login ------------------------- */

function inicializarFormularioLogin() {
  const form = document.getElementById('formLogin');
  if (!form) return;

  const mensaje = document.getElementById('mensajeLogin');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    ocultarMensaje(mensaje);

    const email = form.elements.email.value.trim();
    const password = form.elements.password.value;

    if (!email || !password) {
      mostrarMensaje(mensaje, 'Completá email y contraseña.');
      return;
    }

    const botonSubmit = form.querySelector('button[type="submit"]');
    botonSubmit.disabled = true;

    const resultado = await SirinGoDB.iniciarSesion(email, password);

    botonSubmit.disabled = false;

    if (!resultado.ok) {
      mostrarMensaje(mensaje, resultado.motivo);
      return;
    }

    mostrarMensaje(mensaje, `¡Bienvenido/a, ${resultado.usuario.nombre}! Redirigiendo...`, 'exito');
    setTimeout(() => {
      window.location.href = resultado.usuario.rol === 'admin' ? 'admin.html' : 'index.html';
    }, 900);
  });
}

/* ------------------------- menú hamburguesa ------------------------- */

function inicializarMenuMovil() {
  const toggle = document.getElementById('navToggle');
  const menu = document.getElementById('navLinks');
  if (!toggle || !menu) return;

  toggle.addEventListener('click', () => {
    const abierto = menu.classList.toggle('abierto');
    toggle.setAttribute('aria-expanded', abierto ? 'true' : 'false');
  });

  menu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      menu.classList.remove('abierto');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });
}

/* ------------------------- cinta de anuncios (marquesina) ------------------------- */

function inicializarCintaAnuncios() {
  const track = document.querySelector('.cinta-anuncios-track');
  if (!track) return;

  const items = ['Artículos de Bazar', 'Mates personalizados', 'Artículos para Viaje', 'Regalos Personalizados'];

  // Repetimos la lista las veces que haga falta para que un solo
  // "bloque" ya sea más ancho que la pantalla (así nunca se ve un
  // hueco en blanco), y después duplicamos ese bloque completo una
  // vez más: la animación corre del 0% al -50% y, como las dos
  // mitades son idénticas, el loop se ve perfectamente continuo.
  const vecesPorBloque = Math.max(4, Math.ceil((window.innerWidth * 1.5) / (items.length * 220)));
  const bloqueHTML = Array.from({ length: vecesPorBloque })
    .flatMap(() => items)
    .map(texto => `<span class="cinta-anuncios-item">${texto}</span>`)
    .join('');

  track.innerHTML = bloqueHTML + bloqueHTML;
}

document.addEventListener('DOMContentLoaded', () => {
  actualizarHeader();
  inicializarMenuMovil();
  inicializarCintaAnuncios();
});
