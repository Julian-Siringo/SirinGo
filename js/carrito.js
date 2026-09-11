/* ============================================================
   carrito.js
   ------------------------------------------------------------
   Carrito de compras de SirinGo. Se guarda en localStorage (una
   compra en curso vive en el navegador de cada visitante) y se
   completa contactando por WhatsApp, ya que el sitio todavía no
   tiene una pasarela de pago propia ni backend de pedidos.

   API pública (objeto global "Carrito"):
     Carrito.agregar(producto, cantidad)
     Carrito.quitar(id)
     Carrito.cambiarCantidad(id, cantidad)
     Carrito.vaciar()
     Carrito.obtenerItems()
     Carrito.obtenerTotal()
     Carrito.abrir() / Carrito.cerrar()
   ============================================================ */

const Carrito = (() => {
  const CLAVE_STORAGE = 'siringo_carrito';
  const NUMERO_WHATSAPP = '5492236946601'; // mismo número de contacto de la tienda

  function leerItems() {
    try {
      const crudo = localStorage.getItem(CLAVE_STORAGE);
      return crudo ? JSON.parse(crudo) : [];
    } catch {
      return [];
    }
  }

  function guardarItems(items) {
    localStorage.setItem(CLAVE_STORAGE, JSON.stringify(items));
    actualizarContador();
  }

  function agregar(producto, cantidad = 1) {
    const items = leerItems();
    const existente = items.find(i => String(i.id) === String(producto.id));
    if (existente) {
      existente.cantidad += cantidad;
    } else {
      items.push({
        id: producto.id,
        nombre: producto.nombre,
        precio: producto.precio,
        imagen: producto.imagenUrl || null,
        cantidad
      });
    }
    guardarItems(items);
    mostrarToast(`${producto.nombre} se agregó al carrito`);
    renderizarPanel();
  }

  function quitar(id) {
    const items = leerItems().filter(i => String(i.id) !== String(id));
    guardarItems(items);
    renderizarPanel();
  }

  function cambiarCantidad(id, cantidad) {
    let items = leerItems();
    items = items.map(i => String(i.id) === String(id) ? { ...i, cantidad: Math.max(1, cantidad) } : i);
    guardarItems(items);
    renderizarPanel();
  }

  function vaciar() {
    guardarItems([]);
    renderizarPanel();
  }

  function obtenerItems() { return leerItems(); }

  function obtenerTotal() {
    return leerItems().reduce((acum, i) => acum + i.precio * i.cantidad, 0);
  }

  function contarUnidades() {
    return leerItems().reduce((acum, i) => acum + i.cantidad, 0);
  }

  function formatearPrecio(valor) {
    return Number(valor).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 });
  }

  function actualizarContador() {
    const contador = document.getElementById('carritoContador');
    if (!contador) return;
    const total = contarUnidades();
    contador.textContent = total;
    contador.hidden = total === 0;
  }

  /* ------------------------- UI: panel lateral ------------------------- */

  function renderizarPanel() {
    const lista = document.getElementById('carritoLista');
    const footer = document.getElementById('carritoFooter');
    if (!lista) return; // el panel no está en esta página (no debería pasar, pero por las dudas)

    const items = leerItems();

    if (items.length === 0) {
      lista.innerHTML = `
        <div class="carrito-vacio">
          <div class="carrito-vacio-icono">🛍️</div>
          <p>Todavía no agregaste productos.<br>Explorá el catálogo y sumá lo que te guste.</p>
        </div>`;
      if (footer) footer.hidden = true;
      return;
    }

    if (footer) footer.hidden = false;

    lista.innerHTML = items.map(item => {
      const imagen = item.imagen
        ? `<img src="${item.imagen}" alt="${item.nombre}">`
        : `🛒`;
      return `
        <div class="carrito-item" data-item="${item.id}">
          <div class="carrito-item-imagen">${imagen}</div>
          <div class="carrito-item-info">
            <h4>${item.nombre}</h4>
            <div class="carrito-item-precio">${formatearPrecio(item.precio)} c/u</div>
            <div class="carrito-item-acciones">
              <div class="selector-cantidad">
                <button type="button" data-restar="${item.id}" aria-label="Restar unidad">−</button>
                <span>${item.cantidad}</span>
                <button type="button" data-sumar="${item.id}" aria-label="Sumar unidad">+</button>
              </div>
              <button type="button" class="carrito-item-quitar" data-quitar="${item.id}">Quitar</button>
            </div>
          </div>
        </div>`;
    }).join('');

    const subtotal = obtenerTotal();
    const elSubtotal = document.getElementById('carritoSubtotal');
    const elTotal = document.getElementById('carritoTotal');
    if (elSubtotal) elSubtotal.textContent = formatearPrecio(subtotal);
    if (elTotal) elTotal.textContent = formatearPrecio(subtotal);

    lista.querySelectorAll('[data-sumar]').forEach(btn => {
      const item = items.find(i => String(i.id) === btn.dataset.sumar);
      btn.addEventListener('click', () => cambiarCantidad(btn.dataset.sumar, item.cantidad + 1));
    });
    lista.querySelectorAll('[data-restar]').forEach(btn => {
      const item = items.find(i => String(i.id) === btn.dataset.restar);
      btn.addEventListener('click', () => {
        if (item.cantidad <= 1) { quitar(btn.dataset.restar); return; }
        cambiarCantidad(btn.dataset.restar, item.cantidad - 1);
      });
    });
    lista.querySelectorAll('[data-quitar]').forEach(btn => {
      btn.addEventListener('click', () => quitar(btn.dataset.quitar));
    });
  }

  function abrir() {
    document.getElementById('carritoOverlay')?.classList.add('abierto');
    document.getElementById('carritoPanel')?.classList.add('abierto');
    document.body.style.overflow = 'hidden';
    renderizarPanel();
  }

  function cerrar() {
    document.getElementById('carritoOverlay')?.classList.remove('abierto');
    document.getElementById('carritoPanel')?.classList.remove('abierto');
    document.body.style.overflow = '';
  }

  function mostrarToast(texto) {
    let toast = document.getElementById('toastCarrito');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toastCarrito';
      toast.className = 'toast-carrito';
      document.body.appendChild(toast);
    }
    toast.textContent = texto;
    toast.classList.add('visible');
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => toast.classList.remove('visible'), 2200);
  }

  /* Ya no arma el mensaje de WhatsApp acá: el botón "Finalizar
     compra" lleva al checkout (checkout.html), donde el
     comprador carga sus datos y, al final, se le pide enviar el
     comprobante de pago por WhatsApp. */
  function finalizarPedido() {
    if (leerItems().length === 0) return;
    window.location.href = 'checkout.html';
  }

  function inicializar() {
    actualizarContador();

    document.getElementById('abrirCarrito')?.addEventListener('click', abrir);
    document.getElementById('cerrarCarrito')?.addEventListener('click', cerrar);
    document.getElementById('carritoOverlay')?.addEventListener('click', cerrar);
    document.getElementById('btnVaciarCarrito')?.addEventListener('click', vaciar);
    document.getElementById('btnFinalizarPedido')?.addEventListener('click', finalizarPedido);
    document.getElementById('btnSeguirComprando')?.addEventListener('click', cerrar);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrar(); });

    renderizarPanel();
  }

  document.addEventListener('DOMContentLoaded', inicializar);

  return { agregar, quitar, cambiarCantidad, vaciar, obtenerItems, obtenerTotal, abrir, cerrar };
})();
