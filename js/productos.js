/* ============================================================
   productos.js
   ------------------------------------------------------------
   Renderiza en index.html el catálogo dinámico: chips de
   categoría, búsqueda, filtro por marca, ordenamiento, modal de
   detalle con "Agregar al carrito" y formulario de contacto. Los
   productos nunca se escriben a mano en el HTML: siempre se
   generan dinámicamente consultando a Supabase a través de
   SirinGoDB (ver js/data.js).
   ============================================================ */

let filtrosCatalogo = {
  texto: '',
  rubroId: 'todos',
  marcaId: 'todas',
  orden: 'relevancia'
};

// Caches simples en memoria para no repetir consultas de categorías/marcas
// cada vez que se re-renderiza el catálogo.
let cacheRubros = [];
let cacheMarcas = [];
let cacheProductos = [];

async function inicializarTienda() {
  cacheRubros = await SirinGoDB.getRubros();
  cacheMarcas = await SirinGoDB.getMarcas();
  cacheProductos = await SirinGoDB.getProductos();

  const grid = document.getElementById('gridProductos');
  if (grid) {
    renderizarChipsCategoria();
    poblarFiltroRubros();
    poblarFiltroMarcas();
    await renderizarCatalogo();

    document.getElementById('buscadorProductos')?.addEventListener('input', (e) => {
      filtrosCatalogo.texto = e.target.value.trim().toLowerCase();
      renderizarCatalogo();
    });
    document.getElementById('filtroRubro')?.addEventListener('change', (e) => {
      filtrosCatalogo.rubroId = e.target.value;
      actualizarChipsActivos();
      renderizarCatalogo();
    });
    document.getElementById('filtroMarca')?.addEventListener('change', (e) => {
      filtrosCatalogo.marcaId = e.target.value;
      renderizarCatalogo();
    });
    document.getElementById('ordenProductos')?.addEventListener('change', (e) => {
      filtrosCatalogo.orden = e.target.value;
      renderizarCatalogo();
    });
  }

  // buscador del header (versión desktop y versión mobile): al presionar
  // Enter, filtra el catálogo de esta misma página y lo lleva a la vista.
  ['buscadorHeader', 'buscadorHeaderMovil'].forEach(idBuscador => {
    const buscadorHeader = document.getElementById(idBuscador);
    if (!buscadorHeader) return;
    buscadorHeader.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const valor = buscadorHeader.value.trim();
      if (!document.getElementById('gridProductos')) {
        window.location.href = `index.html?buscar=${encodeURIComponent(valor)}#catalogo`;
        return;
      }
      filtrosCatalogo.texto = valor.toLowerCase();
      const inputCatalogo = document.getElementById('buscadorProductos');
      if (inputCatalogo) inputCatalogo.value = valor;
      document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' });
      renderizarCatalogo();
    });
  });

  // si llegamos desde otra página con ?buscar=..., precargamos el filtro
  const params = new URLSearchParams(window.location.search);
  const buscarInicial = params.get('buscar');
  if (buscarInicial && document.getElementById('gridProductos')) {
    filtrosCatalogo.texto = buscarInicial.toLowerCase();
    const inputCatalogo = document.getElementById('buscadorProductos');
    if (inputCatalogo) inputCatalogo.value = buscarInicial;
    await renderizarCatalogo();
  }

  document.getElementById('modalCerrar')?.addEventListener('click', cerrarModalProducto);
  document.getElementById('modalOverlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'modalOverlay') cerrarModalProducto();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') cerrarModalProducto();
  });

  document.getElementById('btnVerOfertas')?.addEventListener('click', (e) => {
    e.preventDefault();
    filtrosCatalogo.orden = 'ofertas';
    const selectOrden = document.getElementById('ordenProductos');
    if (selectOrden) selectOrden.value = 'ofertas';
    document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' });
    renderizarCatalogo();
  });
}

/* ------------------------- chips de categoría (catálogo) ------------------------- */

function renderizarChipsCategoria() {
  const cont = document.getElementById('chipsCategoria');
  if (!cont) return;

  if (cacheRubros.length === 0) {
    cont.innerHTML = '';
    return;
  }

  const chipTodos = `<button type="button" class="chip-filtro activo" data-chip="todos">Todos</button>`;
  const chipsRubros = cacheRubros.map(r =>
    `<button type="button" class="chip-filtro" data-chip="${r.id}">${r.nombre}</button>`
  ).join('');

  cont.innerHTML = chipTodos + chipsRubros;

  cont.querySelectorAll('[data-chip]').forEach(btn => {
    btn.addEventListener('click', () => {
      filtrosCatalogo.rubroId = btn.dataset.chip;
      const selectRubro = document.getElementById('filtroRubro');
      if (selectRubro) selectRubro.value = btn.dataset.chip;
      actualizarChipsActivos();
      renderizarCatalogo();
    });
  });
}

function actualizarChipsActivos() {
  document.querySelectorAll('#chipsCategoria [data-chip]').forEach(btn => {
    btn.classList.toggle('activo', btn.dataset.chip === String(filtrosCatalogo.rubroId));
  });
}

function poblarFiltroRubros() {
  const select = document.getElementById('filtroRubro');
  if (!select) return;
  select.innerHTML = '<option value="todos">Todas las categorías</option>' +
    cacheRubros.map(r => `<option value="${r.id}">${r.nombre}</option>`).join('');
}

function poblarFiltroMarcas() {
  const select = document.getElementById('filtroMarca');
  if (!select) return;
  select.innerHTML = '<option value="todas">Todas las marcas</option>' +
    cacheMarcas.map(m => `<option value="${m.id}">${m.nombre}</option>`).join('');
}

/* ------------------------- catálogo completo ------------------------- */

function obtenerProductosFiltrados() {
  let productos = [...cacheProductos];

  if (filtrosCatalogo.texto) {
    const t = filtrosCatalogo.texto;
    productos = productos.filter(p => {
      const nombresCategorias = (p.categorias || [p.rubro_id])
        .map(id => cacheRubros.find(r => r.id === id)?.nombre || '')
        .join(' ');
      const marca = cacheMarcas.find(m => m.id === p.marca_id);
      const bolsaTexto = [p.nombre, p.descripcion, nombresCategorias, marca?.nombre].join(' ').toLowerCase();
      return bolsaTexto.includes(t);
    });
  }
  if (filtrosCatalogo.rubroId !== 'todos') {
    const idBuscado = Number(filtrosCatalogo.rubroId);
    productos = productos.filter(p => (p.categorias || [p.rubro_id]).includes(idBuscado));
  }
  if (filtrosCatalogo.marcaId !== 'todas') {
    productos = productos.filter(p => p.marca_id === Number(filtrosCatalogo.marcaId));
  }

  switch (filtrosCatalogo.orden) {
    case 'precio-asc': productos.sort((a, b) => (a.precio ?? Infinity) - (b.precio ?? Infinity)); break;
    case 'precio-desc': productos.sort((a, b) => (b.precio ?? -Infinity) - (a.precio ?? -Infinity)); break;
    case 'nombre-asc': productos.sort((a, b) => a.nombre.localeCompare(b.nombre)); break;
    case 'nombre-desc': productos.sort((a, b) => b.nombre.localeCompare(a.nombre)); break;
    case 'ofertas': productos.sort((a, b) => SirinGoDB.calcularDescuento(b) - SirinGoDB.calcularDescuento(a)); break;
    default: break;
  }

  return productos;
}

async function renderizarCatalogo() {
  const grid = document.getElementById('gridProductos');
  const contador = document.getElementById('contadorResultados');
  const vacio = document.getElementById('catalogoVacio');
  if (!grid) return;

  const productos = obtenerProductosFiltrados();

  contador.textContent = `${productos.length} producto${productos.length === 1 ? '' : 's'} encontrado${productos.length === 1 ? '' : 's'}`;

  if (productos.length === 0) {
    grid.innerHTML = '';
    vacio.hidden = false;
    return;
  }
  vacio.hidden = true;

  grid.innerHTML = productos.map(p => tarjetaProductoHTML(p)).join('');
  activarInteraccionesTarjetas(grid);
}

/* ------------------------- tarjeta de producto (HTML) ------------------------- */

function tarjetaProductoHTML(p) {
  const nombresCategorias = (p.categorias || [p.rubro_id])
    .map(id => cacheRubros.find(r => r.id === id))
    .filter(Boolean);
  const urlImagen = SirinGoDB.obtenerUrlImagen(p.imagen);
  const descuento = SirinGoDB.calcularDescuento(p);

  const bloqueImagen = urlImagen
    ? `<div class="tarjeta-producto-imagen"><img src="${urlImagen}" alt="${escaparHTML(p.nombre)}" loading="lazy" onerror="this.parentElement.textContent='🛍️'"></div>`
    : `<div class="tarjeta-producto-imagen">🛍️</div>`;

  // Etiquetas llamativas de la esquina: 2x1 tiene prioridad visual sobre
  // el descuento por precio si un producto tuviera las dos cosas a la vez.
  const etiquetaEsquina = p.es_2x1
    ? `<span class="etiqueta-2x1">🔥 2X1</span>`
    : (descuento > 0 ? `<span class="etiqueta-oferta">Oferta</span><span class="etiqueta-descuento">-${descuento}%</span>` : '');

  const chipsCategorias = nombresCategorias.length > 0
    ? nombresCategorias.map(r => `<span class="chip">${escaparHTML(r.nombre)}</span>`).join('')
    : `<span class="chip">Sin categoría</span>`;

  return `
    <article class="tarjeta-producto">
      ${etiquetaEsquina}
      <a href="producto.html?id=${p.id}" class="tarjeta-producto-enlace">${bloqueImagen}</a>
      <div class="tarjeta-producto-body">
        <div class="tarjeta-producto-chips">${chipsCategorias}</div>
        <a href="producto.html?id=${p.id}" class="tarjeta-producto-enlace"><h3>${escaparHTML(p.nombre)}</h3></a>
        <p class="tarjeta-producto-desc">${recortarTexto(p.descripcion, 70)}</p>
        <div class="tarjeta-producto-footer">
          <a href="producto.html?id=${p.id}#detalleOpciones" class="btn btn-primary btn-sm btn-block">Seleccionar Opciones</a>
        </div>
      </div>
    </article>`;
}

function activarInteraccionesTarjetas(contenedor) {
  contenedor.querySelectorAll('[data-agregar-carrito]').forEach(btn => {
    btn.addEventListener('click', () => agregarProductoAlCarrito(btn.dataset.agregarCarrito, 1));
  });
}

function agregarProductoAlCarrito(id, cantidad) {
  const producto = cacheProductos.find(p => String(p.id) === String(id));
  if (!producto) return;
  Carrito.agregar({
    id: producto.id,
    nombre: producto.nombre,
    precio: producto.precio,
    imagenUrl: SirinGoDB.obtenerUrlImagen(producto.imagen)
  }, cantidad);
}

function recortarTexto(texto, max) {
  if (!texto) return '';
  return texto.length > max ? texto.slice(0, max).trim() + '…' : texto;
}

/* ------------------------- modal de detalle ------------------------- */

let cantidadModal = 1;

async function abrirModalProducto(id) {
  const producto = cacheProductos.find(p => String(p.id) === String(id)) || await SirinGoDB.getProductoPorId(id);
  if (!producto) return;
  const rubro = cacheRubros.find(r => r.id === producto.rubro_id);
  const marca = cacheMarcas.find(m => m.id === producto.marca_id);
  const descuento = SirinGoDB.calcularDescuento(producto);
  cantidadModal = 1;

  const urlImagen = SirinGoDB.obtenerUrlImagen(producto.imagen);
  const contenedorImagen = document.getElementById('modalImagen');
  if (urlImagen) {
    contenedorImagen.innerHTML = `<img src="${urlImagen}" alt="${escaparHTML(producto.nombre)}" onerror="this.parentElement.textContent='🛍️'">`;
  } else {
    contenedorImagen.textContent = '🛍️';
  }
  document.getElementById('modalNombre').textContent = producto.nombre;
  document.getElementById('modalRubro').textContent = rubro ? rubro.nombre : 'Sin categoría';
  document.getElementById('modalMarca').textContent = marca ? marca.nombre : 'Sin marca';
  document.getElementById('modalDescripcion').textContent = producto.descripcion;

  const precioEl = document.getElementById('modalPrecio');
  precioEl.innerHTML = descuento > 0
    ? `${SirinGoDB.formatearPrecio(producto.precio)} <span class="precio-anterior" style="font-size:1rem; margin-left:8px;">${SirinGoDB.formatearPrecio(producto.precio_anterior)}</span>`
    : SirinGoDB.formatearPrecio(producto.precio);

  document.getElementById('modalCantidadValor').textContent = cantidadModal;

  const btnSumar = document.getElementById('modalSumarCantidad');
  const btnRestar = document.getElementById('modalRestarCantidad');
  const btnAgregar = document.getElementById('modalAgregarCarrito');

  btnSumar.onclick = () => { cantidadModal++; document.getElementById('modalCantidadValor').textContent = cantidadModal; };
  btnRestar.onclick = () => { if (cantidadModal > 1) cantidadModal--; document.getElementById('modalCantidadValor').textContent = cantidadModal; };
  btnAgregar.onclick = () => { agregarProductoAlCarrito(producto.id, cantidadModal); cerrarModalProducto(); };

  const overlay = document.getElementById('modalOverlay');
  overlay.hidden = false;
  document.body.style.overflow = 'hidden';
}

function cerrarModalProducto() {
  const overlay = document.getElementById('modalOverlay');
  if (overlay) overlay.hidden = true;
  document.body.style.overflow = '';
}

/* ------------------------- formulario de contacto ------------------------- */

function inicializarFormularioContacto() {
  const form = document.getElementById('formContacto');
  if (!form) return;
  const mensaje = document.getElementById('mensajeContacto');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    ocultarMensaje(mensaje);

    const nombre = form.elements.nombre.value.trim();
    const email = form.elements.email.value.trim();
    const asunto = form.elements.asunto.value.trim();
    const cuerpo = form.elements.mensaje.value.trim();

    if (!nombre || !email || !asunto || !cuerpo) {
      mostrarMensaje(mensaje, 'Completá todos los campos para enviar tu consulta.');
      return;
    }
    if (!REGEX_EMAIL.test(email)) {
      mostrarMensaje(mensaje, 'Ingresá un email válido.');
      return;
    }

    const botonSubmit = form.querySelector('button[type="submit"]');
    botonSubmit.disabled = true;

    const resultado = await SirinGoDB.crearConsulta({ nombre, email, asunto, mensaje: cuerpo });

    botonSubmit.disabled = false;

    if (!resultado.ok) {
      mostrarMensaje(mensaje, resultado.motivo);
      return;
    }

    mostrarMensaje(mensaje, `¡Gracias ${nombre}! Recibimos tu consulta y te responderemos a la brevedad.`, 'exito');
    form.reset();
  });
}

/* ------------------------- carrusel "Quienes ya confiaron en nosotros" ------------------------- */

async function inicializarCarruselClientes() {
  const seccion = document.getElementById('clientesSatisfechos');
  const track = document.getElementById('cintaClientesTrack');
  if (!seccion || !track) return;

  const fotos = await SirinGoDB.getFotosClientes();
  if (fotos.length === 0) return; // sin fotos cargadas: la sección queda oculta

  // Igual que la cinta de anuncios del header: repetimos las fotos las
  // veces que haga falta para llenar un bloque más ancho que la
  // pantalla, y duplicamos ese bloque para que el loop sea continuo.
  const vecesPorBloque = Math.max(2, Math.ceil((window.innerWidth * 1.5) / (fotos.length * 260)));
  const bloqueHTML = Array.from({ length: vecesPorBloque })
    .flatMap(() => fotos)
    .map(f => `<div class="cinta-clientes-item"><img src="${f.url}" alt="Cliente satisfecho de SirinGo" loading="lazy"></div>`)
    .join('');

  track.innerHTML = bloqueHTML + bloqueHTML;
  seccion.hidden = false;
}

document.addEventListener('DOMContentLoaded', () => {
  inicializarTienda();
  inicializarFormularioContacto();
  inicializarCarruselClientes();
});
