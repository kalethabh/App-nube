-- Solo en el Supabase PROPIO de Kads. Los mensajes contienen sobres cifrados, nunca sesiones en claro.
begin;
create table if not exists public.kads_motor_lider (
 id integer primary key check(id=1), dueno uuid, cerca bigint not null default 0, vence timestamptz not null default now()
);
insert into public.kads_motor_lider(id) values(1) on conflict do nothing;
create table if not exists public.kads_motor_pedidos (
 id uuid primary key, cliente text not null, sobre text not null,
 estado text not null default 'pendiente' check(estado in ('pendiente','trabajando','listo','incierto')),
 cerca bigint, respuesta text, creado timestamptz not null default now(), vence timestamptz not null
);
create index if not exists kads_motor_pendientes on public.kads_motor_pedidos(estado,creado);
create index if not exists kads_motor_clientes on public.kads_motor_pedidos(cliente,creado);
create table if not exists public.kads_motor_tramos (
 pedido uuid references public.kads_motor_pedidos(id) on delete cascade,
 n integer not null, sobre text not null, primary key(pedido,n)
);
create table if not exists public.kads_motor_estado (
 id integer primary key check(id=1), objeto text not null, cerca bigint not null, actualizado timestamptz not null default now()
);
create table if not exists public.kads_motor_subidas (
 id uuid primary key, usuario uuid not null, ruta text not null, metodo text not null, objeto text not null,
 usado boolean not null default false, vence timestamptz not null default(now()+interval '10 minutes')
);
alter table public.kads_motor_lider enable row level security;
alter table public.kads_motor_pedidos enable row level security;
alter table public.kads_motor_tramos enable row level security;
alter table public.kads_motor_estado enable row level security;
alter table public.kads_motor_subidas enable row level security;
revoke all on public.kads_motor_lider,public.kads_motor_pedidos,public.kads_motor_tramos,public.kads_motor_estado,public.kads_motor_subidas from anon, authenticated;
grant all on public.kads_motor_lider,public.kads_motor_pedidos,public.kads_motor_tramos,public.kads_motor_estado,public.kads_motor_subidas to service_role;

create or replace function public.kads_motor_arrendar(p_dueno uuid) returns bigint language plpgsql security definer set search_path=public as $$
declare f bigint;
begin
 update kads_motor_lider set cerca=cerca+case when dueno=p_dueno and vence>now() then 0 else 1 end,
 dueno=p_dueno,vence=now()+interval '90 seconds' where id=1 and (dueno=p_dueno or vence<=now()) returning cerca into f;
 if f is not null then
  -- No repetir una acción posiblemente cobrada tras perder el proceso anterior.
  update kads_motor_pedidos set estado='incierto' where estado='trabajando' and cerca<>f;
 end if;
 return f;
end $$;
create or replace function public.kads_motor_encolar(p_id uuid,p_cliente text,p_sobre text,p_limite integer default 30) returns uuid language plpgsql security definer set search_path=public as $$
begin
 if octet_length(p_sobre)>3000000 or length(p_cliente)>128 then raise exception 'pedido demasiado grande'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_cliente,0));
 if (select count(*) from kads_motor_pedidos where cliente=p_cliente and creado>now()-interval '1 minute')>=least(p_limite,600) then raise exception 'demasiados pedidos'; end if;
 insert into kads_motor_pedidos(id,cliente,sobre,vence) values(p_id,p_cliente,p_sobre,now()+interval '15 minutes');
 return p_id;
end $$;
create or replace function public.kads_motor_tomar(p_dueno uuid,p_cerca bigint) returns setof public.kads_motor_pedidos language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from kads_motor_lider where id=1 and dueno=p_dueno and cerca=p_cerca and vence>now()) then return; end if;
 return query update kads_motor_pedidos set estado='trabajando',cerca=p_cerca where id=(select id from kads_motor_pedidos where estado='pendiente' and vence>now() order by creado for update skip locked limit 1) returning *;
end $$;
create or replace function public.kads_motor_contestar(p_dueno uuid,p_cerca bigint,p_id uuid,p_sobre text,p_final boolean default true) returns boolean language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from kads_motor_lider where id=1 and dueno=p_dueno and cerca=p_cerca and vence>now()) then return false; end if;
 update kads_motor_pedidos set respuesta=p_sobre,estado=case when p_final then 'listo' else 'trabajando' end where id=p_id and cerca=p_cerca and estado='trabajando';
 return found;
end $$;
create or replace function public.kads_motor_tramo(p_dueno uuid,p_cerca bigint,p_id uuid,p_n integer,p_sobre text) returns boolean language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from kads_motor_lider where id=1 and dueno=p_dueno and cerca=p_cerca and vence>now()) then return false; end if;
 insert into kads_motor_tramos(pedido,n,sobre) select p_id,p_n,p_sobre where exists(select 1 from kads_motor_pedidos where id=p_id and cerca=p_cerca and estado='trabajando');
 return found;
end $$;
create or replace function public.kads_motor_guardar(p_dueno uuid,p_cerca bigint,p_objeto text) returns boolean language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from kads_motor_lider where id=1 and dueno=p_dueno and cerca=p_cerca and vence>now()) then return false; end if;
 insert into kads_motor_estado(id,objeto,cerca) values(1,p_objeto,p_cerca) on conflict(id) do update set objeto=excluded.objeto,cerca=excluded.cerca,actualizado=now();
 return true;
end $$;
create or replace function public.kads_motor_soltar(p_dueno uuid,p_cerca bigint) returns boolean language plpgsql security definer set search_path=public as $$
begin
 update kads_motor_lider set vence=now() where id=1 and dueno=p_dueno and cerca=p_cerca;
 return found;
end $$;
create or replace function public.kads_motor_usar_subida(p_id uuid,p_usuario uuid,p_ruta text,p_metodo text) returns text language plpgsql security definer set search_path=public as $$
declare o text;
begin
 update kads_motor_subidas set usado=true where id=p_id and usuario=p_usuario and ruta=p_ruta and metodo=p_metodo and not usado and vence>now() returning objeto into o;
 return o;
end $$;
create or replace function public.kads_motor_nueva_subida(p_id uuid,p_usuario uuid,p_ruta text,p_metodo text,p_objeto text) returns boolean language plpgsql security definer set search_path=public as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(p_usuario::text,1));
 if (select count(*) from kads_motor_subidas where usuario=p_usuario and vence>now()+interval '9 minutes')>=30 then raise exception 'demasiadas subidas'; end if;
 insert into kads_motor_subidas(id,usuario,ruta,metodo,objeto) values(p_id,p_usuario,p_ruta,p_metodo,p_objeto);
 return true;
end $$;
revoke all on function public.kads_motor_arrendar(uuid),public.kads_motor_encolar(uuid,text,text,integer),public.kads_motor_tomar(uuid,bigint),public.kads_motor_contestar(uuid,bigint,uuid,text,boolean),public.kads_motor_tramo(uuid,bigint,uuid,integer,text),public.kads_motor_guardar(uuid,bigint,text),public.kads_motor_usar_subida(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.kads_motor_arrendar(uuid),public.kads_motor_encolar(uuid,text,text,integer),public.kads_motor_tomar(uuid,bigint),public.kads_motor_contestar(uuid,bigint,uuid,text,boolean),public.kads_motor_tramo(uuid,bigint,uuid,integer,text),public.kads_motor_guardar(uuid,bigint,text),public.kads_motor_usar_subida(uuid,uuid,text,text) to service_role;
revoke all on function public.kads_motor_soltar(uuid,bigint) from public,anon,authenticated;
grant execute on function public.kads_motor_soltar(uuid,bigint) to service_role;
revoke all on function public.kads_motor_nueva_subida(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.kads_motor_nueva_subida(uuid,uuid,text,text,text) to service_role;
-- Privados: nadie obtiene una política de lectura pública; solo enlaces firmados de corta duración.
insert into storage.buckets(id,name,public) values('kads-motor','kads-motor',false),('kads-transferencias','kads-transferencias',false) on conflict(id) do update set public=false;
-- El límite global del proyecto también debe permitir este tamaño (Free admite hasta 50 MB por archivo).
update storage.buckets set file_size_limit=2147483648 where id='kads-transferencias';
commit;
