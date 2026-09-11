/* ============================================================
   SirinGo — Categorías múltiples, colores y promoción "2x1"
   ------------------------------------------------------------
   Ejecutar en: Supabase → tu proyecto → SQL Editor → New query → Run.

   Agrega tres cosas independientes:

   1) CATEGORÍAS MÚLTIPLES (como etiquetas)
      Hasta ahora cada producto tenía una sola categoría
      (productos.rubro_id). Se agrega una tabla intermedia
      "producto_categorias" para poder asignarle varias.
      "productos.rubro_id" NO se borra: se sigue usando como
      "categoría principal" (la primera que elijas), así no se
      rompe nada de lo que ya depende de ella puertas adentro.
      Todo lo que ya tenías cargado se migra automáticamente:
      cada producto queda etiquetado con la categoría que ya tenía.

   2) COLORES DISPONIBLES
      Columna "colores" (lista de {nombre, hex}) para mostrar en
      la ficha del producto qué colores hay disponibles. Es
      solo informativo — no maneja stock por color.

   3) PROMOCIÓN "2X1"
      Columna "es_2x1": para marcar manualmente un producto como
      Pack 2x1 y que se muestre una etiqueta llamativa en el
      catálogo (independiente de la etiqueta de "Oferta -X%", que
      ya existe y sigue funcionando igual, tomada automáticamente
      de las opciones de compra).
   ============================================================ */

-- ---------- 1) Categorías múltiples ----------
create table if not exists public.producto_categorias (
  producto_id  bigint not null references public.productos(id) on delete cascade,
  rubro_id     bigint not null references public.rubros(id) on delete cascade,
  primary key (producto_id, rubro_id)
);

create index if not exists idx_producto_categorias_rubro on public.producto_categorias(rubro_id);

alter table public.producto_categorias enable row level security;

drop policy if exists "producto_categorias_select_publico" on public.producto_categorias;
create policy "producto_categorias_select_publico"
  on public.producto_categorias for select
  using (true);

drop policy if exists "producto_categorias_insert_admin" on public.producto_categorias;
create policy "producto_categorias_insert_admin"
  on public.producto_categorias for insert
  with check (public.is_admin());

drop policy if exists "producto_categorias_delete_admin" on public.producto_categorias;
create policy "producto_categorias_delete_admin"
  on public.producto_categorias for delete
  using (public.is_admin());

-- Migra lo que ya existe: cada producto queda etiquetado con la
-- categoría que ya tenía cargada en rubro_id.
insert into public.producto_categorias (producto_id, rubro_id)
select id, rubro_id from public.productos
on conflict (producto_id, rubro_id) do nothing;

-- ---------- 2) Colores disponibles ----------
alter table public.productos
  add column if not exists colores jsonb not null default '[]';

-- ---------- 3) Promoción "2x1" ----------
alter table public.productos
  add column if not exists es_2x1 boolean not null default false;

/* ============================================================
   FIN — Después de correr esto:
   - admin.html → Productos → Editar: ahora "Categoría" te deja
     tildar más de una, hay una sección para cargar colores y un
     check para marcar "Es Pack 2x1".
   - El catálogo va a mostrar todas las etiquetas de categoría de
     cada producto, los colores disponibles en la ficha, y una
     etiqueta llamativa "2X1" cuando corresponda.
   ============================================================ */
