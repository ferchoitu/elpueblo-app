-- ===========================================================================
-- Tráfico por hora del día para el dashboard (mismas convenciones que 0002:
-- [p_desde, p_hasta) en UTC, p_caja NULL = todas, excluye anuladas, hora AR).
-- ===========================================================================

create or replace function dash_por_hora(p_desde timestamptz, p_hasta timestamptz, p_caja uuid default null)
returns table (hora int, total numeric, tickets bigint)
language sql stable set search_path = public as $$
  select extract(hour from v.fecha at time zone 'America/Argentina/Buenos_Aires')::int as hora,
         sum(v.total), count(*)::bigint
  from ventas v
  where v.estado is distinct from 'anulada'
    and v.fecha >= p_desde and v.fecha < p_hasta
    and (p_caja is null or v.caja_id = p_caja)
  group by 1 order by 1;
$$;
