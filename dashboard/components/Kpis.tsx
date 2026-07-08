import type { Resumen } from '../lib/queries';
import { money, num } from '../lib/format';

export default function Kpis({ resumen }: { resumen: Resumen }) {
  const cards = [
    { label: 'Ventas totales', value: money(resumen.total) },
    { label: 'Tickets', value: num(resumen.ventas) },
    { label: 'Ticket promedio', value: money(resumen.ticket_promedio) },
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {cards.map((c) => (
        <div key={c.label} className="card p-4">
          <div className="text-slate-400 text-sm">{c.label}</div>
          <div className="text-3xl font-black tabular-nums mt-1">{c.value}</div>
        </div>
      ))}
    </div>
  );
}
