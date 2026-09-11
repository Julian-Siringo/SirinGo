/* ============================================================
   SirinGo — Esquema completo de base de datos para Supabase
   ------------------------------------------------------------
   Ejecutar TODO este archivo de una sola vez en:
   Supabase → SQL Editor → New query → pegar → Run
   ============================================================ */

-- ============================================================
-- 0. EXTENSIONES
-- ============================================================
create extension if not exists "pgcrypto";


-- ============================================================
-- 1. TABLAS
-- ============================================================

-- ---------- PERFILES (vinculada a auth.users) ----------
create table if not exists public.perfiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  nombre         text not null,
  apellido       text not null,
  email          text not null unique,
  rol            text not null default 'usuario' check (rol in ('admin', 'usuario')),
  fecha_registro timestamptz not null default now()
);

-- ---------- RUBROS ----------
create table if not exists public.rubros (
  id     bigint generated always as identity primary key,
  nombre text not null unique
);

-- ---------- MARCAS ----------
create table if not exists public.marcas (
  id     bigint generated always as identity primary key,
  nombre text not null unique
);

-- ---------- PRODUCTOS ----------
create table if not exists public.productos (
  id              bigint generated always as identity primary key,
  nombre          text not null,
  rubro_id        bigint not null references public.rubros(id) on delete restrict,
  marca_id        bigint not null references public.marcas(id) on delete restrict,
  descripcion     text not null default '',
  precio          numeric(12,2) not null check (precio > 0),
  imagen          text,
  stock           integer not null default 0 check (stock >= 0),
  fecha_creacion  timestamptz not null default now()
);

create index if not exists idx_productos_rubro on public.productos(rubro_id);
create index if not exists idx_productos_marca on public.productos(marca_id);

-- ---------- CONSULTAS (formulario de contacto) ----------
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
-- 2. FUNCIONES
-- ============================================================

-- ---------- is_admin(): evita recursión de RLS en "perfiles" ----------
-- SECURITY DEFINER le permite leer perfiles sin pasar por sus propias
-- políticas RLS, por eso NO genera recursión infinita.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.perfiles
    where id = auth.uid() and rol = 'admin'
  );
$$;

-- ---------- handle_new_user(): crea el perfil al registrarse ----------
-- Se dispara automáticamente cuando Supabase Auth crea un usuario nuevo.
-- El rol SIEMPRE se fuerza a 'usuario': nadie puede registrarse como
-- admin desde el frontend.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfiles (id, nombre, apellido, email, rol)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', ''),
    coalesce(new.raw_user_meta_data->>'apellido', ''),
    new.email,
    'usuario'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- evitar_autoascenso_admin(): nadie cambia su propio rol ----------
-- Un usuario puede actualizar su propio perfil (nombre/apellido), pero
-- si intenta cambiar "rol" y no es admin, el cambio se ignora. Cuando
-- se ejecuta desde el SQL Editor (sin auth.uid(), por ejemplo con la
-- service_role), el cambio de rol se permite sin restricciones.
create or replace function public.evitar_autoascenso_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
     and new.rol is distinct from old.rol
     and not public.is_admin() then
    new.rol := old.rol;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_evitar_autoascenso on public.perfiles;
create trigger trg_evitar_autoascenso
  before update on public.perfiles
  for each row execute function public.evitar_autoascenso_admin();


-- ============================================================
-- 3. ROW LEVEL SECURITY (RLS)
-- ============================================================

alter table public.perfiles       enable row level security;
alter table public.rubros         enable row level security;
alter table public.marcas         enable row level security;
alter table public.productos      enable row level security;
alter table public.consultas      enable row level security;

-- ---------- PERFILES ----------
drop policy if exists "perfiles_select_propio_o_admin" on public.perfiles;
create policy "perfiles_select_propio_o_admin"
  on public.perfiles for select
  using (id = auth.uid() or public.is_admin());

drop policy if exists "perfiles_update_propio_o_admin" on public.perfiles;
create policy "perfiles_update_propio_o_admin"
  on public.perfiles for update
  using (id = auth.uid() or public.is_admin());

-- No se define policy de INSERT: los perfiles se crean únicamente
-- mediante el trigger handle_new_user() (SECURITY DEFINER), nunca
-- directamente desde el frontend.

-- ---------- RUBROS ----------
drop policy if exists "rubros_select_publico" on public.rubros;
create policy "rubros_select_publico"
  on public.rubros for select
  using (true);

drop policy if exists "rubros_insert_admin" on public.rubros;
create policy "rubros_insert_admin"
  on public.rubros for insert
  with check (public.is_admin());

drop policy if exists "rubros_update_admin" on public.rubros;
create policy "rubros_update_admin"
  on public.rubros for update
  using (public.is_admin());

drop policy if exists "rubros_delete_admin" on public.rubros;
create policy "rubros_delete_admin"
  on public.rubros for delete
  using (public.is_admin());

-- ---------- MARCAS ----------
drop policy if exists "marcas_select_publico" on public.marcas;
create policy "marcas_select_publico"
  on public.marcas for select
  using (true);

drop policy if exists "marcas_insert_admin" on public.marcas;
create policy "marcas_insert_admin"
  on public.marcas for insert
  with check (public.is_admin());

drop policy if exists "marcas_update_admin" on public.marcas;
create policy "marcas_update_admin"
  on public.marcas for update
  using (public.is_admin());

drop policy if exists "marcas_delete_admin" on public.marcas;
create policy "marcas_delete_admin"
  on public.marcas for delete
  using (public.is_admin());

-- ---------- PRODUCTOS ----------
drop policy if exists "productos_select_publico" on public.productos;
create policy "productos_select_publico"
  on public.productos for select
  using (true);

drop policy if exists "productos_insert_admin" on public.productos;
create policy "productos_insert_admin"
  on public.productos for insert
  with check (public.is_admin());

drop policy if exists "productos_update_admin" on public.productos;
create policy "productos_update_admin"
  on public.productos for update
  using (public.is_admin());

drop policy if exists "productos_delete_admin" on public.productos;
create policy "productos_delete_admin"
  on public.productos for delete
  using (public.is_admin());

-- ---------- CONSULTAS ----------
drop policy if exists "consultas_insert_publico" on public.consultas;
create policy "consultas_insert_publico"
  on public.consultas for insert
  with check (usuario_id = auth.uid() or usuario_id is null);

drop policy if exists "consultas_select_admin" on public.consultas;
create policy "consultas_select_admin"
  on public.consultas for select
  using (public.is_admin());

drop policy if exists "consultas_update_admin" on public.consultas;
create policy "consultas_update_admin"
  on public.consultas for update
  using (public.is_admin())
  with check (public.is_admin());


-- ============================================================
-- 4. DATOS INICIALES
-- ============================================================

insert into public.rubros (nombre) values
  ('Lavavajillas'),
  ('Desinfectantes'),
  ('Limpieza de pisos'),
  ('Desengrasantes'),
  ('Higiene personal'),
  ('Accesorios de limpieza'),
  ('Aromatizantes')
on conflict (nombre) do nothing;

insert into public.marcas (nombre) values
  ('LimpioMax'),
  ('Brillo'),
  ('HogarPlus'),
  ('EcoClean'),
  ('Sanit')
on conflict (nombre) do nothing;

-- Productos de ejemplo (migrados desde js/data.js).
-- Se resuelven rubro_id / marca_id por nombre para no depender de ids fijos.
-- La columna "imagen" queda en null: se completa subiendo una imagen real
-- desde el panel de administración (ver sql/storage_productos.sql).
insert into public.productos (nombre, rubro_id, marca_id, descripcion, precio, stock)
select v.nombre, r.id, m.id, v.descripcion, v.precio, v.stock
from (values
  ('Detergente Ultra Concentrado', 'Lavavajillas', 'LimpioMax', 'Detergente para lavavajillas con acción desengrasante rápida. Rinde hasta 300 platos por botella y cuida tus manos.', 3500, 40),
  ('Lavandina Concentrada 1L', 'Desinfectantes', 'Brillo', 'Desinfectante de alto poder bactericida. Ideal para superficies, baños y cocinas.', 2900, 35),
  ('Limpiador de Pisos Lavanda', 'Limpieza de pisos', 'HogarPlus', 'Limpia y perfuma pisos de cerámica, porcelanato y madera. Fragancia duradera.', 4200, 30),
  ('Desengrasante Industrial 5L', 'Desengrasantes', 'LimpioMax', 'Fórmula de alto rendimiento para cocinas industriales, campanas y hornos.', 5800, 20),
  ('Jabón Líquido para Manos', 'Higiene personal', 'Sanit', 'Jabón antibacterial de uso frecuente, pH neutro, apto para dispensadores.', 2100, 50),
  ('Guantes de Látex x10', 'Accesorios de limpieza', 'HogarPlus', 'Guantes resistentes para tareas de limpieza doméstica y comercial. Talle único.', 1800, 60),
  ('Limpiador Multiuso EcoClean', 'Limpieza de pisos', 'EcoClean', 'Limpiador biodegradable apto para todo tipo de superficies. Bajo impacto ambiental.', 3300, 45),
  ('Desinfectante en Aerosol', 'Desinfectantes', 'Sanit', 'Elimina el 99,9% de gérmenes y bacterias en superficies y ambientes.', 3100, 38),
  ('Trapo de Piso Microfibra', 'Accesorios de limpieza', 'HogarPlus', 'Alta absorción, no deja pelusa, apto para todo tipo de pisos.', 2500, 55),
  ('Desengrasante para Hornos', 'Desengrasantes', 'Brillo', 'Remueve grasa quemada y residuos difíciles en minutos.', 4600, 25),
  ('Aromatizante de Ambientes', 'Aromatizantes', 'EcoClean', 'Fragancia de larga duración para hogares, oficinas y locales comerciales.', 2700, 42),
  ('Detergente para Ropa 3L', 'Lavavajillas', 'LimpioMax', 'Detergente líquido concentrado, cuida las fibras y mantiene los colores.', 6200, 18),
  ('Alcohol en Gel 500ml', 'Higiene personal', 'Sanit', 'Higienizante de manos de uso frecuente, no reseca la piel.', 1900, 70),
  ('Escoba y Pala Combo', 'Accesorios de limpieza', 'HogarPlus', 'Set de escoba y pala de plástico reforzado, mango ergonómico.', 3900, 22)
) as v(nombre, rubro_nombre, marca_nombre, descripcion, precio, stock)
join public.rubros r on r.nombre = v.rubro_nombre
join public.marcas m on m.nombre = v.marca_nombre
where not exists (select 1 from public.productos p where p.nombre = v.nombre);


-- ============================================================
-- 5. STORAGE: bucket e imágenes de productos
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'productos',
  'productos',
  true,
  5242880,
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "productos_storage_select_publico" on storage.objects;
create policy "productos_storage_select_publico"
  on storage.objects for select
  using (bucket_id = 'productos');

drop policy if exists "productos_storage_insert_admin" on storage.objects;
create policy "productos_storage_insert_admin"
  on storage.objects for insert
  with check (bucket_id = 'productos' and public.is_admin());

drop policy if exists "productos_storage_update_admin" on storage.objects;
create policy "productos_storage_update_admin"
  on storage.objects for update
  using (bucket_id = 'productos' and public.is_admin())
  with check (bucket_id = 'productos' and public.is_admin());

drop policy if exists "productos_storage_delete_admin" on storage.objects;
create policy "productos_storage_delete_admin"
  on storage.objects for delete
  using (bucket_id = 'productos' and public.is_admin());

/* ============================================================
   FIN DEL SCRIPT
   ------------------------------------------------------------
   Después de ejecutarlo:
   1) Creá el usuario administrador desde
      Authentication → Users → Add user (ver instrucciones).
   2) Ejecutá el UPDATE que asigna rol = 'admin' a su perfil
      (también está en las instrucciones finales).
   ============================================================ */
