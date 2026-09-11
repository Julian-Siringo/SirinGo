/* ============================================================
   data.js
   ------------------------------------------------------------
   Capa de acceso a datos (DAO) de SirinGo.
   ------------------------------------------------------------
   Se conecta a la base de datos real en Supabase (PostgreSQL)
   usando el cliente inicializado en js/supabase.js.

   Se mantienen los mismos nombres de función que ya usaba el
   proyecto original (getProductos(), getRubros(), etc.) para no
   tener que reescribir toda la lógica de páginas: "rubro" es el
   campo de clasificación de un producto y en la tienda se muestra
   como "categoría", pero la tabla y la columna en la base de
   datos siguen llamándose "rubros" / "rubro_id".

   TODAS las funciones son asíncronas: hay que llamarlas con `await`.
   ============================================================ */

const SirinGoDB = (() => {

  function formatearPrecio(valor) {
    return Number(valor).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 });
  }

  /* Calcula el % de descuento a partir del precio actual y el
     precio anterior (si el producto tiene uno cargado). Devuelve
     0 si no corresponde mostrar descuento. */
  function calcularDescuento(producto) {
    if (!producto || !producto.precio_anterior) return 0;
    if (producto.precio_anterior <= producto.precio) return 0;
    return Math.round((1 - producto.precio / producto.precio_anterior) * 100);
  }

  /* Traduce errores comunes de Supabase a mensajes entendibles
     para mostrar en la interfaz. */
  function mensajeError(error, contexto = '') {
    console.error(contexto, error);
    if (!error) return 'Ocurrió un error inesperado.';
    if (error.code === '23505') return 'Ya existe un registro con ese nombre.';
    if (error.code === '23503') return 'No se puede completar la acción: hay datos relacionados.';
    if (error.message?.includes('duplicate key')) return 'Ya existe un registro con ese valor.';
    if (error.message?.includes('JWT') || error.message?.includes('session')) return 'Tu sesión expiró. Volvé a iniciar sesión.';
    return error.message || 'Ocurrió un error al comunicarse con el servidor.';
  }

  /* ------------------------- PRODUCTOS ------------------------- */

  const BUCKET_PRODUCTOS = 'productos';
  const TIPOS_IMAGEN_PERMITIDOS = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const TAMANIO_MAXIMO_IMAGEN = 5 * 1024 * 1024; // 5 MB

  /* Sube una imagen de producto al bucket "productos" de Supabase
     Storage. Valida tipo y tamaño ANTES de subir. Genera un nombre
     único (UUID) para que dos productos nunca se pisen entre sí.
     Devuelve { ok:true, path } o { ok:false, motivo }. */
  async function subirImagenProducto(file) {
    if (!file) return { ok: false, motivo: 'No se seleccionó ninguna imagen.' };

    if (!TIPOS_IMAGEN_PERMITIDOS.includes(file.type)) {
      return { ok: false, motivo: 'Formato no permitido. Usá JPG, PNG o WEBP.' };
    }
    if (file.size > TAMANIO_MAXIMO_IMAGEN) {
      return { ok: false, motivo: 'La imagen no puede superar los 5 MB.' };
    }

    const extension = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const nombreUnico = `${crypto.randomUUID()}.${extension}`;

    const { error } = await supabaseClient
      .storage
      .from(BUCKET_PRODUCTOS)
      .upload(nombreUnico, file, { cacheControl: '3600', upsert: false });

    if (error) return { ok: false, motivo: mensajeError(error, 'subirImagenProducto') };
    return { ok: true, path: nombreUnico };
  }

  /* Elimina una imagen del bucket "productos" a partir de su path
     (por ejemplo "3f2a1e...-c3.jpg"). Si path es null/vacío, no hace
     nada (evita errores al "eliminar" una imagen que nunca existió). */
  async function eliminarImagenProducto(path) {
    if (!path) return { ok: true };
    // Si en algún momento se guardó una URL completa (compatibilidad),
    // no intentamos borrarla: solo sabemos borrar por path del bucket.
    if (/^https?:\/\//i.test(path)) return { ok: true };

    const { error } = await supabaseClient.storage.from(BUCKET_PRODUCTOS).remove([path]);
    if (error) {
      console.error('eliminarImagenProducto', error);
      return { ok: false, motivo: mensajeError(error, 'eliminarImagenProducto') };
    }
    return { ok: true };
  }

  /* Convierte el path guardado en productos.imagen a una URL pública
     que se puede usar directamente en un <img src="">. Devuelve null
     si no hay imagen (el llamador debe mostrar un placeholder). */
  function obtenerUrlImagen(path) {
    if (!path) return null;
    if (/^https?:\/\//i.test(path)) return path; // ya es una URL completa
    const { data } = supabaseClient.storage.from(BUCKET_PRODUCTOS).getPublicUrl(path);
    return data?.publicUrl || null;
  }

  /* Devuelve la lista de URLs públicas para la galería de un
     producto: primero la imagen principal (si tiene) y después
     las de producto.imagenes, sin repetir el mismo path dos veces. */
  function obtenerGaleriaProducto(producto) {
    if (!producto) return [];
    const paths = [producto.imagen, ...(producto.imagenes || [])].filter(Boolean);
    const vistos = new Set();
    const urls = [];
    for (const path of paths) {
      if (vistos.has(path)) continue;
      vistos.add(path);
      const url = obtenerUrlImagen(path);
      if (url) urls.push(url);
    }
    return urls;
  }

  /* Agrega una imagen nueva a la galería de un producto: sube el
     archivo a Storage y hace push del path al array "imagenes". */
  async function agregarImagenGaleria(productoId, file) {
    const subida = await subirImagenProducto(file);
    if (!subida.ok) return subida;

    const producto = await getProductoPorId(productoId);
    if (!producto) return { ok: false, motivo: 'No se encontró el producto.' };

    const nuevasImagenes = [...(producto.imagenes || []), subida.path];
    const { error } = await supabaseClient
      .from('productos')
      .update({ imagenes: nuevasImagenes })
      .eq('id', Number(productoId));

    if (error) {
      await eliminarImagenProducto(subida.path);
      return { ok: false, motivo: mensajeError(error, 'agregarImagenGaleria') };
    }
    return { ok: true, path: subida.path, imagenes: nuevasImagenes };
  }

  /* Quita una imagen de la galería de un producto (por path) y la
     borra de Storage. No toca la imagen principal ("imagen"). */
  async function quitarImagenGaleria(productoId, path) {
    const producto = await getProductoPorId(productoId);
    if (!producto) return { ok: false, motivo: 'No se encontró el producto.' };

    const nuevasImagenes = (producto.imagenes || []).filter(p => p !== path);
    const { error } = await supabaseClient
      .from('productos')
      .update({ imagenes: nuevasImagenes })
      .eq('id', Number(productoId));

    if (error) return { ok: false, motivo: mensajeError(error, 'quitarImagenGaleria') };
    await eliminarImagenProducto(path);
    return { ok: true, imagenes: nuevasImagenes };
  }

  /* ------------------------- VIDEOS DE PRODUCTO ------------------------- */
  // Mismo criterio que las imágenes de la galería, pero en un bucket
  // aparte ("productos-videos") porque los videos pesan mucho más.

  const BUCKET_PRODUCTOS_VIDEOS = 'productos-videos';
  const TIPOS_VIDEO_PERMITIDOS = ['video/mp4', 'video/webm', 'video/quicktime'];
  const TAMANIO_MAXIMO_VIDEO = 50 * 1024 * 1024; // 50 MB

  async function subirVideoProducto(file) {
    if (!file) return { ok: false, motivo: 'No se seleccionó ningún video.' };

    if (!TIPOS_VIDEO_PERMITIDOS.includes(file.type)) {
      return { ok: false, motivo: 'Formato no permitido. Usá MP4, WEBM o MOV.' };
    }
    if (file.size > TAMANIO_MAXIMO_VIDEO) {
      return { ok: false, motivo: 'El video no puede superar los 50 MB.' };
    }

    const extension = (file.name.split('.').pop() || 'mp4').toLowerCase();
    const nombreUnico = `${crypto.randomUUID()}.${extension}`;

    const { error } = await supabaseClient
      .storage
      .from(BUCKET_PRODUCTOS_VIDEOS)
      .upload(nombreUnico, file, { cacheControl: '3600', upsert: false });

    if (error) return { ok: false, motivo: mensajeError(error, 'subirVideoProducto') };
    return { ok: true, path: nombreUnico };
  }

  async function eliminarVideoProducto(path) {
    if (!path) return { ok: true };
    if (/^https?:\/\//i.test(path)) return { ok: true };

    const { error } = await supabaseClient.storage.from(BUCKET_PRODUCTOS_VIDEOS).remove([path]);
    if (error) {
      console.error('eliminarVideoProducto', error);
      return { ok: false, motivo: mensajeError(error, 'eliminarVideoProducto') };
    }
    return { ok: true };
  }

  function obtenerUrlVideo(path) {
    if (!path) return null;
    if (/^https?:\/\//i.test(path)) return path;
    const { data } = supabaseClient.storage.from(BUCKET_PRODUCTOS_VIDEOS).getPublicUrl(path);
    return data?.publicUrl || null;
  }

  async function agregarVideoGaleria(productoId, file) {
    const subida = await subirVideoProducto(file);
    if (!subida.ok) return subida;

    const producto = await getProductoPorId(productoId);
    if (!producto) return { ok: false, motivo: 'No se encontró el producto.' };

    const nuevosVideos = [...(producto.videos || []), subida.path];
    const { error } = await supabaseClient
      .from('productos')
      .update({ videos: nuevosVideos })
      .eq('id', Number(productoId));

    if (error) {
      await eliminarVideoProducto(subida.path);
      return { ok: false, motivo: mensajeError(error, 'agregarVideoGaleria') };
    }
    return { ok: true, path: subida.path, videos: nuevosVideos };
  }

  async function quitarVideoGaleria(productoId, path) {
    const producto = await getProductoPorId(productoId);
    if (!producto) return { ok: false, motivo: 'No se encontró el producto.' };

    const nuevosVideos = (producto.videos || []).filter(p => p !== path);
    const { error } = await supabaseClient
      .from('productos')
      .update({ videos: nuevosVideos })
      .eq('id', Number(productoId));

    if (error) return { ok: false, motivo: mensajeError(error, 'quitarVideoGaleria') };
    await eliminarVideoProducto(path);
    return { ok: true, videos: nuevosVideos };
  }

  /* Arma la galería completa que se muestra en la ficha del producto:
     primero las fotos (imagen principal + galería) y después los
     videos, cada uno con su tipo, para que producto-detalle.js sepa
     si tiene que dibujar un <img> o un <video>. */
  function obtenerGaleriaMultimediaProducto(producto) {
    if (!producto) return [];
    const items = obtenerGaleriaProducto(producto).map(url => ({ tipo: 'imagen', url }));
    const vistos = new Set();
    for (const path of producto.videos || []) {
      if (!path || vistos.has(path)) continue;
      vistos.add(path);
      const url = obtenerUrlVideo(path);
      if (url) items.push({ tipo: 'video', url });
    }
    return items;
  }

  async function getProductos() {
    const { data, error } = await supabaseClient
      .from('productos')
      .select('*')
      .order('id', { ascending: true });
    if (error) { console.error('getProductos', error); return []; }
    return adjuntarCategorias(data);
  }

  async function getProductoPorId(id) {
    const { data, error } = await supabaseClient
      .from('productos')
      .select('*')
      .eq('id', Number(id))
      .maybeSingle();
    if (error) { console.error('getProductoPorId', error); return null; }
    if (!data) return null;

    const { data: categorias } = await supabaseClient
      .from('producto_categorias')
      .select('rubro_id')
      .eq('producto_id', data.id);

    data.categorias = (categorias && categorias.length > 0) ? categorias.map(c => c.rubro_id) : [data.rubro_id];
    return data;
  }

  /* Trae, en una sola consulta extra, todas las filas de
     producto_categorias y las agrupa por producto, para no tener que
     hacer una consulta por producto al listar el catálogo o la tabla
     del admin. Si un producto todavía no tiene ninguna fila (por lo
     que sea), se cae de nuevo en su rubro_id de siempre. */
  async function adjuntarCategorias(productos) {
    if (!productos || productos.length === 0) return productos;

    const { data: categorias, error } = await supabaseClient
      .from('producto_categorias')
      .select('producto_id, rubro_id');

    if (error) {
      console.error('adjuntarCategorias', error);
      return productos.map(p => ({ ...p, categorias: [p.rubro_id] }));
    }

    const mapa = new Map();
    for (const fila of categorias) {
      if (!mapa.has(fila.producto_id)) mapa.set(fila.producto_id, []);
      mapa.get(fila.producto_id).push(fila.rubro_id);
    }

    return productos.map(p => ({ ...p, categorias: mapa.get(p.id) || [p.rubro_id] }));
  }

  /* Reemplaza TODAS las categorías de un producto por las indicadas.
     La primera de la lista queda como "categoría principal"
     (productos.rubro_id), para todo lo que puertas adentro todavía
     depende de un valor único (por ejemplo, el rubro obligatorio al
     crear el producto). */
  async function actualizarCategoriasProducto(productoId, rubroIds) {
    const idsUnicos = [...new Set((rubroIds || []).map(Number))].filter(n => !Number.isNaN(n));
    if (idsUnicos.length === 0) return { ok: false, motivo: 'Elegí al menos una categoría.' };

    const { error: errorDelete } = await supabaseClient
      .from('producto_categorias')
      .delete()
      .eq('producto_id', Number(productoId));
    if (errorDelete) return { ok: false, motivo: mensajeError(errorDelete, 'actualizarCategoriasProducto') };

    const filas = idsUnicos.map(rubro_id => ({ producto_id: Number(productoId), rubro_id }));
    const { error: errorInsert } = await supabaseClient.from('producto_categorias').insert(filas);
    if (errorInsert) return { ok: false, motivo: mensajeError(errorInsert, 'actualizarCategoriasProducto') };

    const { error: errorUpdate } = await supabaseClient
      .from('productos')
      .update({ rubro_id: idsUnicos[0] })
      .eq('id', Number(productoId));
    if (errorUpdate) return { ok: false, motivo: mensajeError(errorUpdate, 'actualizarCategoriasProducto') };

    return { ok: true };
  }

  async function crearProducto(datos) {
    const { data, error } = await supabaseClient
      .from('productos')
      .insert([datos])
      .select()
      .single();
    if (error) return { ok: false, motivo: mensajeError(error, 'crearProducto') };
    return { ok: true, data };
  }

  async function actualizarProducto(id, datos) {
    const { data, error } = await supabaseClient
      .from('productos')
      .update(datos)
      .eq('id', Number(id))
      .select()
      .single();
    if (error) return { ok: false, motivo: mensajeError(error, 'actualizarProducto') };
    return { ok: true, data };
  }

  async function eliminarProducto(id) {
    const producto = await getProductoPorId(id);

    const { error } = await supabaseClient
      .from('productos')
      .delete()
      .eq('id', Number(id));
    if (error) return { ok: false, motivo: mensajeError(error, 'eliminarProducto') };

    // El registro ya se borró correctamente; ahora limpiamos su imagen
    // en Storage. Si esto falla, no revertimos el borrado del producto,
    // solo lo dejamos registrado en consola (evita dejar el producto
    // "atascado" por un problema en Storage).
    if (producto?.imagen) {
      const resultadoImagen = await eliminarImagenProducto(producto.imagen);
      if (!resultadoImagen.ok) console.error('No se pudo borrar la imagen del producto eliminado:', resultadoImagen.motivo);
    }

    return { ok: true };
  }

  /* ------------------------- RUBROS ------------------------- */

  async function getRubros() {
    const { data, error } = await supabaseClient
      .from('rubros')
      .select('*')
      .order('nombre', { ascending: true });
    if (error) { console.error('getRubros', error); return []; }
    return data;
  }

  async function getRubroPorId(id) {
    const { data, error } = await supabaseClient
      .from('rubros')
      .select('*')
      .eq('id', Number(id))
      .maybeSingle();
    if (error) { console.error('getRubroPorId', error); return null; }
    return data;
  }

  async function crearRubro(nombre) {
    const { data, error } = await supabaseClient
      .from('rubros')
      .insert([{ nombre }])
      .select()
      .single();
    if (error) return { ok: false, motivo: mensajeError(error, 'crearRubro') };
    return { ok: true, data };
  }

  async function actualizarRubro(id, nombre) {
    const { data, error } = await supabaseClient
      .from('rubros')
      .update({ nombre })
      .eq('id', Number(id))
      .select()
      .single();
    if (error) return { ok: false, motivo: mensajeError(error, 'actualizarRubro') };
    return { ok: true, data };
  }

  async function eliminarRubro(id) {
    const { count, error: errorCheck } = await supabaseClient
      .from('productos')
      .select('id', { count: 'exact', head: true })
      .eq('rubro_id', Number(id));
    if (errorCheck) return { ok: false, motivo: mensajeError(errorCheck, 'eliminarRubro/check') };
    if (count > 0) return { ok: false, motivo: 'El rubro tiene productos asociados.' };

    const { error } = await supabaseClient.from('rubros').delete().eq('id', Number(id));
    if (error) return { ok: false, motivo: mensajeError(error, 'eliminarRubro') };
    return { ok: true };
  }

  /* ------------------------- MARCAS ------------------------- */

  async function getMarcas() {
    const { data, error } = await supabaseClient
      .from('marcas')
      .select('*')
      .order('nombre', { ascending: true });
    if (error) { console.error('getMarcas', error); return []; }
    return data;
  }

  async function getMarcaPorId(id) {
    const { data, error } = await supabaseClient
      .from('marcas')
      .select('*')
      .eq('id', Number(id))
      .maybeSingle();
    if (error) { console.error('getMarcaPorId', error); return null; }
    return data;
  }

  async function crearMarca(nombre) {
    const { data, error } = await supabaseClient
      .from('marcas')
      .insert([{ nombre }])
      .select()
      .single();
    if (error) return { ok: false, motivo: mensajeError(error, 'crearMarca') };
    return { ok: true, data };
  }

  async function actualizarMarca(id, nombre) {
    const { data, error } = await supabaseClient
      .from('marcas')
      .update({ nombre })
      .eq('id', Number(id))
      .select()
      .single();
    if (error) return { ok: false, motivo: mensajeError(error, 'actualizarMarca') };
    return { ok: true, data };
  }

  async function eliminarMarca(id) {
    const { count, error: errorCheck } = await supabaseClient
      .from('productos')
      .select('id', { count: 'exact', head: true })
      .eq('marca_id', Number(id));
    if (errorCheck) return { ok: false, motivo: mensajeError(errorCheck, 'eliminarMarca/check') };
    if (count > 0) return { ok: false, motivo: 'La marca tiene productos asociados.' };

    const { error } = await supabaseClient.from('marcas').delete().eq('id', Number(id));
    if (error) return { ok: false, motivo: mensajeError(error, 'eliminarMarca') };
    return { ok: true };
  }

  /* ------------------------- USUARIOS / PERFILES ------------------------- */
  // Requiere rol admin (lo aplica RLS en la tabla perfiles).

  async function getUsuarios() {
    const { data, error } = await supabaseClient
      .from('perfiles')
      .select('*')
      .order('fecha_registro', { ascending: false });
    if (error) { console.error('getUsuarios', error); return []; }
    return data;
  }

  async function getUsuarioPorEmail(email) {
    const { data, error } = await supabaseClient
      .from('perfiles')
      .select('*')
      .ilike('email', email)
      .maybeSingle();
    if (error) { console.error('getUsuarioPorEmail', error); return null; }
    return data;
  }

  /* Registro de usuario nuevo vía Supabase Auth.
     El perfil en la tabla "perfiles" se crea SOLO,
     mediante el trigger handle_new_user() (ver SQL). El rol
     siempre queda en 'usuario': no se puede elegir desde acá. */
  async function crearUsuario({ nombre, apellido, email, password }) {
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: { data: { nombre, apellido } }
    });
    if (error) return { ok: false, motivo: mensajeError(error, 'crearUsuario') };
    return { ok: true, data };
  }

  /* ------------------------- SESIÓN (Supabase Auth) ------------------------- */

  /* Inicia sesión con email/contraseña usando Supabase Auth. */
  async function iniciarSesion(email, password) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
      const msg = (error.message || '').toLowerCase();
      if (msg.includes('email not confirmed')) {
        return { ok: false, motivo: 'Tu email todavía no fue confirmado. Revisá tu casilla de correo, o pedile al administrador que confirme tu cuenta desde Supabase (Authentication → Users).' };
      }
      if (msg.includes('invalid login credentials')) {
        return { ok: false, motivo: 'Email o contraseña incorrectos.' };
      }
      return { ok: false, motivo: mensajeError(error, 'iniciarSesion') };
    }

    const perfil = await getPerfilPropio();
    if (!perfil) return { ok: false, motivo: 'No se pudo cargar tu perfil. Intentá nuevamente.' };
    return { ok: true, usuario: perfil };
  }

  /* Devuelve el perfil (nombre, apellido, rol, etc.) del usuario
     actualmente logueado, o null si no hay sesión activa.
     Usamos getSession() (lectura local, sin red) en vez de getUser()
     (que revalida contra el servidor) para que el header y las
     redirecciones reflejen el estado de sesión al instante, sin
     carreras de tiempos justo después de loguearse o navegar. */
  async function getPerfilPropio() {
    const { data: { session }, error: errorSesion } = await supabaseClient.auth.getSession();
    if (errorSesion || !session) return null;

    const { data: perfil, error: errorPerfil } = await supabaseClient
      .from('perfiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle();
    if (errorPerfil) { console.error('getPerfilPropio', errorPerfil); return null; }
    return perfil;
  }

  /* Reemplaza a la vieja getSesion() síncrona: ahora es async
     porque tiene que consultar a Supabase. */
  async function getSesion() {
    return getPerfilPropio();
  }

  async function cerrarSesion() {
    await supabaseClient.auth.signOut();
  }

  /* ------------------------- STOCK (para el dashboard) ------------------------- */

  async function getStockTotal() {
    const { data, error } = await supabaseClient.from('productos').select('stock');
    if (error) { console.error('getStockTotal', error); return 0; }
    return data.reduce((acum, p) => acum + (p.stock || 0), 0);
  }

  /* ------------------------- OPCIONES DE COMPRA (página de producto) ------------------------- */

  async function getOpcionesProducto(productoId) {
    const { data, error } = await supabaseClient
      .from('producto_opciones')
      .select('*')
      .eq('producto_id', Number(productoId))
      .order('orden', { ascending: true });
    if (error) { console.error('getOpcionesProducto', error); return []; }
    return data;
  }

  /* El precio y precio anterior que se muestran en la tarjeta del
     catálogo ya no se cargan a mano en "Editar producto": se toman de
     las opciones de compra (la destacada, o si no hay ninguna marcada,
     la primera). Esa sincronización la hace un trigger en Supabase
     (ver sql/trigger_sincronizar_precio_opciones.sql) cada vez que se
     crea, edita o borra una opción, así que acá no hace falta pedirla
     a mano: alcanza con escribir en producto_opciones. */

  async function crearOpcionProducto(datos) {
    const { data, error } = await supabaseClient
      .from('producto_opciones')
      .insert([datos])
      .select()
      .single();
    if (error) return { ok: false, motivo: mensajeError(error, 'crearOpcionProducto') };
    return { ok: true, data };
  }

  async function actualizarOpcionProducto(id, datos) {
    const { data, error } = await supabaseClient
      .from('producto_opciones')
      .update(datos)
      .eq('id', Number(id))
      .select()
      .single();
    if (error) return { ok: false, motivo: mensajeError(error, 'actualizarOpcionProducto') };
    return { ok: true, data };
  }

  async function eliminarOpcionProducto(id) {
    const { error } = await supabaseClient.from('producto_opciones').delete().eq('id', Number(id));
    if (error) return { ok: false, motivo: mensajeError(error, 'eliminarOpcionProducto') };
    return { ok: true };
  }

  /* ------------------------- FOTOS DE CLIENTES (carrusel del inicio) ------------------------- */

  const BUCKET_CLIENTES = 'clientes-satisfechos';
  const TIPOS_IMAGEN_CLIENTES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const TAMANIO_MAXIMO_FOTO_CLIENTE = 5 * 1024 * 1024; // 5 MB

  async function getFotosClientes() {
    const { data, error } = await supabaseClient
      .from('fotos_clientes')
      .select('*')
      .order('orden', { ascending: true })
      .order('id', { ascending: true });
    if (error) { console.error('getFotosClientes', error); return []; }
    return data.map(f => ({ ...f, url: obtenerUrlFotoCliente(f.imagen) })).filter(f => f.url);
  }

  function obtenerUrlFotoCliente(path) {
    if (!path) return null;
    if (/^https?:\/\//i.test(path)) return path;
    const { data } = supabaseClient.storage.from(BUCKET_CLIENTES).getPublicUrl(path);
    return data?.publicUrl || null;
  }

  /* Sube la foto y crea el registro en fotos_clientes en un solo paso. */
  async function agregarFotoCliente(file) {
    if (!file) return { ok: false, motivo: 'No se seleccionó ninguna foto.' };
    if (!TIPOS_IMAGEN_CLIENTES.includes(file.type)) {
      return { ok: false, motivo: 'Formato no permitido. Usá JPG, PNG o WEBP.' };
    }
    if (file.size > TAMANIO_MAXIMO_FOTO_CLIENTE) {
      return { ok: false, motivo: 'La foto no puede superar los 5 MB.' };
    }

    const extension = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const nombreUnico = `${crypto.randomUUID()}.${extension}`;

    const { error: errorSubida } = await supabaseClient
      .storage
      .from(BUCKET_CLIENTES)
      .upload(nombreUnico, file, { cacheControl: '3600', upsert: false });
    if (errorSubida) return { ok: false, motivo: mensajeError(errorSubida, 'agregarFotoCliente') };

    const { data, error } = await supabaseClient
      .from('fotos_clientes')
      .insert([{ imagen: nombreUnico }])
      .select()
      .single();

    if (error) {
      await supabaseClient.storage.from(BUCKET_CLIENTES).remove([nombreUnico]);
      return { ok: false, motivo: mensajeError(error, 'agregarFotoCliente') };
    }
    return { ok: true, data };
  }

  /* Borra el registro y, si el path es propio del bucket (no una URL
     externa), también el archivo de Storage. */
  async function eliminarFotoCliente(id, path) {
    const { error } = await supabaseClient.from('fotos_clientes').delete().eq('id', Number(id));
    if (error) return { ok: false, motivo: mensajeError(error, 'eliminarFotoCliente') };
    if (path && !/^https?:\/\//i.test(path)) {
      await supabaseClient.storage.from(BUCKET_CLIENTES).remove([path]);
    }
    return { ok: true };
  }

  /* ------------------------- PEDIDOS ------------------------- */

  /* Crea un pedido a nombre del usuario logueado. Se llama desde
     checkout.js justo después de armar el pedido "local" de siempre
     (el que se usa para la pantalla de pago inmediata), así que acá
     solo nos importa dejarlo guardado para poder consultarlo después. */
  async function crearPedido(datos) {
    const { data, error } = await supabaseClient
      .from('pedidos')
      .insert([datos])
      .select()
      .single();
    if (error) return { ok: false, motivo: mensajeError(error, 'crearPedido') };
    return { ok: true, data };
  }

  /* Pedidos del usuario logueado, para "Mis pedidos". */
  async function getPedidosPropios() {
    const sesion = await getPerfilPropio();
    if (!sesion) return [];
    const { data, error } = await supabaseClient
      .from('pedidos')
      .select('*')
      .eq('usuario_id', sesion.id)
      .order('creado_en', { ascending: false });
    if (error) { console.error('getPedidosPropios', error); return []; }
    return data;
  }

  /* Un pedido puntual del usuario logueado, por número (para la
     pantalla de "continuar pago"). */
  async function getPedidoPropioPorNumero(numero) {
    const sesion = await getPerfilPropio();
    if (!sesion) return null;
    const { data, error } = await supabaseClient
      .from('pedidos')
      .select('*')
      .eq('usuario_id', sesion.id)
      .eq('numero', numero)
      .maybeSingle();
    if (error) { console.error('getPedidoPropioPorNumero', error); return null; }
    return data;
  }

  /* ------------------------- PEDIDOS (panel admin) ------------------------- */

  async function getPedidos() {
    const { data, error } = await supabaseClient
      .from('pedidos')
      .select('*')
      .order('creado_en', { ascending: false });
    if (error) { console.error('getPedidos', error); return []; }
    return data;
  }

  async function actualizarEstadoPedido(id, estado) {
    const { error } = await supabaseClient
      .from('pedidos')
      .update({ estado_pago: estado })
      .eq('id', Number(id));
    if (error) return { ok: false, motivo: mensajeError(error, 'actualizarEstadoPedido') };
    return { ok: true };
  }

  /* ------------------------- CONSULTAS (formulario de contacto) ------------------------- */

  /* Envía una consulta de contacto. Funciona tanto para visitantes
     anónimos como para usuarios logueados: si hay sesión activa,
     queda asociada a ese usuario (usuario_id); si no, queda null. */
  async function crearConsulta({ nombre, email, asunto, mensaje }) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    const usuario_id = session?.user?.id || null;

    const { error } = await supabaseClient
      .from('consultas')
      .insert([{ nombre, email, asunto, mensaje, usuario_id }]);

    if (error) return { ok: false, motivo: mensajeError(error, 'crearConsulta') };
    return { ok: true };
  }

  /* Solo accesible para administradores (lo aplica RLS). */
  async function getConsultas() {
    const { data, error } = await supabaseClient
      .from('consultas')
      .select('*')
      .order('fecha_creacion', { ascending: false });
    if (error) { console.error('getConsultas', error); return []; }
    return data;
  }

  /* Cambia el estado de una consulta entre 'pendiente' y 'visto'. */
  async function actualizarEstadoConsulta(id, estado) {
    const { error } = await supabaseClient
      .from('consultas')
      .update({ estado })
      .eq('id', Number(id));
    if (error) return { ok: false, motivo: mensajeError(error, 'actualizarEstadoConsulta') };
    return { ok: true };
  }

  /* ------------------------- API pública ------------------------- */

  return {
    formatearPrecio,
    calcularDescuento,
    // productos
    getProductos, getProductoPorId, crearProducto, actualizarProducto, eliminarProducto,
    actualizarCategoriasProducto,
    // imágenes de productos (Supabase Storage)
    subirImagenProducto, eliminarImagenProducto, obtenerUrlImagen,
    obtenerGaleriaProducto, agregarImagenGaleria, quitarImagenGaleria,
    subirVideoProducto, eliminarVideoProducto, obtenerUrlVideo,
    agregarVideoGaleria, quitarVideoGaleria, obtenerGaleriaMultimediaProducto,
    // rubros
    getRubros, getRubroPorId, crearRubro, actualizarRubro, eliminarRubro,
    // marcas
    getMarcas, getMarcaPorId, crearMarca, actualizarMarca, eliminarMarca,
    // opciones de compra
    getOpcionesProducto, crearOpcionProducto, actualizarOpcionProducto, eliminarOpcionProducto,
    // usuarios
    getUsuarios, getUsuarioPorEmail, crearUsuario,
    // fotos de clientes (carrusel del inicio)
    getFotosClientes, agregarFotoCliente, eliminarFotoCliente,
    // pedidos
    crearPedido, getPedidosPropios, getPedidoPropioPorNumero,
    getPedidos, actualizarEstadoPedido,
    // sesión
    iniciarSesion, getSesion, cerrarSesion, getPerfilPropio,
    // stock (dashboard)
    getStockTotal,
    // consultas (formulario de contacto)
    crearConsulta, getConsultas, actualizarEstadoConsulta
  };
})();
