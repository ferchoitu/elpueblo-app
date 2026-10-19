-- ===========================================================================
-- Pedidos (encargos para una fecha) en la nube + métricas para el dashboard.
--
-- La caja sube cada pedido con sus ítems por la Edge Function `push`. La seña y
-- el saldo NO están en el pedido: son ventas normales con `ventas.pedido_id`,
-- así lo cobrado de un pedido = suma de sus ventas no anuladas.
--
-- ORDEN DE DESPLIEGUE: aplicar esta migración ANTES de publicar la versión de
-- la caja que manda `pedido_id` en las ventas; si no, el upsert de ventas falla.
-- Idempotente (if not exists / create or replace).
-- ===========================================================================

create table if not exists pedidos (
  id                uuid primary key,
  caja_id           uuid references cajas(id),
  numero            integer,
  cliente_nombre    text,
  cliente_telefono  text,
  cliente_direccion text,
  fecha_entrega     date,
  hora_entrega      text,
  notas             text,
  total             numeric,
  estado            text,            -- pendiente | entregado | cancelado
  tomado_por        text,
  created_at        timestamptz,     -- cuándo se tomó el pedido
  entregado_at      timestamptz,
  entregado_por     text,
  cancelado_at      timestamptz,
  cancelado_por     text,
  actualizado_at    timestamptz not null default now()
);
create index if not exists idx_pedidos_caja on pedidos(caja_id);
create index if not exists idx_pedidos_created on pedidos(created_at);
create index if not exists idx_pedidos_entrega on pedidos(fecha_entrega);

create table if not exists pedido_items (
  id               uuid primary key,
  pedido_id        uuid references pedidos(id) on delete cascade,
  producto_nombre  text,
  tipo_venta_usado text,
  cantidad         numeric,
  unidad           text,
  precio_unitario  numeric,
  subtotal         numeric
);
create index if not exists idx_pedido_items_pedido on pedido_items(pedido_id);

-- Referencia "blanda" (sin FK): la venta de la seña puede subir antes que el pedido.
alter table ventas add column if not exists pedido_id uuid;
create index if not exists idx_ventas_pedido on ventas(pedido_id);

alter table pedidos      enable row level security;
alter table pedido_items enable row level security;

-- ---------------------------------------------------------------------------
-- Métricas de pedidos. Mismas convenciones que 0002: [p_desde, p_hasta) en UTC,
-- p_caja NULL = todas, agrupación en hora de Argentina. El período se mide por
-- la fecha en que se TOMÓ el pedido (created_at). "cobrado" = ventas no anuladas
-- de esos pedidos (señas + saldos), cuando sea que se hayan cobrado.
-- ---------------------------------------------------------------------------

create or replace function dash_pedidos_resumen(p_desde timestamptz, p_hasta timestamptz, p_caja uuid default null)
returns table (pedidos bigint, entregados bigint, pendientes bigint, cancelados bigint,
               total numeric, cobrado numeric, pedido_promedio numeric)
language sql stable set search_path = public as $$
  with p as (
    select * from pedidos
    where created_at >= p_desde and created_at < p_hasta
      and (p_caja is null or caja_id = p_caja)
  ), cobros as (
    select coalesce(sum(v.total), 0) as cobrado
    from ventas v join p on p.id = v.pedido_id
    where v.estado is distinct from 'anulada'
  )
  select count(*) filter (where estado <> 'cancelado')::bigint,
         count(*) filter (where estado = 'entregado')::bigint,
         count(*) filter (where estado = 'pendiente')::bigint,
         count(*) filter (where estado = 'cancelado')::bigint,
         coalesce(sum(total) filter (where estado <> 'cancelado'), 0),
         (select cobrado from cobros),
         coalesce(avg(total) filter (where estado <> 'cancelado'), 0)
  from p;
$$;

create or replace function dash_pedidos_por_mes(p_desde timestamptz, p_hasta timestamptz, p_caja uuid default null)
returns table (mes date, pedidos bigint, cancelados bigint, total numeric, cobrado numeric)
language sql stable set search_path = public as $$
  with p as (
    select *, date_trunc('month', created_at at time zone 'America/Argentina/Buenos_Aires')::date as mes
    from pedidos
    where created_at >= p_desde and created_at < p_hasta
      and (p_caja is null or caja_id = p_caja)
  ), cobros as (
    select v.pedido_id, sum(v.total) as cobrado
    from ventas v
    where v.pedido_id is not null and v.estado is distinct from 'anulada'
    group by v.pedido_id
  )
  select p.mes,
         count(*) filter (where p.estado <> 'cancelado')::bigint,
         count(*) filter (where p.estado = 'cancelado')::bigint,
         coalesce(sum(p.total) filter (where p.estado <> 'cancelado'), 0),
         coalesce(sum(c.cobrado), 0)
  from p left join cobros c on c.pedido_id = p.id
  group by p.mes order by p.mes;
$$;

create or replace function dash_pedidos_top_items(p_desde timestamptz, p_hasta timestamptz, p_caja uuid default null)
returns table (producto text, unidades numeric, gramos numeric, total numeric, pedidos bigint)
language sql stable set search_path = public as $$
  select i.producto_nombre,
         coalesce(sum(case when i.tipo_venta_usado = 'unidad' then i.cantidad end), 0),
         coalesce(sum(case when i.tipo_venta_usado <> 'unidad' then i.cantidad end), 0),
         coalesce(sum(i.subtotal), 0),
         count(distinct i.pedido_id)::bigint
  from pedido_items i
  join pedidos p on p.id = i.pedido_id
  where p.estado <> 'cancelado'
    and p.created_at >= p_desde and p.created_at < p_hasta
    and (p_caja is null or p.caja_id = p_caja)
  group by i.producto_nombre
  order by 4 desc;
$$;
