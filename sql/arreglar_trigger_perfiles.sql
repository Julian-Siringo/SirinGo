/* ============================================================
   DIAGNÓSTICO Y ARREGLO: perfiles que no se crean al registrarse
   ------------------------------------------------------------
   Si te registrás en la web y el usuario aparece en
   Authentication → Users pero NO aparece en Table Editor →
   perfiles, es porque el trigger "on_auth_user_created" (el que
   copia los datos a "perfiles" apenas Supabase Auth crea un
   usuario) no existe o no se llegó a ejecutar en tu proyecto.

   Este script:
   1) Vuelve a crear la función y el trigger (no rompe nada si
      ya existían: los reemplaza).
   2) Rescata a cualquier usuario que ya esté en auth.users pero
      no tenga fila en perfiles (por ejemplo, el que acabás de
      crear), usando los datos de nombre/apellido que mandó al
      registrarse.

   Ejecutar TODO en: Supabase → SQL Editor → New query → Run
   ============================================================ */

-- ---------- Paso 1: recrear la función y el trigger ----------
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
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Paso 2: rescatar usuarios sin perfil ----------
insert into public.perfiles (id, nombre, apellido, email, rol, fecha_registro)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'nombre', ''),
  coalesce(u.raw_user_meta_data->>'apellido', ''),
  u.email,
  'usuario',
  u.created_at
from auth.users u
left join public.perfiles p on p.id = u.id
where p.id is null;

-- ---------- Paso 3: verificar que ya está ----------
select id, nombre, apellido, email, rol, fecha_registro
from public.perfiles
order by fecha_registro desc;
