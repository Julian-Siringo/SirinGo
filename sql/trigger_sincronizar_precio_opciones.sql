/* ============================================================
   SirinGo — Trigger: sincronizar precio del producto
   ------------------------------------------------------------
   Ejecutar UNA VEZ en: Supabase → tu proyecto → SQL Editor.
   Requiere haber corrido antes "acomodar_precio_desde_opciones.sql"
   (ese archivo deja "precio" como columna opcional en "productos").

   Contexto: hasta ahora, cada vez que se carga/edita/borra una
   "opción de compra" desde el panel de administración, es el
   código del sitio (js/data.js) el que copia el precio de la
   opción elegida (la destacada, o si no hay ninguna marcada, la
   primera) hacia productos.precio / productos.precio_anterior.

   Eso funciona, pero depende de que SIEMPRE se pase por ese
   código: si algún día se edita una opción directamente desde el
   SQL Editor, desde otra herramienta, o se agrega otra pantalla
   de administración que use la tabla producto_opciones, el precio
   del producto podría quedar desactualizado.

   Esta migración mueve esa misma sincronización a la base de
   datos con un trigger, para que ocurra siempre, sin importar
   desde dónde se toque producto_opciones.
   ============================================================ */

create or replace function public.sincronizar_precio_producto()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_producto_id      bigint;
  v_precio            numeric(12,2);
  v_precio_anterior   numeric(12,2);
begin
  v_producto_id := coalesce(new.producto_id, old.producto_id);

  -- Misma regla que usa el sitio: la opción destacada; si no hay
  -- ninguna marcada, la primera por orden (y por id, a igualdad
  -- de orden).
  select o.precio, o.precio_anterior
    into v_precio, v_precio_anterior
  from public.producto_opciones o
  where o.producto_id = v_producto_id
  order by o.destacada desc, o.orden asc, o.id asc
  limit 1;

  -- Si no queda ninguna opción (se borró la última), el producto
  -- vuelve a quedar sin precio hasta que se cargue una nueva.
  update public.productos
  set precio = v_precio,
      precio_anterior = v_precio_anterior
  where id = v_producto_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_sincronizar_precio_ins_upd on public.producto_opciones;
create trigger trg_sincronizar_precio_ins_upd
after insert or update on public.producto_opciones
for each row execute function public.sincronizar_precio_producto();

drop trigger if exists trg_sincronizar_precio_del on public.producto_opciones;
create trigger trg_sincronizar_precio_del
after delete on public.producto_opciones
for each row execute function public.sincronizar_precio_producto();

-- ---------- Re-sincronizar todo lo que ya existe, por las dudas ----------
-- (idéntico al paso 2 de acomodar_precio_desde_opciones.sql; no rompe nada
--  volver a correrlo, así que lo dejamos acá también para asegurarnos de
--  que después de crear el trigger todo quede parejo).
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
