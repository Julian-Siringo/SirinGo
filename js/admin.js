/* ============================================================
   admin.js
   ------------------------------------------------------------
   Lógica exclusiva del panel de administración: dashboard,
   gestión de productos, rubros, marcas y listado de usuarios.
   Protegido por rol (solo accesible para rol === 'admin'),
   validado tanto acá como por las políticas RLS en Supabase.
   ============================================================ */

let productoEnEdicion = null;
let coloresProductoActual = [];
let rubroEnEdicion = null;
let marcaEnEdicion = null;

document.addEventListener('DOMContentLoaded', async () => {
  const sesion = await protegerRutaAdmin();
  if (!sesion) return; // ya fue redirigido a login.html

  await actualizarHeader();

  inicializarNavegacionAdmin();
  await renderizarDashboard();
  await renderizarTablaProductos();
  await renderizarTablaRubros();
  await renderizarTablaMarcas();
  await renderizarTablaUsuarios();
  await renderizarTablaConsultas();

  inicializarFormularioProducto();
  inicializarFormularioRubro();
  inicializarFormularioMarca();
  inicializarGaleriaProducto();
  inicializarVideosProducto();
  inicializarOpcionesProducto();
  inicializarFotosClientes();
  await renderizarFotosClientesAdmin();
  await renderizarTablaPedidos();
});

/* ------------------------- navegación entre secciones ------------------------- */

function inicializarNavegacionAdmin() {
  const links = document.querySelectorAll('[data-seccion]');
  links.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const destino = link.dataset.seccion;
      document.querySelectorAll('.admin-seccion').forEach(sec => sec.classList.remove('activa'));
      document.getElementById(`seccion-${destino}`).classList.add('activa');
      links.forEach(l => l.classList.remove('activo'));
      link.classList.add('activo');
      document.querySelector('.admin-sidebar')?.classList.remove('abierta');
      if (destino === 'dashboard') renderizarDashboard();
      if (destino === 'consultas') renderizarTablaConsultas();
      if (destino === 'clientes') renderizarFotosClientesAdmin();
      if (destino === 'pedidos') renderizarTablaPedidos();
    });
  });

  const toggleSidebar = document.getElementById('toggleSidebar');
  if (toggleSidebar) {
    toggleSidebar.addEventListener('click', () => {
      document.querySelector('.admin-sidebar').classList.toggle('abierta');
    });
  }
}

/* ------------------------- dashboard ------------------------- */

async function renderizarDashboard() {
  const [productos, rubros, marcas, usuarios, stockTotal] = await Promise.all([
    SirinGoDB.getProductos(),
    SirinGoDB.getRubros(),
    SirinGoDB.getMarcas(),
    SirinGoDB.getUsuarios(),
    SirinGoDB.getStockTotal()
  ]);

  document.getElementById('statProductos').textContent = productos.length;
  document.getElementById('statRubros').textContent = rubros.length;
  document.getElementById('statMarcas').textContent = marcas.length;
  document.getElementById('statUsuarios').textContent = usuarios.length;

  const elStockTotal = document.getElementById('statStockTotal');
  if (elStockTotal) elStockTotal.textContent = stockTotal;
}

/* ------------------------- helpers de selects ------------------------- */

async function poblarSelectsFormularioProducto() {
  const contCategorias = document.getElementById('inputProductoCategorias');
  const selMarca = document.getElementById('inputProductoMarca');
  const [rubros, marcas] = await Promise.all([SirinGoDB.getRubros(), SirinGoDB.getMarcas()]);

  contCategorias.innerHTML = rubros.map(r => `
    <label class="tag-checkbox">
      <input type="checkbox" value="${r.id}">
      <span>${escaparHTML(r.nombre)}</span>
    </label>
  `).join('');
  selMarca.innerHTML = marcas.map(m => `<option value="${m.id}">${m.nombre}</option>`).join('');
}

/* ------------------------- GESTIÓN DE PRODUCTOS ------------------------- */

async function renderizarTablaProductos() {
  const tbody = document.getElementById('tablaProductos');
  const [productos, rubros, marcas] = await Promise.all([
    SirinGoDB.getProductos(),
    SirinGoDB.getRubros(),
    SirinGoDB.getMarcas()
  ]);

  if (productos.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="tabla-vacia">No hay productos cargados.</td></tr>`;
    return;
  }

  tbody.innerHTML = productos.map(p => {
    const nombresCategorias = (p.categorias || [p.rubro_id])
      .map(id => rubros.find(r => r.id === id))
      .filter(Boolean)
      .map(r => `<span class="chip-tabla">${escaparHTML(r.nombre)}</span>`)
      .join(' ') || '—';
    const marca = marcas.find(m => m.id === p.marca_id);
    const urlImagen = SirinGoDB.obtenerUrlImagen(p.imagen);
    const celdaImagen = urlImagen
      ? `<span class="celda-imagen"><img src="${urlImagen}" alt="${escaparHTML(p.nombre)}" loading="lazy" onerror="this.parentElement.innerHTML='🧼'"></span>`
      : `<span class="celda-imagen">🧼</span>`;
    const celdaPrecio = p.precio
      ? SirinGoDB.formatearPrecio(p.precio)
      : `<span class="badge badge-pendiente" title="Cargale una opción de compra para que tenga precio">Falta opción</span>`;
    return `
      <tr>
        <td>${celdaImagen} ${p.nombre} ${p.es_2x1 ? '<span class="badge badge-2x1-mini">2x1</span>' : ''}</td>
        <td>${nombresCategorias}</td>
        <td>${marca ? marca.nombre : '—'}</td>
        <td>${celdaPrecio}</td>
        <td>${p.stock ?? 0}</td>
        <td class="col-acciones">
          <button class="btn-icono" title="Editar" data-editar-producto="${p.id}">✏️</button>
          <button class="btn-icono" title="Galería de imágenes" data-galeria-producto="${p.id}">🖼️</button>
          <button class="btn-icono" title="Videos del producto" data-videos-producto="${p.id}">🎬</button>
          <button class="btn-icono" title="Opciones de compra" data-opciones-producto="${p.id}">🏷️</button>
          <button class="btn-icono btn-icono-peligro" title="Eliminar" data-eliminar-producto="${p.id}">🗑️</button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('[data-editar-producto]').forEach(btn => {
    btn.addEventListener('click', () => abrirFormularioProducto(btn.dataset.editarProducto));
  });
  tbody.querySelectorAll('[data-galeria-producto]').forEach(btn => {
    btn.addEventListener('click', () => abrirGaleriaProducto(btn.dataset.galeriaProducto));
  });
  tbody.querySelectorAll('[data-videos-producto]').forEach(btn => {
    btn.addEventListener('click', () => abrirVideosProducto(btn.dataset.videosProducto));
  });
  tbody.querySelectorAll('[data-opciones-producto]').forEach(btn => {
    btn.addEventListener('click', () => abrirOpcionesProducto(btn.dataset.opcionesProducto));
  });
  tbody.querySelectorAll('[data-eliminar-producto]').forEach(btn => {
    btn.addEventListener('click', () => confirmarEliminarProducto(btn.dataset.eliminarProducto));
  });
}

function inicializarFormularioProducto() {
  const form = document.getElementById('formProducto');
  const btnNuevo = document.getElementById('btnNuevoProducto');
  const btnCancelar = document.getElementById('btnCancelarProducto');
  const modal = document.getElementById('modalProducto');
  const inputArchivo = document.getElementById('inputProductoArchivoImagen');
  const previewImg = document.getElementById('previewImagenProducto');
  const previewVacio = document.getElementById('previewImagenProductoVacio');
  const btnQuitarImagen = document.getElementById('btnQuitarImagenProducto');
  const inputImagenEliminar = document.getElementById('inputProductoImagenEliminar');

  btnNuevo.addEventListener('click', () => abrirFormularioProducto(null));
  btnCancelar.addEventListener('click', cerrarFormularioProducto);
  modal.addEventListener('click', (e) => { if (e.target.id === 'modalProducto') cerrarFormularioProducto(); });

  document.getElementById('btnAgregarColor').addEventListener('click', () => {
    const inputHex = document.getElementById('inputColorHex');
    const inputNombre = document.getElementById('inputColorNombre');
    const nombre = inputNombre.value.trim();
    if (!nombre) { inputNombre.focus(); return; }

    coloresProductoActual.push({ nombre, hex: inputHex.value });
    inputNombre.value = '';
    renderizarColoresAdmin();
  });

  // Vista previa: se actualiza apenas el administrador elige un archivo nuevo.
  inputArchivo.addEventListener('change', () => {
    const file = inputArchivo.files[0];
    if (!file) return;

    const tiposPermitidos = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const mensaje = document.getElementById('mensajeProducto');
    ocultarMensaje(mensaje);

    if (!tiposPermitidos.includes(file.type)) {
      mostrarMensaje(mensaje, 'Formato no permitido. Usá JPG, PNG o WEBP.');
      inputArchivo.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      mostrarMensaje(mensaje, 'La imagen no puede superar los 5 MB.');
      inputArchivo.value = '';
      return;
    }

    const lector = new FileReader();
    lector.onload = (e) => {
      previewImg.src = e.target.result;
      previewImg.hidden = false;
      previewVacio.hidden = true;
      btnQuitarImagen.hidden = false;
    };
    lector.readAsDataURL(file);

    // Si había una marca de "eliminar imagen" activa, la nueva selección
    // la reemplaza: ya no hay nada que borrar sin reemplazo.
    inputImagenEliminar.value = '0';
  });

  // Quita la imagen actual (ya sea la vista previa de un archivo recién
  // elegido, o la imagen que el producto ya tenía guardada).
  btnQuitarImagen.addEventListener('click', () => {
    inputArchivo.value = '';
    previewImg.hidden = true;
    previewImg.src = '';
    previewVacio.hidden = false;
    btnQuitarImagen.hidden = true;
    inputImagenEliminar.value = '1';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const mensaje = document.getElementById('mensajeProducto');
    ocultarMensaje(mensaje);

    const idsCategorias = Array.from(document.querySelectorAll('#inputProductoCategorias input[type="checkbox"]:checked'))
      .map(chk => Number(chk.value));

    if (idsCategorias.length === 0) {
      mostrarMensaje(mensaje, 'Elegí al menos una categoría.');
      return;
    }

    const datos = {
      nombre: form.elements.nombre.value.trim(),
      marca_id: Number(form.elements.marca_id.value),
      descripcion: form.elements.descripcion.value.trim(),
      stock: Number(form.elements.stock.value) || 0,
      colores: coloresProductoActual,
      es_2x1: document.getElementById('inputProductoEs2x1').checked
    };

    // La columna rubro_id sigue siendo obligatoria en la tabla (es la
    // "categoría principal"): al crear un producto nuevo hay que
    // mandarla junto con el resto; al editar uno que ya existe, se
    // actualiza aparte en actualizarCategoriasProducto().
    if (!productoEnEdicion) datos.rubro_id = idsCategorias[0];

    if (!datos.nombre || !datos.descripcion) {
      mostrarMensaje(mensaje, 'Completá todos los campos con valores válidos.');
      return;
    }

    const botonSubmit = form.querySelector('button[type="submit"]');
    botonSubmit.disabled = true;

    const archivoSeleccionado = inputArchivo.files[0] || null;
    const imagenActual = form.elements.imagenActual.value || null;
    const eliminarImagen = inputImagenEliminar.value === '1';

    // Si eligió una imagen nueva, la subimos ANTES de tocar la base de
    // datos, así si la subida falla no tocamos nada más.
    let nuevoPath = null;
    if (archivoSeleccionado) {
      const resultadoSubida = await SirinGoDB.subirImagenProducto(archivoSeleccionado);
      if (!resultadoSubida.ok) {
        botonSubmit.disabled = false;
        mostrarMensaje(mensaje, resultadoSubida.motivo);
        return;
      }
      nuevoPath = resultadoSubida.path;
      datos.imagen = nuevoPath;
    } else if (eliminarImagen) {
      datos.imagen = null;
    }

    const resultado = productoEnEdicion
      ? await SirinGoDB.actualizarProducto(productoEnEdicion, datos)
      : await SirinGoDB.crearProducto(datos);

    if (!resultado.ok) {
      // La base de datos falló: si ya habíamos subido una imagen nueva,
      // la borramos para no dejar un archivo huérfano en Storage, y el
      // producto conserva su imagen anterior (nunca queda sin imagen).
      if (nuevoPath) await SirinGoDB.eliminarImagenProducto(nuevoPath);
      botonSubmit.disabled = false;
      mostrarMensaje(mensaje, resultado.motivo);
      return;
    }

    // Todo salió bien: si había una imagen anterior y la reemplazamos o la
    // quitamos, ahora sí la borramos de Storage para no acumular archivos
    // sin uso.
    if (imagenActual && (nuevoPath || eliminarImagen)) {
      await SirinGoDB.eliminarImagenProducto(imagenActual);
    }

    const idProducto = productoEnEdicion || resultado.data.id;
    await SirinGoDB.actualizarCategoriasProducto(idProducto, idsCategorias);

    botonSubmit.disabled = false;
    await renderizarTablaProductos();
    await renderizarDashboard();
    cerrarFormularioProducto();
  });
}

function renderizarColoresAdmin() {
  const cont = document.getElementById('coloresAdminLista');
  if (coloresProductoActual.length === 0) {
    cont.innerHTML = `<p class="galeria-admin-vacio" style="padding:10px 0;">Todavía no agregaste colores.</p>`;
    return;
  }

  cont.innerHTML = coloresProductoActual.map((c, i) => `
    <span class="color-chip-admin">
      <span class="color-chip-punto" style="background:${escaparHTML(c.hex)};"></span>
      ${escaparHTML(c.nombre)}
      <button type="button" data-quitar-color="${i}" aria-label="Quitar color">✕</button>
    </span>
  `).join('');

  cont.querySelectorAll('[data-quitar-color]').forEach(btn => {
    btn.addEventListener('click', () => {
      coloresProductoActual.splice(Number(btn.dataset.quitarColor), 1);
      renderizarColoresAdmin();
    });
  });
}

async function abrirFormularioProducto(id) {
  await poblarSelectsFormularioProducto();
  const form = document.getElementById('formProducto');
  const titulo = document.getElementById('tituloModalProducto');
  const previewImg = document.getElementById('previewImagenProducto');
  const previewVacio = document.getElementById('previewImagenProductoVacio');
  const btnQuitarImagen = document.getElementById('btnQuitarImagenProducto');

  form.reset();
  document.getElementById('mensajeProducto').hidden = true;
  document.getElementById('inputProductoImagenEliminar').value = '0';
  previewImg.hidden = true;
  previewImg.src = '';
  previewVacio.hidden = false;
  btnQuitarImagen.hidden = true;
  document.getElementById('inputProductoEs2x1').checked = false;

  coloresProductoActual = [];

  if (id) {
    const producto = await SirinGoDB.getProductoPorId(id);
    productoEnEdicion = producto.id;
    titulo.textContent = 'Editar producto';
    form.elements.nombre.value = producto.nombre;
    form.elements.marca_id.value = producto.marca_id;
    form.elements.descripcion.value = producto.descripcion;
    if (form.elements.stock) form.elements.stock.value = producto.stock ?? 0;
    form.elements.imagenActual.value = producto.imagen || '';
    document.getElementById('inputProductoEs2x1').checked = !!producto.es_2x1;

    const idsCategorias = producto.categorias || [producto.rubro_id];
    document.querySelectorAll('#inputProductoCategorias input[type="checkbox"]').forEach(chk => {
      chk.checked = idsCategorias.includes(Number(chk.value));
    });

    coloresProductoActual = Array.isArray(producto.colores) ? [...producto.colores] : [];
    renderizarColoresAdmin();

    const urlImagenActual = SirinGoDB.obtenerUrlImagen(producto.imagen);
    if (urlImagenActual) {
      previewImg.src = urlImagenActual;
      previewImg.hidden = false;
      previewVacio.hidden = true;
      btnQuitarImagen.hidden = false;
    }
  } else {
    productoEnEdicion = null;
    titulo.textContent = 'Agregar producto';
    form.elements.imagenActual.value = '';
    renderizarColoresAdmin();
  }

  document.getElementById('modalProducto').hidden = false;
}

function cerrarFormularioProducto() {
  document.getElementById('modalProducto').hidden = true;
  productoEnEdicion = null;
}

/* ------------------------- GALERÍA DE IMÁGENES ------------------------- */

let galeriaProductoActual = null;

function inicializarGaleriaProducto() {
  const modal = document.getElementById('modalGaleria');
  const inputArchivo = document.getElementById('inputGaleriaArchivo');

  document.getElementById('btnCerrarGaleria').addEventListener('click', () => { modal.hidden = true; });
  modal.addEventListener('click', (e) => { if (e.target.id === 'modalGaleria') modal.hidden = true; });

  inputArchivo.addEventListener('change', async () => {
    const file = inputArchivo.files[0];
    if (!file || !galeriaProductoActual) return;
    const mensaje = document.getElementById('mensajeGaleria');
    ocultarMensaje(mensaje);

    inputArchivo.disabled = true;
    const resultado = await SirinGoDB.agregarImagenGaleria(galeriaProductoActual, file);
    inputArchivo.disabled = false;
    inputArchivo.value = '';

    if (!resultado.ok) { mostrarMensaje(mensaje, resultado.motivo); return; }
    await renderizarGaleriaAdmin();
    await renderizarTablaProductos();
  });
}

async function abrirGaleriaProducto(productoId) {
  galeriaProductoActual = productoId;
  document.getElementById('mensajeGaleria').hidden = true;
  document.getElementById('inputGaleriaArchivo').value = '';
  await renderizarGaleriaAdmin();
  document.getElementById('modalGaleria').hidden = false;
}

async function renderizarGaleriaAdmin() {
  const producto = await SirinGoDB.getProductoPorId(galeriaProductoActual);
  const grid = document.getElementById('galeriaAdminGrid');
  const imagenes = producto?.imagenes || [];

  if (imagenes.length === 0) {
    grid.innerHTML = `<p class="galeria-admin-vacio">Todavía no agregaste imágenes a la galería.</p>`;
    return;
  }

  grid.innerHTML = imagenes.map(path => `
    <div class="galeria-admin-item">
      <img src="${SirinGoDB.obtenerUrlImagen(path)}" alt="Imagen de galería">
      <button type="button" class="galeria-admin-quitar" data-quitar-imagen="${escaparHTML(path)}" title="Quitar">✕</button>
    </div>
  `).join('');

  grid.querySelectorAll('[data-quitar-imagen]').forEach(btn => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      await SirinGoDB.quitarImagenGaleria(galeriaProductoActual, btn.dataset.quitarImagen);
      await renderizarGaleriaAdmin();
    });
  });
}

/* ------------------------- VIDEOS DEL PRODUCTO ------------------------- */

let videosProductoActual = null;

function inicializarVideosProducto() {
  const modal = document.getElementById('modalVideos');
  const inputArchivo = document.getElementById('inputVideoArchivo');

  document.getElementById('btnCerrarVideos').addEventListener('click', () => { modal.hidden = true; });
  modal.addEventListener('click', (e) => { if (e.target.id === 'modalVideos') modal.hidden = true; });

  inputArchivo.addEventListener('change', async () => {
    const file = inputArchivo.files[0];
    if (!file || !videosProductoActual) return;
    const mensaje = document.getElementById('mensajeVideos');
    ocultarMensaje(mensaje);

    inputArchivo.disabled = true;
    const resultado = await SirinGoDB.agregarVideoGaleria(videosProductoActual, file);
    inputArchivo.disabled = false;
    inputArchivo.value = '';

    if (!resultado.ok) { mostrarMensaje(mensaje, resultado.motivo); return; }
    await renderizarVideosAdmin();
  });
}

async function abrirVideosProducto(productoId) {
  videosProductoActual = productoId;
  document.getElementById('mensajeVideos').hidden = true;
  document.getElementById('inputVideoArchivo').value = '';
  await renderizarVideosAdmin();
  document.getElementById('modalVideos').hidden = false;
}

async function renderizarVideosAdmin() {
  const producto = await SirinGoDB.getProductoPorId(videosProductoActual);
  const grid = document.getElementById('videosAdminGrid');
  const videos = producto?.videos || [];

  if (videos.length === 0) {
    grid.innerHTML = `<p class="galeria-admin-vacio">Todavía no agregaste videos a este producto.</p>`;
    return;
  }

  grid.innerHTML = videos.map(path => `
    <div class="galeria-admin-item">
      <video src="${SirinGoDB.obtenerUrlVideo(path)}" controls preload="metadata"></video>
      <button type="button" class="galeria-admin-quitar" data-quitar-video="${escaparHTML(path)}" title="Quitar">✕</button>
    </div>
  `).join('');

  grid.querySelectorAll('[data-quitar-video]').forEach(btn => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      await SirinGoDB.quitarVideoGaleria(videosProductoActual, btn.dataset.quitarVideo);
      await renderizarVideosAdmin();
    });
  });
}

/* ------------------------- OPCIONES DE COMPRA ------------------------- */

let productoOpcionesActual = null;
let opcionEnEdicion = null;

function inicializarOpcionesProducto() {
  const modal = document.getElementById('modalOpciones');
  const form = document.getElementById('formOpcion');

  document.getElementById('btnCerrarOpciones').addEventListener('click', () => { modal.hidden = true; });
  modal.addEventListener('click', (e) => { if (e.target.id === 'modalOpciones') modal.hidden = true; });

  document.getElementById('btnNuevaOpcion').addEventListener('click', () => abrirFormularioOpcion(null));
  document.getElementById('btnCancelarOpcion').addEventListener('click', cerrarFormularioOpcion);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const mensaje = document.getElementById('mensajeOpciones');
    ocultarMensaje(mensaje);

    const precioAnteriorValor = document.getElementById('inputOpcionPrecioAnterior').value.trim();
    const datos = {
      producto_id: Number(productoOpcionesActual),
      titulo: document.getElementById('inputOpcionTitulo').value.trim(),
      subtitulo: document.getElementById('inputOpcionSubtitulo').value.trim(),
      etiqueta: document.getElementById('inputOpcionEtiqueta').value.trim() || null,
      precio: Number(document.getElementById('inputOpcionPrecio').value),
      precio_anterior: precioAnteriorValor ? Number(precioAnteriorValor) : null,
      destacada: document.getElementById('inputOpcionDestacada').checked
    };

    if (!datos.titulo || !datos.precio || datos.precio <= 0) {
      mostrarMensaje(mensaje, 'Completá el título y un precio válido.');
      return;
    }
    if (datos.precio_anterior && datos.precio_anterior <= datos.precio) {
      mostrarMensaje(mensaje, 'El precio anterior tiene que ser mayor que el precio actual.');
      return;
    }

    const resultado = opcionEnEdicion
      ? await SirinGoDB.actualizarOpcionProducto(opcionEnEdicion, datos)
      : await SirinGoDB.crearOpcionProducto(datos);

    if (!resultado.ok) { mostrarMensaje(mensaje, resultado.motivo); return; }

    cerrarFormularioOpcion();
    await renderizarListaOpcionesAdmin();
  });
}

async function abrirOpcionesProducto(productoId) {
  productoOpcionesActual = productoId;
  document.getElementById('mensajeOpciones').hidden = true;
  cerrarFormularioOpcion();
  await renderizarListaOpcionesAdmin();
  document.getElementById('modalOpciones').hidden = false;
}

async function renderizarListaOpcionesAdmin() {
  const opciones = await SirinGoDB.getOpcionesProducto(productoOpcionesActual);
  const cont = document.getElementById('listaOpcionesAdmin');

  if (opciones.length === 0) {
    cont.innerHTML = `<p class="galeria-admin-vacio">Todavía no cargaste opciones de compra. Mientras tanto, la página del producto muestra una única opción con el precio de lista.</p>`;
    return;
  }

  cont.innerHTML = opciones.map(o => `
    <div class="opcion-admin-fila">
      <div>
        <strong>${escaparHTML(o.titulo)} ${o.destacada ? '⭐' : ''}</strong>
        <span>${o.subtitulo ? escaparHTML(o.subtitulo) : ''} ${o.etiqueta ? `· ${escaparHTML(o.etiqueta)}` : ''}</span>
      </div>
      <div style="display:flex; align-items:center;">
        <span class="opcion-admin-precio">${SirinGoDB.formatearPrecio(o.precio)}</span>
        <button type="button" class="btn-icono" title="Editar" data-editar-opcion="${o.id}">✏️</button>
        <button type="button" class="btn-icono btn-icono-peligro" title="Eliminar" data-eliminar-opcion="${o.id}">🗑️</button>
      </div>
    </div>
  `).join('');

  cont.querySelectorAll('[data-editar-opcion]').forEach(btn => {
    btn.addEventListener('click', () => abrirFormularioOpcion(btn.dataset.editarOpcion, opciones));
  });
  cont.querySelectorAll('[data-eliminar-opcion]').forEach(btn => {
    btn.addEventListener('click', () => {
      abrirConfirmacion('¿Eliminar esta opción de compra?', async () => {
        await SirinGoDB.eliminarOpcionProducto(btn.dataset.eliminarOpcion);
        await renderizarListaOpcionesAdmin();
      });
    });
  });
}

function abrirFormularioOpcion(id, opcionesCache) {
  const form = document.getElementById('formOpcion');
  form.reset();
  opcionEnEdicion = id || null;

  if (id) {
    const opcion = (opcionesCache || []).find(o => String(o.id) === String(id));
    if (opcion) {
      document.getElementById('inputOpcionTitulo').value = opcion.titulo;
      document.getElementById('inputOpcionSubtitulo').value = opcion.subtitulo || '';
      document.getElementById('inputOpcionEtiqueta').value = opcion.etiqueta || '';
      document.getElementById('inputOpcionPrecio').value = opcion.precio;
      document.getElementById('inputOpcionPrecioAnterior').value = opcion.precio_anterior || '';
      document.getElementById('inputOpcionDestacada').checked = !!opcion.destacada;
    }
  }

  form.hidden = false;
  document.getElementById('accionesCerrarOpciones').hidden = true;
}

function cerrarFormularioOpcion() {
  document.getElementById('formOpcion').hidden = true;
  document.getElementById('accionesCerrarOpciones').hidden = false;
  opcionEnEdicion = null;
}

function confirmarEliminarProducto(id) {
  abrirConfirmacion(
    `¿Estás seguro de que querés eliminar este producto? Esta acción no se puede deshacer.`,
    async () => {
      const resultado = await SirinGoDB.eliminarProducto(id);
      if (!resultado.ok) {
        alert(resultado.motivo);
        return;
      }
      await renderizarTablaProductos();
      await renderizarDashboard();
    }
  );
}

/* ------------------------- GESTIÓN DE RUBROS ------------------------- */

async function renderizarTablaRubros() {
  const tbody = document.getElementById('tablaRubros');
  const [rubros, productos] = await Promise.all([SirinGoDB.getRubros(), SirinGoDB.getProductos()]);

  tbody.innerHTML = rubros.map(r => {
    const cantidad = productos.filter(p => (p.categorias || [p.rubro_id]).includes(r.id)).length;
    return `
      <tr>
        <td>${r.nombre}</td>
        <td>${cantidad} producto${cantidad === 1 ? '' : 's'}</td>
        <td class="col-acciones">
          <button class="btn-icono" title="Editar" data-editar-rubro="${r.id}">✏️</button>
          <button class="btn-icono btn-icono-peligro" title="Eliminar" data-eliminar-rubro="${r.id}">🗑️</button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('[data-editar-rubro]').forEach(btn => {
    btn.addEventListener('click', () => abrirFormularioRubro(btn.dataset.editarRubro));
  });
  tbody.querySelectorAll('[data-eliminar-rubro]').forEach(btn => {
    btn.addEventListener('click', () => eliminarRubroConValidacion(btn.dataset.eliminarRubro));
  });
}

function inicializarFormularioRubro() {
  const form = document.getElementById('formRubro');
  document.getElementById('btnNuevoRubro').addEventListener('click', () => abrirFormularioRubro(null));
  document.getElementById('btnCancelarRubro').addEventListener('click', cerrarFormularioRubro);
  document.getElementById('modalRubro').addEventListener('click', (e) => { if (e.target.id === 'modalRubro') cerrarFormularioRubro(); });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const mensaje = document.getElementById('mensajeRubro');
    ocultarMensaje(mensaje);
    const nombre = form.elements.nombre.value.trim();

    if (!nombre) {
      mostrarMensaje(mensaje, 'Ingresá un nombre para el rubro.');
      return;
    }

    const botonSubmit = form.querySelector('button[type="submit"]');
    botonSubmit.disabled = true;

    const resultado = rubroEnEdicion
      ? await SirinGoDB.actualizarRubro(rubroEnEdicion, nombre)
      : await SirinGoDB.crearRubro(nombre);

    botonSubmit.disabled = false;

    if (!resultado.ok) {
      mostrarMensaje(mensaje, resultado.motivo);
      return;
    }

    await renderizarTablaRubros();
    await renderizarDashboard();
    await poblarFiltroRubrosSiExiste();
    cerrarFormularioRubro();
  });
}

async function abrirFormularioRubro(id) {
  const form = document.getElementById('formRubro');
  form.reset();
  document.getElementById('mensajeRubro').hidden = true;

  if (id) {
    const rubro = await SirinGoDB.getRubroPorId(id);
    rubroEnEdicion = rubro.id;
    document.getElementById('tituloModalRubro').textContent = 'Editar rubro';
    form.elements.nombre.value = rubro.nombre;
  } else {
    rubroEnEdicion = null;
    document.getElementById('tituloModalRubro').textContent = 'Nuevo rubro';
  }
  document.getElementById('modalRubro').hidden = false;
}

function cerrarFormularioRubro() {
  document.getElementById('modalRubro').hidden = true;
  rubroEnEdicion = null;
}

function eliminarRubroConValidacion(id) {
  abrirConfirmacion(
    `¿Estás seguro de que querés eliminar este rubro?`,
    async () => {
      const resultado = await SirinGoDB.eliminarRubro(id);
      if (!resultado.ok) {
        alert(resultado.motivo + ' Reasigná o eliminá esos productos primero.');
        return;
      }
      await renderizarTablaRubros();
      await renderizarDashboard();
    }
  );
}

async function poblarFiltroRubrosSiExiste() {
  if (document.getElementById('filtroRubro') && typeof poblarFiltroRubros === 'function') {
    // Solo aplica si admin.js se cargó en una página que también tiene el catálogo.
    cacheRubros = await SirinGoDB.getRubros();
    poblarFiltroRubros();
  }
}

/* ------------------------- GESTIÓN DE MARCAS ------------------------- */

async function renderizarTablaMarcas() {
  const tbody = document.getElementById('tablaMarcas');
  const [marcas, productos] = await Promise.all([SirinGoDB.getMarcas(), SirinGoDB.getProductos()]);

  tbody.innerHTML = marcas.map(m => {
    const cantidad = productos.filter(p => p.marca_id === m.id).length;
    return `
      <tr>
        <td>${m.nombre}</td>
        <td>${cantidad} producto${cantidad === 1 ? '' : 's'}</td>
        <td class="col-acciones">
          <button class="btn-icono" title="Editar" data-editar-marca="${m.id}">✏️</button>
          <button class="btn-icono btn-icono-peligro" title="Eliminar" data-eliminar-marca="${m.id}">🗑️</button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('[data-editar-marca]').forEach(btn => {
    btn.addEventListener('click', () => abrirFormularioMarca(btn.dataset.editarMarca));
  });
  tbody.querySelectorAll('[data-eliminar-marca]').forEach(btn => {
    btn.addEventListener('click', () => eliminarMarcaConValidacion(btn.dataset.eliminarMarca));
  });
}

function inicializarFormularioMarca() {
  const form = document.getElementById('formMarca');
  document.getElementById('btnNuevaMarca').addEventListener('click', () => abrirFormularioMarca(null));
  document.getElementById('btnCancelarMarca').addEventListener('click', cerrarFormularioMarca);
  document.getElementById('modalMarca').addEventListener('click', (e) => { if (e.target.id === 'modalMarca') cerrarFormularioMarca(); });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const mensaje = document.getElementById('mensajeMarca');
    ocultarMensaje(mensaje);
    const nombre = form.elements.nombre.value.trim();

    if (!nombre) {
      mostrarMensaje(mensaje, 'Ingresá un nombre para la marca.');
      return;
    }

    const botonSubmit = form.querySelector('button[type="submit"]');
    botonSubmit.disabled = true;

    const resultado = marcaEnEdicion
      ? await SirinGoDB.actualizarMarca(marcaEnEdicion, nombre)
      : await SirinGoDB.crearMarca(nombre);

    botonSubmit.disabled = false;

    if (!resultado.ok) {
      mostrarMensaje(mensaje, resultado.motivo);
      return;
    }

    await renderizarTablaMarcas();
    await renderizarDashboard();
    await poblarFiltroMarcasSiExiste();
    cerrarFormularioMarca();
  });
}

async function abrirFormularioMarca(id) {
  const form = document.getElementById('formMarca');
  form.reset();
  document.getElementById('mensajeMarca').hidden = true;

  if (id) {
    const marca = await SirinGoDB.getMarcaPorId(id);
    marcaEnEdicion = marca.id;
    document.getElementById('tituloModalMarca').textContent = 'Editar marca';
    form.elements.nombre.value = marca.nombre;
  } else {
    marcaEnEdicion = null;
    document.getElementById('tituloModalMarca').textContent = 'Nueva marca';
  }
  document.getElementById('modalMarca').hidden = false;
}

function cerrarFormularioMarca() {
  document.getElementById('modalMarca').hidden = true;
  marcaEnEdicion = null;
}

function eliminarMarcaConValidacion(id) {
  abrirConfirmacion(
    `¿Estás seguro de que querés eliminar esta marca?`,
    async () => {
      const resultado = await SirinGoDB.eliminarMarca(id);
      if (!resultado.ok) {
        alert(resultado.motivo + ' Reasigná o eliminá esos productos primero.');
        return;
      }
      await renderizarTablaMarcas();
      await renderizarDashboard();
    }
  );
}

async function poblarFiltroMarcasSiExiste() {
  if (document.getElementById('filtroMarca') && typeof poblarFiltroMarcas === 'function') {
    cacheMarcas = await SirinGoDB.getMarcas();
    poblarFiltroMarcas();
  }
}

/* ------------------------- USUARIOS (solo lectura) ------------------------- */

async function renderizarTablaUsuarios() {
  const tbody = document.getElementById('tablaUsuarios');
  const usuarios = await SirinGoDB.getUsuarios();

  tbody.innerHTML = usuarios.map(u => `
    <tr>
      <td>${u.nombre} ${u.apellido}</td>
      <td>${u.email}</td>
      <td><span class="badge ${u.rol === 'admin' ? 'badge-admin' : 'badge-usuario'}">${u.rol === 'admin' ? 'Administrador' : 'Usuario'}</span></td>
    </tr>
  `).join('');
}

/* ------------------------- CONSULTAS (formulario de contacto) ------------------------- */

async function renderizarTablaConsultas() {
  const tbody = document.getElementById('tablaConsultas');
  const consultas = await SirinGoDB.getConsultas();

  const pendientes = consultas.filter(c => c.estado === 'pendiente').length;
  const badge = document.getElementById('badgeConsultasPendientes');
  if (badge) {
    badge.textContent = pendientes;
    badge.hidden = pendientes === 0;
  }

  if (consultas.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="tabla-vacia">Todavía no llegaron consultas.</td></tr>`;
    return;
  }

  tbody.innerHTML = consultas.map(c => {
    const fecha = new Date(c.fecha_creacion).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const esVisto = c.estado === 'visto';
    return `
      <tr>
        <td>${fecha}</td>
        <td>${escaparHTML(c.nombre)}</td>
        <td>${escaparHTML(c.email)}</td>
        <td>${escaparHTML(c.asunto)}</td>
        <td class="celda-mensaje-consulta">${escaparHTML(c.mensaje)}</td>
        <td><span class="badge ${esVisto ? 'badge-visto' : 'badge-pendiente'}">${esVisto ? 'Visto' : 'Pendiente'}</span></td>
        <td>
          <button class="btn-toggle-estado" data-toggle-consulta="${c.id}" data-estado-actual="${c.estado}">
            ${esVisto ? 'Marcar pendiente' : 'Marcar como visto'}
          </button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('[data-toggle-consulta]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.toggleConsulta;
      const estadoNuevo = btn.dataset.estadoActual === 'visto' ? 'pendiente' : 'visto';
      btn.disabled = true;
      const resultado = await SirinGoDB.actualizarEstadoConsulta(id, estadoNuevo);
      if (!resultado.ok) {
        alert(resultado.motivo);
        btn.disabled = false;
        return;
      }
      await renderizarTablaConsultas();
    });
  });
}

/* ------------------------- PEDIDOS ------------------------- */

async function renderizarTablaPedidos() {
  const tbody = document.getElementById('tablaPedidos');
  if (!tbody) return;
  const pedidos = await SirinGoDB.getPedidos();

  const pendientes = pedidos.filter(p => p.estado_pago === 'pendiente').length;
  const badge = document.getElementById('badgePedidosPendientes');
  if (badge) {
    badge.textContent = pendientes;
    badge.hidden = pendientes === 0;
  }

  if (pedidos.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="tabla-vacia">Todavía no hay pedidos.</td></tr>`;
    return;
  }

  const ETIQUETAS = {
    pendiente: { texto: 'Pendiente', clase: 'badge-pendiente' },
    pagado: { texto: 'Pagado', clase: 'badge-visto' },
    cancelado: { texto: 'Cancelado', clase: 'badge-cancelado' }
  };

  tbody.innerHTML = pedidos.map(p => {
    const fecha = new Date(p.creado_en).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const estado = ETIQUETAS[p.estado_pago] || ETIQUETAS.pendiente;
    const entrega = p.entrega === 'domicilio' ? 'Envío a domicilio' : 'Retiro en el local';
    const metodoPago = `<span class="badge badge-admin">🏦 Transferencia</span>`;

    return `
      <tr>
        <td>${fecha}</td>
        <td><strong>${escaparHTML(p.numero)}</strong></td>
        <td>${escaparHTML(p.nombre)}<br><span class="celda-secundaria">${escaparHTML(p.email)}</span></td>
        <td>${entrega}</td>
        <td>${metodoPago}</td>
        <td>${SirinGoDB.formatearPrecio(p.total)}</td>
        <td><span class="badge ${estado.clase}">${estado.texto}</span></td>
        <td class="celda-acciones-pedido">
          ${p.estado_pago !== 'pagado' ? `<button class="btn-toggle-estado" data-pedido-estado="${p.id}" data-nuevo-estado="pagado">Marcar pagado</button>` : ''}
          ${p.estado_pago !== 'cancelado' ? `<button class="btn-toggle-estado" data-pedido-estado="${p.id}" data-nuevo-estado="cancelado">Cancelar</button>` : ''}
          ${p.estado_pago !== 'pendiente' ? `<button class="btn-toggle-estado" data-pedido-estado="${p.id}" data-nuevo-estado="pendiente">Volver a pendiente</button>` : ''}
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('[data-pedido-estado]').forEach(btn => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      const resultado = await SirinGoDB.actualizarEstadoPedido(btn.dataset.pedidoEstado, btn.dataset.nuevoEstado);
      if (!resultado.ok) { alert(resultado.motivo); btn.disabled = false; return; }
      await renderizarTablaPedidos();
    });
  });
}

function inicializarFotosClientes() {
  const inputArchivo = document.getElementById('inputFotoCliente');
  if (!inputArchivo) return;

  inputArchivo.addEventListener('change', async () => {
    const file = inputArchivo.files[0];
    if (!file) return;
    const mensaje = document.getElementById('mensajeClientes');
    ocultarMensaje(mensaje);

    inputArchivo.disabled = true;
    const resultado = await SirinGoDB.agregarFotoCliente(file);
    inputArchivo.disabled = false;
    inputArchivo.value = '';

    if (!resultado.ok) { mostrarMensaje(mensaje, resultado.motivo); return; }
    await renderizarFotosClientesAdmin();
  });
}

async function renderizarFotosClientesAdmin() {
  const grid = document.getElementById('clientesAdminGrid');
  if (!grid) return;

  const fotos = await SirinGoDB.getFotosClientes();

  if (fotos.length === 0) {
    grid.innerHTML = `<p class="galeria-admin-vacio">Todavía no cargaste fotos de clientes. Mientras tanto, el carrusel del inicio no se muestra.</p>`;
    return;
  }

  grid.innerHTML = fotos.map(f => `
    <div class="galeria-admin-item">
      <img src="${f.url}" alt="Foto de cliente satisfecho">
      <button type="button" class="galeria-admin-quitar" data-quitar-foto-cliente="${f.id}" data-path="${escaparHTML(f.imagen)}" title="Quitar">✕</button>
    </div>
  `).join('');

  grid.querySelectorAll('[data-quitar-foto-cliente]').forEach(btn => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      await SirinGoDB.eliminarFotoCliente(btn.dataset.quitarFotoCliente, btn.dataset.path);
      await renderizarFotosClientesAdmin();
    });
  });
}

/* ------------------------- confirmación genérica ------------------------- */

function abrirConfirmacion(texto, alConfirmar) {
  const modal = document.getElementById('modalConfirmacion');
  document.getElementById('textoConfirmacion').textContent = texto;
  modal.hidden = false;

  const btnConfirmar = document.getElementById('btnConfirmarAccion');
  const btnCancelar = document.getElementById('btnCancelarAccion');

  const limpiar = () => {
    modal.hidden = true;
    btnConfirmar.removeEventListener('click', onConfirmar);
    btnCancelar.removeEventListener('click', onCancelar);
  };
  const onConfirmar = () => { alConfirmar(); limpiar(); };
  const onCancelar = () => { limpiar(); };

  btnConfirmar.addEventListener('click', onConfirmar);
  btnCancelar.addEventListener('click', onCancelar);
}
