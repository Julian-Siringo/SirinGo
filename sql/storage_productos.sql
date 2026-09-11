/* ============================================================
   SirinGo — Supabase Storage para imágenes de productos
   ------------------------------------------------------------
   Ejecutar en: Supabase → SQL Editor → New query → Run
   (Podés correr esto en la misma base donde ya ejecutaste
   supabase_schema.sql; no pisa nada de lo que ya existe).
   ============================================================ */

-- ============================================================
-- 1. BUCKET "productos"
-- ============================================================
-- público = true: cualquiera puede VER las imágenes (son fotos de
-- productos de un catálogo, no hay motivo para ocultarlas). Subir,
-- reemplazar o borrar sí queda restringido a administradores por
-- las políticas de abajo.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'productos',
  'productos',
  true,
  5242880, -- 5 MB, coincide con el límite validado en el frontend
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;


-- ============================================================
-- 2. POLÍTICAS DE STORAGE (tabla storage.objects)
-- ============================================================
-- Reutilizamos la función public.is_admin() ya creada en
-- supabase_schema.sql, que revisa la tabla perfiles.

-- ---------- Lectura: todos pueden ver las imágenes ----------
drop policy if exists "productos_storage_select_publico" on storage.objects;
create policy "productos_storage_select_publico"
  on storage.objects for select
  using (bucket_id = 'productos');

-- ---------- Subir: solo administradores ----------
drop policy if exists "productos_storage_insert_admin" on storage.objects;
create policy "productos_storage_insert_admin"
  on storage.objects for insert
  with check (bucket_id = 'productos' and public.is_admin());

-- ---------- Reemplazar/actualizar: solo administradores ----------
drop policy if exists "productos_storage_update_admin" on storage.objects;
create policy "productos_storage_update_admin"
  on storage.objects for update
  using (bucket_id = 'productos' and public.is_admin())
  with check (bucket_id = 'productos' and public.is_admin());

-- ---------- Eliminar: solo administradores ----------
drop policy if exists "productos_storage_delete_admin" on storage.objects;
create policy "productos_storage_delete_admin"
  on storage.objects for delete
  using (bucket_id = 'productos' and public.is_admin());


-- ============================================================
-- 3. LIMPIEZA DE DATOS DE EJEMPLO
-- ------------------------------------------------------------
-- Los productos que vinieron con el SQL inicial tienen un emoji
-- guardado en la columna "imagen" (🧴, 🧪, etc.), que ya NO es un
-- path válido de Storage. Los dejamos en null para que el sitio
-- muestre el ícono/placeholder por defecto en vez de una imagen
-- rota, hasta que subas una imagen real desde el panel de admin.
-- ============================================================
update public.productos
set imagen = null
where imagen is not null
  and imagen not like 'http://%'
  and imagen not like 'https://%'
  and length(imagen) < 20; -- los paths reales son un UUID + extensión (36+ caracteres)

-- Ya no necesitamos un valor por defecto tipo emoji en esta columna.
alter table public.productos alter column imagen drop default;

/* ============================================================
   FIN — Después de correr esto:
   1) Andá a admin.html → Productos → Editar un producto.
   2) Subí una imagen real (JPG/PNG/WEBP, hasta 5 MB).
   3) Debería verse la vista previa, guardarse, y aparecer tanto
      en la tabla del admin como en el catálogo público.
   ============================================================ */
