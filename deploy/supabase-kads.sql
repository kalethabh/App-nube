-- KADS STUDIO EN EL SUPABASE DEL CENTRO DE CONTROL (2026-11-25a)
-- Se corre UNA vez: Supabase › tu proyecto «centro-de-control» › SQL Editor › New query › pega todo › Run.
-- Crea solo lo de Kads (la tabla kads_usuarios y 3 funciones). No toca las tablas ni los usuarios del Centro de Control:
-- las cuentas son las mismas (mismo correo y clave), los roles de Kads van aparte.
--
--   · el PRIMERO que entra a Kads queda dueño (owner); los demás, «pendiente» hasta que el dueño los apruebe;
--   · nadie lee ni escribe la tabla directo (seguridad por filas sin políticas): todo pasa por las funciones, que
--     revisan quién pide (auth.uid()) y, para la lista y los cambios, que sea el dueño.
-- Se puede correr otra vez sin problema.

create table if not exists public.kads_usuarios (
  id uuid primary key references auth.users (id) on delete cascade,
  correo text,
  nombre text,
  rol text not null default 'pendiente' check (rol in ('owner', 'socio', 'empleado', 'pendiente', 'rechazado')),
  creado timestamptz not null default now(),
  cambiado timestamptz not null default now()
);
alter table public.kads_usuarios enable row level security;
revoke all on public.kads_usuarios from anon, authenticated;

-- Mi rol en Kads (la primera vez me registra: el primero de todos queda dueño).
create or replace function public.kads_mi_rol()
returns table (rol text, nombre text)
language plpgsql security definer set search_path = public
as $$
declare
  yo uuid := auth.uid();
begin
  if yo is null then
    raise exception 'Sin sesión' using errcode = '28000';
  end if;
  if not exists (select 1 from kads_usuarios k where k.id = yo) then
    lock table kads_usuarios in share row exclusive mode;
    insert into kads_usuarios (id, correo, nombre, rol)
    select u.id, u.email,
           coalesce(nullif(u.raw_user_meta_data ->> 'nombre', ''), nullif(u.raw_user_meta_data ->> 'name', ''), split_part(u.email, '@', 1)),
           case when exists (select 1 from kads_usuarios k2 where k2.rol = 'owner') then 'pendiente' else 'owner' end
    from auth.users u where u.id = yo
    on conflict (id) do nothing;
  end if;
  return query select k.rol, k.nombre from kads_usuarios k where k.id = yo;
end;
$$;

-- La lista de usuarios de Kads (solo el dueño).
create or replace function public.kads_lista_usuarios()
returns table (id uuid, correo text, nombre text, rol text, creado timestamptz)
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from kads_usuarios k where k.id = auth.uid() and k.rol = 'owner') then
    raise exception 'Solo el dueño' using errcode = '42501';
  end if;
  return query select k.id, k.correo, k.nombre, k.rol, k.creado from kads_usuarios k order by (k.rol = 'pendiente') desc, k.creado;
end;
$$;

-- Cambiar el rol de alguien (solo el dueño; nunca el suyo ni a «owner»).
create or replace function public.kads_cambiar_rol(p_usuario uuid, p_rol text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from kads_usuarios k where k.id = auth.uid() and k.rol = 'owner') then
    raise exception 'Solo el dueño' using errcode = '42501';
  end if;
  if p_usuario = auth.uid() then
    raise exception 'No puedes cambiar tu propio rol';
  end if;
  if p_rol not in ('socio', 'empleado', 'pendiente', 'rechazado') then
    raise exception 'Ese rol no existe';
  end if;
  update kads_usuarios set rol = p_rol, cambiado = now() where id = p_usuario;
  if not found then
    raise exception 'Ese usuario no ha entrado a Kads';
  end if;
end;
$$;

revoke all on function public.kads_mi_rol() from public, anon;
revoke all on function public.kads_lista_usuarios() from public, anon;
revoke all on function public.kads_cambiar_rol(uuid, text) from public, anon;
grant execute on function public.kads_mi_rol() to authenticated;
grant execute on function public.kads_lista_usuarios() to authenticated;
grant execute on function public.kads_cambiar_rol(uuid, text) to authenticated;
