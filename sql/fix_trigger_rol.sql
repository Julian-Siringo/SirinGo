/* ============================================================
   FIX: evitar_autoascenso_admin()
   ------------------------------------------------------------
   El trigger original bloqueaba CUALQUIER cambio de rol que no
   viniera de un admin logueado, pero eso también bloqueaba los
   UPDATE hechos a mano desde el SQL Editor de Supabase (donde
   no hay un auth.uid() asociado). Este fix deja pasar el cambio
   cuando no hay un usuario autenticado en el contexto (es decir,
   cuando se ejecuta desde el SQL Editor o con la service_role),
   y sigue bloqueando el auto-ascenso cuando lo intenta un usuario
   normal desde la propia web.

   Ejecutar este bloque completo en: Supabase → SQL Editor → Run
   ============================================================ */

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

-- Ahora sí, volvé a intentar el ascenso a admin:
update public.perfiles
set rol = 'admin'
where email = 'admin@gmail.com';

-- Verificá el resultado:
select nombre, apellido, email, rol
from public.perfiles
where email = 'admin@gmail.com';
