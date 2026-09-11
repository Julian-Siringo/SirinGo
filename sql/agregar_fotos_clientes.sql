/* ============================================================
   SirinGo — Fotos de "Clientes Satisfechos"
   ------------------------------------------------------------
   Ejecutar en: Supabase → tu proyecto → SQL Editor → New query → Run.

   Agrega:
   1) Tabla "fotos_clientes": las fotos que se muestran en el
      carrusel "Quienes ya confiaron en nosotros" del inicio,
      editables desde el panel de administración (sin límite fijo
      de cantidad, se pueden agregar o quitar cuando quieras).
   2) Un bucket de Storage público "clientes-satisfechos" para
      alojar esas fotos (mismos límites que el de imágenes de
      producto: JPG/PNG/WEBP, hasta 5 MB).
   3) Las políticas de siempre: cualquiera puede VER las fotos,
      solo un administrador puede subir/borrar.
   ============================================================ */

-- ---------- 1) Tabla fotos_clientes ----------
create table if not exists public.fotos_clientes (
  id          bigint generated always as identity primary key,
  imagen      text not null,
  orden       integer not null default 0,
  creado_en   timestamptz not null default now()
);

create index if not exists idx_fotos_clientes_orden on public.fotos_clientes(orden, id);

alter table public.fotos_clientes enable row level security;

drop policy if exists "fotos_clientes_select_publico" on public.fotos_clientes;
create policy "fotos_clientes_select_publico"
  on public.fotos_clientes for select
  using (true);

drop policy if exists "fotos_clientes_insert_admin" on public.fotos_clientes;
create policy "fotos_clientes_insert_admin"
  on public.fotos_clientes for insert
  with check (public.is_admin());

drop policy if exists "fotos_clientes_delete_admin" on public.fotos_clientes;
create policy "fotos_clientes_delete_admin"
  on public.fotos_clientes for delete
  using (public.is_admin());

-- ---------- 2) Bucket "clientes-satisfechos" ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'clientes-satisfechos',
  'clientes-satisfechos',
  true,
  5242880, -- 5 MB
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---------- 3) Políticas de Storage ----------
drop policy if exists "clientes_storage_select_publico" on storage.objects;
create policy "clientes_storage_select_publico"
  on storage.objects for select
  using (bucket_id = 'clientes-satisfechos');

drop policy if exists "clientes_storage_insert_admin" on storage.objects;
create policy "clientes_storage_insert_admin"
  on storage.objects for insert
  with check (bucket_id = 'clientes-satisfechos' and public.is_admin());

drop policy if exists "clientes_storage_delete_admin" on storage.objects;
create policy "clientes_storage_delete_admin"
  on storage.objects for delete
  using (bucket_id = 'clientes-satisfechos' and public.is_admin());

/* ============================================================
   FIN — Después de correr esto:
   1) Andá a admin.html → Clientes.
   2) Subí las fotos de clientes satisfechos (JPG/PNG/WEBP, hasta 5 MB).
   3) Van a aparecer automáticamente en el inicio, en el carrusel
      "Quienes ya confiaron en nosotros", debajo del catálogo.
   ============================================================ */
