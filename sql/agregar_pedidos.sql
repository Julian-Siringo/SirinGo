/* ============================================================
   SirinGo — Pedidos (para que el cliente pueda hacerles seguimiento)
   ------------------------------------------------------------
   Ejecutar en: Supabase → tu proyecto → SQL Editor → New query → Run.

   Contexto: hasta ahora, cuando alguien terminaba una compra en
   checkout.html, el pedido quedaba guardado solo en el localStorage
   de SU navegador (js/checkout.js, CLAVE_PEDIDO) y se avisaba a la
   tienda por WhatsApp. Si cerraba esa pestaña, no había forma de
   volver a ver el estado del pedido ni de retomar el pago.

   Esta migración agrega una tabla real "pedidos" en la base, para
   que:
   - Si el comprador tiene una cuenta y está logueado al pagar, el
     pedido quede guardado a su nombre.
   - Pueda verlo después en "Hola, [nombre]" → Mis pedidos.
   - Si no pagó en el momento, pueda volver más tarde y retomar el
     pago del mismo pedido (mismo alias, CVU y monto).
   - Vos, como admin, puedas marcar cada pedido como "Pagado" o
     "Cancelado" una vez que verificás el comprobante por WhatsApp
     (panel nuevo: admin.html → Pedidos), y que ese cambio de estado
     se refleje automáticamente en lo que ve el cliente.

   Los pedidos hechos como invitado (sin sesión iniciada) NO se
   pueden guardar acá —no hay a nombre de quién— así que van a
   seguir funcionando exactamente como hasta ahora (WhatsApp +
   localStorage), sin aparecer en ningún listado.
   ============================================================ */

create table if not exists public.pedidos (
  id           bigint generated always as identity primary key,
  numero       text not null unique,
  usuario_id   uuid references public.perfiles(id) on delete set null,

  nombre       text not null,
  telefono     text not null,
  email        text not null,

  entrega      text not null check (entrega in ('domicilio', 'retiro')),
  direccion    text,

  metodo_pago  text not null default 'transferencia',
  estado_pago  text not null default 'pendiente' check (estado_pago in ('pendiente', 'pagado', 'cancelado')),

  items        jsonb not null,
  subtotal     numeric(12,2) not null check (subtotal >= 0),
  envio_monto  numeric(12,2), -- null = "a coordinar"
  total        numeric(12,2) not null check (total >= 0),

  creado_en    timestamptz not null default now()
);

create index if not exists idx_pedidos_usuario on public.pedidos(usuario_id, creado_en desc);
create index if not exists idx_pedidos_estado on public.pedidos(estado_pago);

alter table public.pedidos enable row level security;

-- El dueño del pedido puede verlo; el admin puede ver todos.
drop policy if exists "pedidos_select_propio_o_admin" on public.pedidos;
create policy "pedidos_select_propio_o_admin"
  on public.pedidos for select
  using (usuario_id = auth.uid() or public.is_admin());

-- Un usuario logueado solo puede crear pedidos a SU propio nombre
-- (o el admin, por si necesita cargar uno a mano).
drop policy if exists "pedidos_insert_propio_o_admin" on public.pedidos;
create policy "pedidos_insert_propio_o_admin"
  on public.pedidos for insert
  with check (usuario_id = auth.uid() or public.is_admin());

-- Solo el admin puede cambiar el estado de pago.
drop policy if exists "pedidos_update_admin" on public.pedidos;
create policy "pedidos_update_admin"
  on public.pedidos for update
  using (public.is_admin())
  with check (public.is_admin());

/* ============================================================
   FIN — Después de correr esto ya podés usar:
   - pedidos.html   → "Mis pedidos" (el cliente logueado)
   - pago.html       → retomar el pago de un pedido pendiente
   - admin.html → Pedidos → marcar como pagado / cancelado
   ============================================================ */
