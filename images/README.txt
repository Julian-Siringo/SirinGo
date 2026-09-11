Esta carpeta contiene el logo de SirinGo (logo.png) y queda preparada
para alojar imágenes reales de productos.

Las imágenes de productos NO se guardan acá: se suben desde el panel de
administración (Productos → Imagen del producto) directamente al bucket
"productos" de Supabase Storage, y el sitio arma la URL pública sola
(ver obtenerUrlImagen() en js/data.js). Mientras un producto no tenga
imagen cargada, se muestra un ícono de placeholder.
