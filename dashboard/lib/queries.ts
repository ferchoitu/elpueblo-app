import { supabaseAdmin } from './supabase';

export interface Resumen {
  ventas: number;
  total: number;
  ticket_promedio: number;
}
export interface PorDia {
  dia: string; // YYYY-MM-DD (AR)
  total: number;
  tickets: number;
}
export interface TopItem {
  producto: string;
  unidades: number;
  gramos: number;
  total: number;
  lineas: number;
}
export interface PorPago {
  metodo: string;
  total: number;
  tickets: number;
}
export interface TurnoRow {
  id: string;
  numero: number | null;
  empleada: string | null;
  apertura_at: string | null;
  cierre_at: string | null;
  total_ventas: number | null;
  total_efectivo: number | null;
  efectivo_contado: number | null;
  diferencia: number | null;
  estado: string | null;
}
export interface Caja {
  id: string;
  nombre: string | null;
}

export interface DatosDashboard {
  resumen: Resumen;
  porDia: PorDia[];
  topItems: TopItem[];
  porPago: PorPago[];
  turnos: TurnoRow[];
  cajas: Caja[];
}

const args = (desde: string, hasta: string, caja: string | null) => ({
  p_desde: desde,
  p_hasta: hasta,
  p_caja: caja,
});

export async function cargarDatos(
  desde: string,
  hasta: string,
  caja: string | null
): Promise<DatosDashboard> {
  const sb = supabaseAdmin();
  const a = args(desde, hasta, caja);

  let turnosQuery = sb
    .from('turnos')
    .select(
      'id, numero, empleada, apertura_at, cierre_at, total_ventas, total_efectivo, efectivo_contado, diferencia, estado'
    )
    .gte('apertura_at', desde)
    .lt('apertura_at', hasta)
    .order('apertura_at', { ascending: false })
    .limit(200);
  if (caja) turnosQuery = turnosQuery.eq('caja_id', caja);

  const [resumen, porDia, topItems, porPago, turnos, cajas] = await Promise.all([
    sb.rpc('dash_resumen', a),
    sb.rpc('dash_por_dia', a),
    sb.rpc('dash_top_items', a),
    sb.rpc('dash_por_pago', a),
    turnosQuery,
    sb.from('cajas').select('id, nombre').order('nombre'),
  ]);

  const err =
    resumen.error || porDia.error || topItems.error || porPago.error || turnos.error || cajas.error;
  if (err) throw new Error(err.message);

  const r = (resumen.data?.[0] as Resumen) ?? { ventas: 0, total: 0, ticket_promedio: 0 };

  return {
    resumen: r,
    porDia: (porDia.data as PorDia[]) ?? [],
    topItems: (topItems.data as TopItem[]) ?? [],
    porPago: (porPago.data as PorPago[]) ?? [],
    turnos: (turnos.data as TurnoRow[]) ?? [],
    cajas: (cajas.data as Caja[]) ?? [],
  };
}
