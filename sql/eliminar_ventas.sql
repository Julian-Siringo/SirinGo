/* ============================================================
   SirinGo — Eliminar el subsistema de ventas
   ------------------------------------------------------------
   Quita las tablas "ventas" y "detalle_ventas", junto con los
   triggers y funciones que dependían de ellas. El resto del
   proyecto (productos, precios, stock, rubros, marcas, perfiles)
   queda intacto.

   Ejecutar en: Supabase → SQL Editor → New query → Run
   ============================================================ */

-- ---------- Tablas ----------
-- drop table ... cascade también elimina automáticamente sus
-- políticas RLS y los triggers definidos SOBRE esas tablas
-- (calcular_subtotal_detalle, actualizar_total_venta, descontar_stock).
drop table if exists public.detalle_ventas cascade;
drop table if exists public.ventas cascade;

-- ---------- Funciones que ya no se usan ----------
-- (las funciones en sí no se borran solas al eliminar la tabla,
-- solo los triggers que las invocaban; las quitamos para no dejar
-- código muerto en la base de datos)
drop function if exists public.calcular_subtotal_detalle();
drop function if exists public.actualizar_total_venta();
drop function if exists public.descontar_stock();

/* ============================================================
   FIN — Después de correr esto:
   - Ya no existen las tablas ventas / detalle_ventas.
   - El campo "stock" de productos se mantiene, pero ya no se
     descuenta automáticamente (no hay más ventas registradas).
     Lo administra el admin a mano desde el panel, como el resto
     de los campos del producto.
   - El precio de cada producto sigue mostrándose normalmente en
     el catálogo, tal como antes.
   ============================================================ */
