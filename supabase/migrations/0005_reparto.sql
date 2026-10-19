-- ===========================================================================
-- Reparto en la nube: repartidores, sus clientes, liquidaciones (con ítems) y
-- cobros. Va por FUERA de la caja del local: no son ventas.
--
-- Referencias "blandas" (sin FK) salvo ítems -> liquidación, que viajan juntos:
-- la caja sube de a lotes y un cliente puede llegar después que su liquidación.
-- Saldo de un cliente = ítems de liquidaciones confirmadas - cobros confirmados.
--
-- ORDEN DE DESPLIEGUE: aplicar ANTES de desplegar la versión de `push` que
-- guarda el reparto. Idempotente.
-- ===========================================================================

create table if not exists repartidores (
  id             uuid primary key,
  caja_id        uuid references cajas(id),
  nombre         text,
  telefono       text,
  activo         integer,
  created_at     timestamptz,
  actualizado_at timestamptz not null default now()
);

create table if not exists reparto_clientes (
  id             uuid primary key,
  caja_id        uuid references cajas(id),
  repartidor_id  uuid,
  nombre         text,
  telefono       text,
  direccion      text,
  activo         integer,
  created_at     timestamptz,
  actualizado_at timestamptz not null default now()
);
create index if not exists idx_rep_clientes_rep on reparto_clientes(repartidor_id);

create table if not exists reparto_liquidaciones (
  id                    uuid primary key,
  caja_id               uuid references cajas(id),
  numero                integer,
  repartidor_id         uuid,
  fecha                 date,          -- día del reparto
  total_vendido         numeric,
  cobrado_efectivo      numeric,
  cobrado_transferencia numeric,
  efectivo_entregado    numeric,
  diferencia            numeric,       -- entregado - cobrado en efectivo
  notas                 text,
  estado                text,          -- confirmada | anulada
  cargado_por           text,
  anulada_por           text,
  anulada_at            timestamptz,
  created_at            timestamptz,
  actualizado_at        timestamptz not null default now()
);
create index if not exists idx_rep_liq_fecha on reparto_liquidaciones(fecha);
create index if not exists idx_rep_liq_rep on reparto_liquidaciones(repartidor_id);

create table if not exists reparto_items (
  id              uuid primary key,
  liquidacion_id  uuid references reparto_liquidaciones(id) on delete cascade,
  cliente_id      uuid,
  producto_nombre text,
  unidad          text,               -- kg | u
  cantidad        numeric,
  precio_unitario numeric,
  subtotal        numeric
);
create index if not exists idx_rep_items_liq on reparto_items(liquidacion_id);
create index if not exists idx_rep_items_cliente on reparto_items(cliente_id);

create table if not exists reparto_cobros (
  id             uuid primary key,
  caja_id        uuid references cajas(id),
  liquidacion_id uuid,                -- null = pago suelto en el local
  cliente_id     uuid,
  fecha          date,
  monto          numeric,
  metodo         text,                -- efectivo | transferencia
  estado         text,                -- confirmado | anulado
  cargado_por    text,
  created_at     timestamptz,
  actualizado_at timestamptz not null default now()
);
create index if not exists idx_rep_cobros_cliente on reparto_cobros(cliente_id);
create index if not exists idx_rep_cobros_fecha on reparto_cobros(fecha);

alter table repartidores          enable row level security;
alter table reparto_clientes      enable row level security;
alter table reparto_liquidaciones enable row level security;
alter table reparto_items         enable row level security;
alter table reparto_cobros        enable row level security;

-- ---------------------------------------------------------------------------
-- Métricas del reparto. Mismas firmas que el resto del dashboard ([p_desde,
-- p_hasta) en UTC, p_caja NULL = todas); se pasan a días de Argentina porque
-- liquidaciones y cobros se guardan por día.
-- ---------------------------------------------------------------------------

create or replace function dash_reparto_resumen(p_desde timestamptz, p_hasta timestamptz, p_caja uuid default null)
returns table (liquidaciones bigint, vendido numeric, kilos numeric, unidades numeric,
               cobrado_efectivo numeric, cobrado_transferencia numeric, diferencia_efectivo numeric, deuda_clientes numeric)
language sql stable set search_path = public as $$
  with r as (
    select (p_desde at time zone 'America/Argentina/Buenos_Aires')::date as d,
           (p_hasta at time zone 'America/Argentina/Buenos_Aires')::date as h
  ), l as (
    select l.* from reparto_liquidaciones l, r
    where l.estado = 'confirmada' and l.fecha >= r.d and l.fecha < r.h
      and (p_caja is null or l.caja_id = p_caja)
  ), saldos as (
    select c.id,
           coalesce((select sum(i.subtotal) from reparto_items i join reparto_liquidaciones x on x.id = i.liquidacion_id
                     where i.cliente_id = c.id and x.estado = 'confirmada'), 0)
         - coalesce((select sum(k.monto) from reparto_cobros k where k.cliente_id = c.id and k.estado = 'confirmado'), 0) as saldo
    from reparto_clientes c where (p_caja is null or c.caja_id = p_caja)
  )
  select (select count(*) from l)::bigint,
         coalesce((select sum(total_vendido) from l), 0),
         coalesce((select sum(i.cantidad) from reparto_items i join l on l.id = i.liquidacion_id where i.unidad = 'kg'), 0),
         coalesce((select sum(i.cantidad) from reparto_items i join l on l.id = i.liquidacion_id where i.unidad = 'u'), 0),
         coalesce((select sum(k.monto) from reparto_cobros k, r where k.estado = 'confirmado' and k.metodo = 'efectivo'
                     and k.fecha >= r.d and k.fecha < r.h and (p_caja is null or k.caja_id = p_caja)), 0),
         coalesce((select sum(k.monto) from reparto_cobros k, r where k.estado = 'confirmado' and k.metodo = 'transferencia'
                     and k.fecha >= r.d and k.fecha < r.h and (p_caja is null or k.caja_id = p_caja)), 0),
         coalesce((select sum(diferencia) from l), 0),
         coalesce((select sum(greatest(saldo, 0)) from saldos), 0);
$$;

create or replace function dash_reparto_por_mes(p_desde timestamptz, p_hasta timestamptz, p_caja uuid default null)
returns table (mes date, liquidaciones bigint, vendido numeric, kilos numeric, cobrado numeric)
language sql stable set search_path = public as $$
  with r as (
    select (p_desde at time zone 'America/Argentina/Buenos_Aires')::date as d,
           (p_hasta at time zone 'America/Argentina/Buenos_Aires')::date as h
  ), v as (
    select date_trunc('month', l.fecha)::date as mes, count(distinct l.id) as liq, sum(i.subtotal) as vendido,
           sum(case when i.unidad = 'kg' then i.cantidad else 0 end) as kilos
    from reparto_liquidaciones l join reparto_items i on i.liquidacion_id = l.id, r
    where l.estado = 'confirmada' and l.fecha >= r.d and l.fecha < r.h and (p_caja is null or l.caja_id = p_caja)
    group by 1
  ), c as (
    select date_trunc('month', k.fecha)::date as mes, sum(k.monto) as cobrado
    from reparto_cobros k, r
    where k.estado = 'confirmado' and k.fecha >= r.d and k.fecha < r.h and (p_caja is null or k.caja_id = p_caja)
    group by 1
  )
  select coalesce(v.mes, c.mes), coalesce(v.liq, 0)::bigint, coalesce(v.vendido, 0), coalesce(v.kilos, 0), coalesce(c.cobrado, 0)
  from v full join c on c.mes = v.mes
  order by 1;
$$;

create or replace function dash_reparto_por_repartidor(p_desde timestamptz, p_hasta timestamptz, p_caja uuid default null)
returns table (repartidor text, liquidaciones bigint, vendido numeric, kilos numeric, cobrado numeric, diferencia numeric)
language sql stable set search_path = public as $$
  with r as (
    select (p_desde at time zone 'America/Argentina/Buenos_Aires')::date as d,
           (p_hasta at time zone 'America/Argentina/Buenos_Aires')::date as h
  )
  select p.nombre,
         (select count(*) from reparto_liquidaciones l, r where l.repartidor_id = p.id and l.estado = 'confirmada'
            and l.fecha >= r.d and l.fecha < r.h)::bigint,
         coalesce((select sum(l.total_vendido) from reparto_liquidaciones l, r where l.repartidor_id = p.id
            and l.estado = 'confirmada' and l.fecha >= r.d and l.fecha < r.h), 0),
         coalesce((select sum(i.cantidad) from reparto_items i join reparto_liquidaciones l on l.id = i.liquidacion_id, r
            where l.repartidor_id = p.id and l.estado = 'confirmada' and i.unidad = 'kg' and l.fecha >= r.d and l.fecha < r.h), 0),
         coalesce((select sum(k.monto) from reparto_cobros k join reparto_clientes c on c.id = k.cliente_id, r
            where c.repartidor_id = p.id and k.estado = 'confirmado' and k.fecha >= r.d and k.fecha < r.h), 0),
         coalesce((select sum(l.diferencia) from reparto_liquidaciones l, r where l.repartidor_id = p.id
            and l.estado = 'confirmada' and l.fecha >= r.d and l.fecha < r.h), 0)
  from repartidores p
  where (p_caja is null or p.caja_id = p_caja)
  order by 3 desc;
$$;
