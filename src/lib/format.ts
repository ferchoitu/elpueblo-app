export const money = (n: number): string =>
  '$' + Math.round(n).toLocaleString('es-AR', { maximumFractionDigits: 0 });

export const numero = (n: number): string =>
  n.toLocaleString('es-AR', { maximumFractionDigits: 0 });

/** Texto de cantidad para mostrar en carrito/ticket. */
export function cantidadTexto(cantidad: number, unidad: 'u' | 'g' | 'kg'): string {
  if (unidad === 'g') return `${numero(cantidad)} g`;
  if (unidad === 'kg') return `${cantidad} kg`;
  return `x${cantidad}`;
}

/** Kilos con hasta 2 decimales: "12,5 kg". */
export const kilos = (n: number): string => `${n.toLocaleString('es-AR', { maximumFractionDigits: 2 })} kg`;

/** Cantidad tipeada a mano (kilos o unidades): acepta coma o punto decimal ("2,5" = "2.5"). */
export const parseCantidad = (s: string): number => {
  const n = parseFloat((s || '').trim().replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

/** Plata tipeada a mano: el punto es de miles y la coma decimal ("1.500" = 1500, "1.500,50" = 1500.5). */
export const parsePlata = (s: string): number => {
  const n = parseFloat((s || '').trim().replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};
