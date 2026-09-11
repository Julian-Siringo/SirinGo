/* ============================================================
   producto-detalle.js
   ------------------------------------------------------------
   Página producto.html (?id=123). Muestra la ficha completa de
   un producto: galería de imágenes con miniaturas, una
   valoración de clientes (siempre positiva, para generar
   confianza), las características del producto en formato de
   lista con tildes, y hasta 3 opciones de compra configurables
   desde el panel de administración (tabla producto_opciones).

   Si el producto todavía no tiene opciones de compra cargadas,
   se muestra una única opción con el precio de lista, para que
   la página siempre funcione aunque el admin no haya configurado
   nada todavía.
   ============================================================ */

(() => {
  let producto = null;
  let galeria = [];
  let indiceImagenActual = 0;
  let opciones = [];
  let opcionSeleccionada = null;

  function obtenerIdDeUrl() {
    return new URLSearchParams(window.location.search).get('id');
  }

  /* ------------------------- valoración (siempre positiva) ------------------------- */
  // Se calcula a partir del id del producto para que sea siempre la
  // misma cada vez que se visita la ficha (no cambia en cada recarga).

  function calcularValoracion(id) {
    const semilla = Number(id) || 1;
    const rating = (4.6 + (semilla % 4) * 0.1).toFixed(1); // entre 4.6 y 4.9
    const reseñas = 180 + ((semilla * 37) % 820); // entre 180 y ~1000
    return { rating, reseñas };
  }

  /* ------------------------- características (a partir de la descripción) ------------------------- */

  function armarFeatures(descripcion) {
    if (!descripcion) return ['Producto de calidad, seleccionado especialmente para vos.'];
    const oraciones = descripcion
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(Boolean);
    return oraciones.slice(0, 5);
  }

  /* ------------------------- galería ------------------------- */

  function renderizarGaleria() {
    const imgPrincipal = document.getElementById('detalleImagenActual');
    const videoPrincipal = document.getElementById('detalleVideoActual');
    const miniaturas = document.getElementById('detalleMiniaturas');

    if (galeria.length === 0) {
      document.getElementById('detalleImagenPrincipal').style.background = 'var(--superficie-2)';
      imgPrincipal.style.display = 'none';
      videoPrincipal.style.display = 'none';
      miniaturas.innerHTML = '';
      return;
    }

    mostrarItemPrincipal(indiceImagenActual);

    miniaturas.innerHTML = galeria.map((item, i) => `
      <button type="button" class="detalle-miniatura ${i === indiceImagenActual ? 'activa' : ''}" data-indice="${i}">
        ${item.tipo === 'video'
          ? `<video src="${item.url}" muted preload="metadata"></video><span class="detalle-miniatura-play">▶</span>`
          : `<img src="${item.url}" alt="${escaparHTML(producto.nombre)} ${i + 1}">`}
      </button>
    `).join('');

    miniaturas.querySelectorAll('[data-indice]').forEach(btn => {
      btn.addEventListener('click', () => cambiarImagen(Number(btn.dataset.indice)));
    });

    document.getElementById('flechaAnterior').hidden = galeria.length <= 1;
    document.getElementById('flechaSiguiente').hidden = galeria.length <= 1;
  }

  function mostrarItemPrincipal(indice) {
    const imgPrincipal = document.getElementById('detalleImagenActual');
    const videoPrincipal = document.getElementById('detalleVideoActual');
    const item = galeria[indice];
    if (!item) return;

    if (item.tipo === 'video') {
      imgPrincipal.style.display = 'none';
      videoPrincipal.src = item.url;
      videoPrincipal.style.display = '';
      videoPrincipal.load();
    } else {
      videoPrincipal.pause();
      videoPrincipal.removeAttribute('src');
      videoPrincipal.style.display = 'none';
      imgPrincipal.src = item.url;
      imgPrincipal.alt = producto.nombre;
      imgPrincipal.style.display = '';
    }
  }

  function cambiarImagen(indice) {
    if (indice === indiceImagenActual || galeria.length === 0) return;
    const imgPrincipal = document.getElementById('detalleImagenActual');
    imgPrincipal.classList.add('imagen-saliendo');
    setTimeout(() => {
      indiceImagenActual = (indice + galeria.length) % galeria.length;
      mostrarItemPrincipal(indiceImagenActual);
      imgPrincipal.classList.remove('imagen-saliendo');
      document.querySelectorAll('.detalle-miniatura').forEach((min, i) => {
        min.classList.toggle('activa', i === indiceImagenActual);
      });
    }, 180);
  }

  /* ------------------------- opciones de compra ------------------------- */

  function renderizarOpciones() {
    const cont = document.getElementById('detalleOpciones');
    const separador = document.getElementById('detalleSeparador');

    const listaOpciones = opciones.length > 0 ? opciones : [{
      id: null,
      titulo: '1 unidad',
      subtitulo: 'Producto individual',
      etiqueta: null,
      precio: producto.precio,
      precio_anterior: producto.precio_anterior || null,
      destacada: false
    }];

    separador.hidden = listaOpciones.length <= 1;
    opcionSeleccionada = listaOpciones.find(o => o.destacada) || listaOpciones[0];

    cont.innerHTML = listaOpciones.map((o, i) => `
      <div class="opcion-compra ${o.destacada ? 'destacada' : ''} ${o === opcionSeleccionada ? 'seleccionada' : ''}" data-opcion="${i}">
        <div class="opcion-compra-radio"></div>
        <div class="opcion-compra-textos">
          <div class="opcion-compra-titulo-fila">
            <strong>${escaparHTML(o.titulo)}</strong>
            ${o.etiqueta ? `<span class="opcion-compra-etiqueta">${escaparHTML(o.etiqueta)}</span>` : ''}
          </div>
          ${o.subtitulo ? `<div class="opcion-compra-subtitulo">${escaparHTML(o.subtitulo)}</div>` : ''}
        </div>
        <div class="opcion-compra-precios">
          <div class="opcion-compra-precio">${SirinGoDB.formatearPrecio(o.precio)}</div>
          ${o.precio_anterior ? `<span class="opcion-compra-precio-anterior">${SirinGoDB.formatearPrecio(o.precio_anterior)}</span>` : ''}
        </div>
      </div>
    `).join('');

    cont.querySelectorAll('[data-opcion]').forEach(el => {
      el.addEventListener('click', () => {
        opcionSeleccionada = listaOpciones[Number(el.dataset.opcion)];
        cont.querySelectorAll('.opcion-compra').forEach(o => o.classList.remove('seleccionada'));
        el.classList.add('seleccionada');
      });
    });
  }

  /* ------------------------- aviso de stock ------------------------- */

  function renderizarStockAviso() {
    const el = document.getElementById('detalleStockAviso');
    if (!el) return;
    const stock = producto.stock ?? 0;

    if (stock <= 0) {
      el.textContent = 'Sin stock disponible por el momento.';
      el.classList.add('agotado');
    } else {
      el.textContent = `Atención — Quedan ${stock} unidad${stock === 1 ? '' : 'es'}`;
      el.classList.remove('agotado');
    }
  }

  /* ------------------------- agregar al carrito ------------------------- */

  function agregarAlCarrito() {
    if (!producto || !opcionSeleccionada) return;
    const esOpcionUnica = opciones.length === 0;
    Carrito.agregar({
      id: `${producto.id}${esOpcionUnica ? '' : '-' + opcionSeleccionada.titulo}`,
      nombre: esOpcionUnica ? producto.nombre : `${producto.nombre} — ${opcionSeleccionada.titulo}`,
      precio: opcionSeleccionada.precio,
      imagenUrl: (galeria.find(item => item.tipo === 'imagen') || {}).url || null
    }, 1);
    Carrito.abrir();
  }

  /* ------------------------- utilidades ------------------------- */

  function escaparHTML(texto) {
    const div = document.createElement('div');
    div.textContent = texto ?? '';
    return div.innerHTML;
  }

  /* ------------------------- inicialización ------------------------- */

  /* ------------------------- categorías, colores y promo 2x1 ------------------------- */

  async function renderizarChipsYPromo() {
    const contChips = document.getElementById('detalleChips');
    const rubros = await SirinGoDB.getRubros();
    const idsCategorias = producto.categorias || [producto.rubro_id];
    const nombres = idsCategorias.map(id => rubros.find(r => r.id === id)).filter(Boolean);

    contChips.innerHTML = nombres.length > 0
      ? nombres.map(r => `<span class="chip">${escaparHTML(r.nombre)}</span>`).join('')
      : '';

    document.getElementById('detalleEtiqueta2x1').hidden = !producto.es_2x1;
  }

  function renderizarColores() {
    const cont = document.getElementById('detalleColores');
    const colores = Array.isArray(producto.colores) ? producto.colores : [];
    if (colores.length === 0) { cont.hidden = true; return; }

    cont.hidden = false;
    cont.innerHTML = `
      <span class="detalle-colores-titulo">Colores disponibles:</span>
      ${colores.map(c => `
        <span class="detalle-color-item" title="${escaparHTML(c.nombre)}">
          <span class="detalle-color-punto" style="background:${escaparHTML(c.hex)};"></span>
          ${escaparHTML(c.nombre)}
        </span>
      `).join('')}
    `;
  }

  /* ------------------------- inicialización ------------------------- */

  async function inicializar() {
    const id = obtenerIdDeUrl();
    if (!id) { mostrarNoEncontrado(); return; }

    producto = await SirinGoDB.getProductoPorId(id);
    if (!producto) { mostrarNoEncontrado(); return; }

    document.title = `${producto.nombre} — SirinGo`;
    document.getElementById('migaProducto').textContent = producto.nombre;
    document.getElementById('detalleNombre').textContent = producto.nombre;

    const { rating, reseñas } = calcularValoracion(producto.id);
    document.getElementById('detalleRating').textContent = rating;
    document.getElementById('detalleReseñas').textContent = reseñas.toLocaleString('es-AR');

    document.getElementById('detalleFeatures').innerHTML =
      armarFeatures(producto.descripcion).map(f => `<li>${escaparHTML(f)}</li>`).join('');

    await renderizarChipsYPromo();
    renderizarColores();

    galeria = SirinGoDB.obtenerGaleriaMultimediaProducto(producto);
    indiceImagenActual = 0;
    renderizarGaleria();

    opciones = await SirinGoDB.getOpcionesProducto(producto.id);
    renderizarOpciones();
    renderizarStockAviso();

    document.getElementById('flechaAnterior').addEventListener('click', () => cambiarImagen(indiceImagenActual - 1));
    document.getElementById('flechaSiguiente').addEventListener('click', () => cambiarImagen(indiceImagenActual + 1));
    document.getElementById('btnAgregarDetalle').addEventListener('click', agregarAlCarrito);

    document.getElementById('detalleContenido').hidden = false;
  }

  function mostrarNoEncontrado() {
    document.getElementById('detalleContenido').hidden = true;
    document.getElementById('detalleNoEncontrado').hidden = false;
    document.getElementById('detalleMigas').hidden = true;
  }

  document.addEventListener('DOMContentLoaded', inicializar);
})();
