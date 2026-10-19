import type { RangoFechas } from '@shared/types';

// Los rangos se calculan en hora LOCAL del cajero y se convierten a UTC ISO,
// que es como se guardan las fechas en SQLite.

export type PeriodoPreset = 'hoy' | 'semana' | 'mes' | 'anio' | 'personalizado';

function inicioDia(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function finDia(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function rangoDePreset(preset: Exclude<PeriodoPreset, 'personalizado'>): RangoFechas {
  const hoy = new Date();
  if (preset === 'hoy') {
    return { desde: inicioDia(hoy).toISOString(), hasta: finDia(hoy).toISOString() };
  }
  if (preset === 'semana') {
    // Semana empieza el lunes.
    const dia = (hoy.getDay() + 6) % 7; // 0 = lunes
    const lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() - dia);
    return { desde: inicioDia(lunes).toISOString(), hasta: finDia(hoy).toISOString() };
  }
  if (preset === 'anio') {
    const primero = new Date(hoy.getFullYear(), 0, 1);
    return { desde: inicioDia(primero).toISOString(), hasta: finDia(hoy).toISOString() };
  }
  // mes
  const primero = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  return { desde: inicioDia(primero).toISOString(), hasta: finDia(hoy).toISOString() };
}

/** Convierte inputs date (yyyy-mm-dd) locales a un rango UTC. */
export function rangoPersonalizado(desde: string, hasta: string): RangoFechas {
  const d = desde ? new Date(desde + 'T00:00:00') : new Date();
  const h = hasta ? new Date(hasta + 'T00:00:00') : new Date();
  return { desde: inicioDia(d).toISOString(), hasta: finDia(h).toISOString() };
}

export const fechaHoraLocal = (iso: string) => new Date(iso).toLocaleString('es-AR');
export const fechaLocal = (iso: string) => new Date(iso).toLocaleDateString('es-AR');

/** Fecha local como yyyy-mm-dd, corrida `dias` días desde hoy. */
export function fechaISOLocal(dias = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Días desde hoy hasta una fecha yyyy-mm-dd (0 = hoy, negativo = ya pasó). */
export function diasHasta(fecha: string): number {
  const objetivo = new Date(`${fecha}T00:00:00`).getTime();
  const hoy = new Date(`${fechaISOLocal()}T00:00:00`).getTime();
  return Math.round((objetivo - hoy) / 86_400_000);
}

/** "Hoy", "Mañana" o "sáb 25/10", con la hora si hay. */
export function fechaEntregaTexto(fecha: string, hora: string | null): string {
  const n = diasHasta(fecha);
  const dia =
    n === 0
      ? 'Hoy'
      : n === 1
        ? 'Mañana'
        : new Date(`${fecha}T00:00:00`).toLocaleDateString('es-AR', {
            weekday: 'short',
            day: '2-digit',
            month: '2-digit',
          });
  return hora ? `${dia} ${hora} hs` : dia;
}

/** Rango de días locales (yyyy-mm-dd) para un preset; mismo criterio que rangoDePreset. */
export function rangoDiasDePreset(preset: Exclude<PeriodoPreset, 'personalizado'>): { desde: string; hasta: string } {
  const r = rangoDePreset(preset);
  const local = (iso: string) => {
    const d = new Date(iso);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  };
  return { desde: local(r.desde), hasta: local(r.hasta) };
}

/** "lun 20/10" para una fecha yyyy-mm-dd. */
export const diaCorto = (fecha: string) =>
  new Date(`${fecha}T00:00:00`).toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: '2-digit' });
