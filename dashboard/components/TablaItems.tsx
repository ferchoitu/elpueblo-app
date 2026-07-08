import type { TopItem } from '../lib/queries';
import { money, num } from '../lib/format';

export default function TablaItems({ items }: { items: TopItem[] }) {
  return (
    <div className="card p-4">
      <h3 className="font-semibold mb-3">Productos (por facturación)</h3>
      {items.length === 0 ? (
        <div className="text-slate-500 py-6 text-center">Sin ventas en el período</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 text-left border-b border-base-700">
                <th className="py-2 pr-2 font-medium">Producto</th>
                <th className="py-2 px-2 font-medium text-right">Unidades</th>
                <th className="py-2 px-2 font-medium text-right">Gramos</th>
                <th className="py-2 pl-2 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.producto} className="border-b border-base-700/50">
                  <td className="py-2 pr-2">{it.producto}</td>
                  <td className="py-2 px-2 text-right tabular-nums">
                    {it.unidades > 0 ? num(it.unidades) : '—'}
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums">
                    {it.gramos > 0 ? num(it.gramos) : '—'}
                  </td>
                  <td className="py-2 pl-2 text-right tabular-nums font-semibold">{money(it.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
