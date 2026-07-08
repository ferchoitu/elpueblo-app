export const money = (n: number | null | undefined): string =>
  '$' + Math.round(n ?? 0).toLocaleString('es-AR', { maximumFractionDigits: 0 });

export const num = (n: number | null | undefined): string =>
  (n ?? 0).toLocaleString('es-AR', { maximumFractionDigits: 0 });

/** YYYY-MM-DD (AR) → "dd/mm". */
export const diaCorto = (iso: string): string => {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
};

export const fechaHora = (iso: string | null): string =>
  iso
    ? new Date(iso).toLocaleString('es-AR', {
        timeZone: 'America/Argentina/Buenos_Aires',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false, // es-AR sin esto usa 12h y muestra las 19:00 como "07:00"
      })
    : '—';
