// Rangos de fechas en horario de Argentina (UTC-3, sin horario de verano desde
// 2009). La caja guarda `fecha` en UTC; acá calculamos los límites [desde, hasta)
// en UTC que corresponden a los días/meses/años locales.

const OFFSET_H = -3; // Argentina = UTC-3

export type Periodo = 'hoy' | 'semana' | 'mes' | 'anio' | 'custom';

/** "Ahora" con los campos UTC representando la hora de pared argentina. */
function arNow(): Date {
  return new Date(Date.now() + OFFSET_H * 3600 * 1000);
}

/** Medianoche AR de la fecha (y, m, d) como instante UTC ISO. 00:00 AR = 03:00 UTC. */
function arMidnightUTC(y: number, m: number, d: number): string {
  return new Date(Date.UTC(y, m, d, -OFFSET_H, 0, 0)).toISOString();
}

export interface Rango {
  desde: string; // ISO UTC (inclusive)
  hasta: string; // ISO UTC (exclusive)
  label: string;
}

/** Calcula el rango [desde, hasta) según el período. Para 'custom', d1/d2 son
 *  fechas AR en formato YYYY-MM-DD (hasta es inclusive → se le suma un día). */
export function rangoDe(periodo: Periodo, d1?: string, d2?: string): Rango {
  const a = arNow();
  const y = a.getUTCFullYear();
  const m = a.getUTCMonth();
  const d = a.getUTCDate();

  switch (periodo) {
    case 'hoy':
      return { desde: arMidnightUTC(y, m, d), hasta: arMidnightUTC(y, m, d + 1), label: 'Hoy' };
    case 'semana':
      return {
        desde: arMidnightUTC(y, m, d - 6),
        hasta: arMidnightUTC(y, m, d + 1),
        label: 'Últimos 7 días',
      };
    case 'anio':
      return { desde: arMidnightUTC(y, 0, 1), hasta: arMidnightUTC(y + 1, 0, 1), label: String(y) };
    case 'custom': {
      if (d1 && d2) {
        const [y1, m1, dd1] = d1.split('-').map(Number);
        const [y2, m2, dd2] = d2.split('-').map(Number);
        return {
          desde: arMidnightUTC(y1, m1 - 1, dd1),
          hasta: arMidnightUTC(y2, m2 - 1, dd2 + 1),
          label: `${d1} → ${d2}`,
        };
      }
      // sin fechas válidas: cae al mes actual
      return { desde: arMidnightUTC(y, m, 1), hasta: arMidnightUTC(y, m + 1, 1), label: 'Este mes' };
    }
    case 'mes':
    default:
      return { desde: arMidnightUTC(y, m, 1), hasta: arMidnightUTC(y, m + 1, 1), label: 'Este mes' };
  }
}
