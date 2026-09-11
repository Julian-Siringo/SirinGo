/* ============================================================
   Agrega:
   1) Galería de imágenes por producto (columna "imagenes",
      además de la imagen principal que ya existía en "imagen").
   2) Tabla "producto_opciones": las opciones de compra que se
      muestran en la página de detalle del producto (por ejemplo
      "1 unidad", "Pack 3 meses", "Pack 6 meses"), editables desde
      el panel de administración.

   Ejecutar en: Supabase → SQL Editor → New query → pegar → Run
   ============================================================ */

-- ---------- Galería de imágenes del producto ----------
alter table public.productos
  add column if not exists imagenes text[] not null default '{}';

-- ---------- OPCIONES DE COMPRA ----------
create table if not exists public.producto_opciones (
  id              bigint generated always as identity primary key,
  producto_id     bigint not null references public.productos(id) on delete cascade,
  orden           integer not null default 0,
  titulo          text not null,
  subtitulo       text not null default '',
  etiqueta        text,
  precio          numeric(12,2) not null check (precio > 0),
  precio_anterior numeric(12,2),
  destacada       boolean not null default false,
  constraint producto_opciones_precio_anterior_check
    check (precio_anterior is null or precio_anterior > precio)
);

create index if not exists idx_producto_opciones_producto on public.producto_opciones(producto_id);

alter table public.producto_opciones enable row level security;

drop policy if exists "producto_opciones_select_publico" on public.producto_opciones;
create policy "producto_opciones_select_publico"
  on public.producto_opciones for select
  using (true);

drop policy if exists "producto_opciones_insert_admin" on public.producto_opciones;
create policy "producto_opciones_insert_admin"
  on public.producto_opciones for insert
  with check (public.is_admin());

drop policy if exists "producto_opciones_update_admin" on public.producto_opciones;
create policy "producto_opciones_update_admin"
  on public.producto_opciones for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "producto_opciones_delete_admin" on public.producto_opciones;
create policy "producto_opciones_delete_admin"
  on public.producto_opciones for delete
  using (public.is_admin());
