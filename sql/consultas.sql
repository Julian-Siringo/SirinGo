/* ============================================================
   SirinGo — Tabla "consultas" (formulario de contacto)
   ------------------------------------------------------------
   Ejecutar en: Supabase → SQL Editor → New query → Run
   (No pisa nada de lo que ya tenés; se puede correr en cualquier
   momento sobre la base existente).
   ============================================================ */

-- ============================================================
-- 1. TABLA
-- ============================================================
create table if not exists public.consultas (
  id             bigint generated always as identity primary key,
  nombre         text not null,
  email          text not null,
  asunto         text not null,
  mensaje        text not null,
  usuario_id     uuid references public.perfiles(id) on delete set null,
  estado         text not null default 'pendiente' check (estado in ('pendiente', 'visto')),
  fecha_creacion timestamptz not null default now()
);

create index if not exists idx_consultas_estado on public.consultas(estado);
create index if not exists idx_consultas_fecha on public.consultas(fecha_creacion);


-- ============================================================
-- 2. ROW LEVEL SECURITY (RLS)
-- ============================================================
alter table public.consultas enable row level security;

-- Cualquiera puede enviar una consulta desde el formulario de
-- contacto, esté logueado o no (usuario_id queda en null si es
-- un visitante anónimo). Reutilizamos public.is_admin(), ya
-- creada en supabase_schema.sql.
drop policy if exists "consultas_insert_publico" on public.consultas;
create policy "consultas_insert_publico"
  on public.consultas for insert
  with check (usuario_id = auth.uid() or usuario_id is null);

-- Solo el administrador puede leer las consultas recibidas.
drop policy if exists "consultas_select_admin" on public.consultas;
create policy "consultas_select_admin"
  on public.consultas for select
  using (public.is_admin());

-- Solo el administrador puede cambiar el estado (pendiente/visto).
drop policy if exists "consultas_update_admin" on public.consultas;
create policy "consultas_update_admin"
  on public.consultas for update
  using (public.is_admin())
  with check (public.is_admin());

/* ============================================================
   FIN — Después de correr esto, el formulario de "Contacto" en
   index.html va a guardar cada consulta en esta tabla, y el
   panel de administración va a tener una sección "Consultas"
   para leerlas y marcarlas como vistas.
   ============================================================ */
