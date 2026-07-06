import { money, numero } from '../../lib/format';

interface Props {
  totalVendido: number;
  cantidadTickets: number;
  ticketPromedio: number;
}

export default function KpiCards({ totalVendido, cantidadTickets, ticketPromedio }: Props) {
  const kpis = [
    { label: 'Total vendido', valor: money(totalVendido), emoji: '💰' },
    { label: 'Tickets', valor: numero(cantidadTickets), emoji: '🧾' },
    { label: 'Ticket promedio', valor: money(ticketPromedio), emoji: '📈' },
  ];
  return (
    <div className="grid grid-cols-3 gap-4">
      {kpis.map((k) => (
        <div key={k.label} className="card p-5">
          <div className="text-3xl mb-1">{k.emoji}</div>
          <div className="text-slate-400 text-sm">{k.label}</div>
          <div className="text-3xl font-black tabular-nums">{k.valor}</div>
        </div>
      ))}
    </div>
  );
}
