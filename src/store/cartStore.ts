import { create } from 'zustand';
import type { Producto, CarritoItemInput, UnidadItem } from '@shared/types';

export interface CartItem extends CarritoItemInput {
  key: string; // id local del renderer
  emoji: string;
}

interface CartState {
  items: CartItem[];
  total: () => number;
  agregarUnidad: (p: Producto) => void;
  agregarPeso: (p: Producto, gramos: number) => void;
  incrementar: (key: string) => void;
  decrementar: (key: string) => void;
  eliminar: (key: string) => void;
  limpiar: () => void;
}

let seq = 0;
const nextKey = () => `k${Date.now()}_${seq++}`;

const round2 = (n: number) => Math.round(n * 100) / 100;

export const useCart = create<CartState>((set, get) => ({
  items: [],

  total: () => get().items.reduce((acc, it) => acc + it.subtotal, 0),

  agregarUnidad: (p) => {
    const precio = p.precio_unidad ?? 0;
    set((s) => {
      // Si ya existe una línea por unidad de este producto, sumamos +1.
      const existente = s.items.find(
        (it) => it.producto_id === p.id && it.tipo_venta_usado === 'unidad'
      );
      if (existente) {
        return {
          items: s.items.map((it) =>
            it.key === existente.key
              ? {
                  ...it,
                  cantidad: it.cantidad + 1,
                  subtotal: round2(precio * (it.cantidad + 1)),
                }
              : it
          ),
        };
      }
      const item: CartItem = {
        key: nextKey(),
        emoji: p.emoji,
        producto_id: p.id,
        nombre_producto: p.nombre,
        tipo_venta_usado: 'unidad',
        cantidad: 1,
        unidad: 'u',
        precio_unitario_aplicado: precio,
        subtotal: round2(precio),
      };
      return { items: [...s.items, item] };
    });
  },

  agregarPeso: (p, gramos) => {
    const precioKg = p.precio_kg ?? 0;
    const unidad: UnidadItem = 'g';
    const item: CartItem = {
      key: nextKey(),
      emoji: p.emoji,
      producto_id: p.id,
      nombre_producto: p.nombre,
      tipo_venta_usado: 'peso',
      cantidad: Math.round(gramos),
      unidad,
      precio_unitario_aplicado: precioKg, // $/kg
      subtotal: round2((precioKg * gramos) / 1000),
    };
    set((s) => ({ items: [...s.items, item] }));
  },

  incrementar: (key) =>
    set((s) => ({
      items: s.items.map((it) =>
        it.key === key && it.tipo_venta_usado === 'unidad'
          ? {
              ...it,
              cantidad: it.cantidad + 1,
              subtotal: round2(it.precio_unitario_aplicado * (it.cantidad + 1)),
            }
          : it
      ),
    })),

  decrementar: (key) =>
    set((s) => ({
      items: s.items
        .map((it) =>
          it.key === key && it.tipo_venta_usado === 'unidad'
            ? {
                ...it,
                cantidad: it.cantidad - 1,
                subtotal: round2(it.precio_unitario_aplicado * (it.cantidad - 1)),
              }
            : it
        )
        .filter((it) => it.cantidad > 0),
    })),

  eliminar: (key) => set((s) => ({ items: s.items.filter((it) => it.key !== key) })),

  limpiar: () => set({ items: [] }),
}));
