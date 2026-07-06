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
