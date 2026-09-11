/* ============================================================
   SirinGo — Videos de producto
   ------------------------------------------------------------
   Ejecutar en: Supabase → tu proyecto → SQL Editor → New query → Run.
   No pisa nada de lo que ya existe (mismo criterio que
   agregar_galeria_y_opciones.sql, pero para videos).

   Agrega:
   1) Columna "videos" en "productos" (array de paths, igual que
      ya existe "imagenes" para la galería de fotos).
   2) Un bucket de Storage nuevo, separado del de imágenes, porque
      los videos pesan mucho más: "productos-videos", hasta 50 MB
      por archivo, formatos MP4 / WEBM / MOV.
   3) Las mismas políticas de siempre: cualquiera puede VER los
      videos (son videos de productos de un catálogo público);
      solo un administrador puede subir, reemplazar o borrar.
   ============================================================ */

-- ---------- 1) Columna "videos" en productos ----------
alter table public.productos
  add column if not exists videos text[] not null default '{}';

-- ---------- 2) Bucket "productos-videos" ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'productos-videos',
  'productos-videos',
  true,
  52428800, -- 50 MB
  array['video/mp4', 'video/webm', 'video/quicktime']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---------- 3) Políticas de Storage (tabla storage.objects) ----------
-- Reutilizamos la misma función public.is_admin() que ya usan las
-- políticas del bucket de imágenes.

drop policy if exists "productos_videos_storage_select_publico" on storage.objects;
create policy "productos_videos_storage_select_publico"
  on storage.objects for select
  using (bucket_id = 'productos-videos');

drop policy if exists "productos_videos_storage_insert_admin" on storage.objects;
create policy "productos_videos_storage_insert_admin"
  on storage.objects for insert
  with check (bucket_id = 'productos-videos' and public.is_admin());

drop policy if exists "productos_videos_storage_update_admin" on storage.objects;
create policy "productos_videos_storage_update_admin"
  on storage.objects for update
  using (bucket_id = 'productos-videos' and public.is_admin())
  with check (bucket_id = 'productos-videos' and public.is_admin());

drop policy if exists "productos_videos_storage_delete_admin" on storage.objects;
create policy "productos_videos_storage_delete_admin"
  on storage.objects for delete
  using (bucket_id = 'productos-videos' and public.is_admin());

/* ============================================================
   FIN — Después de correr esto:
   1) Andá a admin.html → Productos → botón 🎬 "Videos del producto".
   2) Subí un video (MP4, WEBM o MOV, hasta 50 MB).
   3) Va a aparecer en la ficha del producto, junto con las fotos,
      en la misma galería con miniaturas.
   ============================================================ */
