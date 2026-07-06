import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { money } from '../../lib/format';

interface Props {
  data: { hora: string; total: number; tickets: number }[];
}

export default function SalesByHour({ data }: Props) {
  // Completar las 24 horas (las que no tienen ventas quedan en 0).
  const mapa = new Map(data.map((d) => [d.hora, d]));
  const horas = Array.from({ length: 24 }, (_, h) => {
    const hh = String(h).padStart(2, '0');
    const d = mapa.get(hh);
    return { hora: `${hh}h`, total: d?.total ?? 0, tickets: d?.tickets ?? 0 };
  });
  const conVentas = horas.some((h) => h.total > 0);

  return (
    <div className="card p-4">
      <h3 className="font-bold mb-3">Ventas por hora del día</h3>
      {!conVentas ? (
        <div className="h-64 flex items-center justify-center text-slate-500">Sin datos</div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={horas}>
            <CartesianGrid strokeDasharray="3 3" stroke="#26313f" />
            <XAxis dataKey="hora" stroke="#94a3b8" fontSize={11} interval={1} />
            <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(v) => money(v)} width={80} />
            <Tooltip
              contentStyle={{ background: '#1b2430', border: '1px solid #38465a', borderRadius: 8 }}
              formatter={(v: number, name) => [
                name === 'total' ? money(v) : v,
                name === 'total' ? 'Vendido' : 'Tickets',
              ]}
            />
            <Bar dataKey="total" fill="#38bdf8" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
