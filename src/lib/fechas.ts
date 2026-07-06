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
