-- Kads Studio: ejecutar en el Supabase propio de Kads, después de supabase-kads.sql.
-- No cambia usuarios, claves, roles ni proyectos existentes. Los no administradores empiezan sin secciones asignadas.
alter table public.kads_usuarios add column if not exists secciones text[] not null default '{}';

create or replace function public.kads_mi_acceso()
returns table(rol text,nombre text,secciones text[])
language plpgsql security definer set search_path = public
as $$
begin
 perform public.kads_mi_rol();
 return query select k.rol,k.nombre,k.secciones from public.kads_usuarios k where k.id=auth.uid();
end;
$$;
create or replace function public.kads_lista_accesos()
returns table(id uuid,correo text,nombre text,rol text,creado timestamptz,secciones text[])
language plpgsql security definer set search_path = public
as $$
begin
 if not exists(select 1 from public.kads_usuarios k where k.id=auth.uid() and k.rol='owner') then raise exception 'Solo el administrador' using errcode='42501';end if;
 return query select k.id,k.correo,k.nombre,k.rol,k.creado,k.secciones from public.kads_usuarios k order by (k.rol='pendiente') desc,k.creado;
end;
$$;
create or replace function public.kads_cambiar_acceso(p_usuario uuid,p_rol text,p_secciones text[])
returns void
language plpgsql security definer set search_path = public
as $$
begin
 if not exists(select 1 from public.kads_usuarios k where k.id=auth.uid() and k.rol='owner') then raise exception 'Solo el administrador' using errcode='42501';end if;
 if p_usuario=auth.uid() or exists(select 1 from public.kads_usuarios k where k.id=p_usuario and k.rol='owner') then raise exception 'No puedes modificar el acceso del administrador';end if;
 if p_rol not in ('socio','empleado','pendiente','rechazado') then raise exception 'Ese rol no existe';end if;
 if p_secciones is null or exists(select 1 from unnest(p_secciones) s where s is null or s<>all(array['inicio','oficina','imagenes','chat-imagenes','investigacion','videos','embudo','landings','sep','productos','anuncios','editor','biblioteca','carpetas','shopify','tablero','saldo','aprendizajes','inspiracion'])) then raise exception 'Secciones inválidas';end if;
 update public.kads_usuarios set rol=p_rol,secciones=array(select distinct s from unnest(p_secciones) s order by s),cambiado=now() where kads_usuarios.id=p_usuario;
 if not found then raise exception 'Ese usuario no ha entrado a Kads';end if;
end;
$$;
revoke all on function public.kads_mi_acceso() from public,anon;
revoke all on function public.kads_lista_accesos() from public,anon;
revoke all on function public.kads_cambiar_acceso(uuid,text,text[]) from public,anon;
grant execute on function public.kads_mi_acceso() to authenticated;
grant execute on function public.kads_lista_accesos() to authenticated;
grant execute on function public.kads_cambiar_acceso(uuid,text,text[]) to authenticated;
