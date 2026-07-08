-- ===========================================================================
-- Funciones de agregación para el dashboard (YA APLICADAS en delpueblo-caja).
-- Devuelven resultados ya agregados (chicos) en vez de miles de filas.
--
-- Filtros: [p_desde, p_hasta) en UTC; p_caja NULL = todas las cajas. Se excluyen
-- las ventas anuladas. La agrupación por día usa hora de Argentina.
--
-- SECURITY INVOKER (default): con la service role ven todo; con la anon key no
-- devuelven nada (RLS sin políticas de lectura), así que no filtran datos.
-- ===========================================================================

create or replace function dash_resumen(p_desde timestamptz, p_hasta timestamptz, p_caja uuid default null)
returns table (ventas bigint, total numeric, ticket_promedio numeric)
language sql stable set search_path = public as $$
  select count(*)::bigint, coalesce(sum(v.total), 0), coalesce(avg(v.total), 0)
  from ventas v
  where v.estado is distinct from 'anulada'
    and v.fecha >= p_desde and v.fecha < p_hasta
    and (p_caja is null or v.caja_id = p_caja);
$$;

create or replace function dash_por_dia(p_desde timestamptz, p_hasta timestamptz, p_caja uuid default null)
returns table (dia date, total numeric, tickets bigint)
language sql stable set search_path = public as $$
  select (v.fecha at time zone 'America/Argentina/Buenos_Aires')::date as dia,
         sum(v.total), count(*)::bigint
  from ventas v
  where v.estado is distinct from 'anulada'
    and v.fecha >= p_desde and v.fecha < p_hasta
    and (p_caja is null or v.caja_id = p_caja)
  group by 1 order by 1;
$$;

create or replace function dash_top_items(p_desde timestamptz, p_hasta timestamptz, p_caja uuid default null)
returns table (producto text, unidades numeric, gramos numeric, total numeric, lineas bigint)
language sql stable set search_path = public as $$
  select i.producto_nombre,
         coalesce(sum(case when i.tipo_venta_usado = 'unidad' then i.cantidad end), 0),
         coalesce(sum(case when i.tipo_venta_usado <> 'unidad' then i.cantidad end), 0),
         coalesce(sum(i.subtotal), 0),
         count(*)::bigint
  from venta_items i
  join ventas v on v.id = i.venta_id
  where v.estado is distinct from 'anulada'
    and v.fecha >= p_desde and v.fecha < p_hasta
    and (p_caja is null or v.caja_id = p_caja)
  group by i.producto_nombre
  order by 4 desc;
$$;

create or replace function dash_por_pago(p_desde timestamptz, p_hasta timestamptz, p_caja uuid default null)
returns table (metodo text, total numeric, tickets bigint)
language sql stable set search_path = public as $$
  select coalesce(v.metodo_pago, '—'), coalesce(sum(v.total), 0), count(*)::bigint
  from ventas v
  where v.estado is distinct from 'anulada'
    and v.fecha >= p_desde and v.fecha < p_hasta
    and (p_caja is null or v.caja_id = p_caja)
  group by 1 order by 2 desc;
$$;
