import { useMemo, useState } from 'react';
import type { DetalleItemVendido } from '@shared/types';
import { money, cantidadTexto } from '../../lib/format';

interface Props {
  items: DetalleItemVendido[];
}

const horaLocal = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
const fechaCorta = (iso: string) =>
  new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });

/** Desglose cronológico: qué se vendió, a qué hora y qué artículo fue. */
export default function DetalleArticulos({ items }: Props) {
  const [busca, setBusca] = useState('');

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return q ? items.filter((i) => i.nombre_producto.toLowerCase().includes(q)) : items;
  }, [items, busca]);

  const totalFiltrado = filtrados.reduce((a, i) => a + i.subtotal, 0);

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <h3 className="font-bold">Detalle de artículos vendidos</h3>
        <input
          className="input w-56"
          placeholder="🔍 Filtrar por artículo…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      <div className="text-xs text-slate-400 mb-2">
        {filtrados.length} artículos · {money(totalFiltrado)}
      </div>

      <div className="max-h-96 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-base-800">
            <tr className="text-left text-slate-400 border-b border-base-700">
              <th className="py-2 pr-2 font-semibold">Hora</th>
              <th className="py-2 pr-2 font-semibold">Ticket</th>
              <th className="py-2 pr-2 font-semibold">Artículo</th>
              <th className="py-2 pr-2 font-semibold text-right">Cantidad</th>
              <th className="py-2 pr-2 font-semibold text-right">Subtotal</th>
              <th className="py-2 font-semibold">Pago</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-slate-500 py-8">
                  Sin artículos en el período
                </td>
              </tr>
            )}
            {filtrados.map((i, idx) => (
              <tr key={idx} className="border-b border-base-700/40 hover:bg-base-700/30">
                <td className="py-1.5 pr-2 tabular-nums whitespace-nowrap">
                  <span className="text-slate-500 mr-1">{fechaCorta(i.fecha)}</span>
                  {horaLocal(i.fecha)}
                </td>
                <td className="py-1.5 pr-2 text-slate-400">#{i.venta_numero}</td>
                <td className="py-1.5 pr-2">{i.nombre_producto}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums">
                  {cantidadTexto(i.cantidad, i.unidad)}
                </td>
                <td className="py-1.5 pr-2 text-right tabular-nums">{money(i.subtotal)}</td>
                <td className="py-1.5 text-slate-400">{i.metodo_pago}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
