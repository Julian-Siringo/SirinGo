/* ============================================================
   SirinGo — Migración: precio anterior (para mostrar ofertas)
   ------------------------------------------------------------
   Ejecutar UNA VEZ en: Supabase → tu proyecto → SQL Editor.
   Agrega una columna opcional a "productos" para poder cargar
   un precio anterior tachado + % de descuento en las cards,
   sin tocar el resto del esquema ni los datos existentes.
   ============================================================ */

alter table public.productos
  add column if not exists precio_anterior numeric(12,2);

alter table public.productos
  add constraint productos_precio_anterior_check
  check (precio_anterior is null or precio_anterior > precio);
