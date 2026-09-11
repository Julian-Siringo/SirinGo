/* ============================================================
   SirinGo — Migración: precio derivado de "opciones de compra"
   ------------------------------------------------------------
   Ejecutar UNA VEZ en: Supabase → tu proyecto → SQL Editor.

   Contexto: el panel de administración ya no permite cargar el
   precio a mano en "Editar producto". Ahora el precio de un
   producto se toma automáticamente de sus "opciones de compra"
   (la destacada, o si no hay ninguna marcada, la primera). Esta
   migración:

   1) Permite que "precio" quede en NULL mientras el producto
      todavía no tiene ninguna opción de compra cargada (antes
      era obligatorio, y el sistema usaba un $1 de relleno).
   2) Sincroniza los productos que ya existían, para que su
      precio/precio_anterior coincida con sus opciones actuales.
   ============================================================ */

-- ---------- 1) "precio" pasa a ser opcional ----------
alter table public.productos
  alter column precio drop not null;

alter table public.productos
  drop constraint if exists productos_precio_check;

alter table public.productos
  add constraint productos_precio_check
  check (precio is null or precio > 0);

-- ---------- 2) Sincronizar productos existentes con sus opciones ----------
-- Para cada producto con opciones cargadas, toma la opción destacada
-- (o, si no hay ninguna marcada, la primera por orden) y copia su
-- precio / precio anterior al producto. Los productos sin ninguna
-- opción cargada quedan con precio = NULL (antes tenían el valor
-- viejo que se haya cargado a mano; se puede ejecutar sin miedo, no
-- rompe nada: simplemente van a mostrar el aviso de "falta cargar
-- una opción" en el panel hasta que se les cargue una).
with preferida as (
  select distinct on (producto_id)
    producto_id, precio, precio_anterior
  from public.producto_opciones
  order by producto_id, destacada desc, orden asc, id asc
)
update public.productos p
set precio = preferida.precio,
    precio_anterior = preferida.precio_anterior
from preferida
where preferida.producto_id = p.id;

update public.productos
set precio = null, precio_anterior = null
where id not in (select distinct producto_id from public.producto_opciones);
