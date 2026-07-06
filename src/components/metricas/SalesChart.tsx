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
  data: { fecha: string; total: number; tickets: number }[];
}

export default function SalesChart({ data }: Props) {
  const chartData = data.map((d) => ({
    ...d,
    label: d.fecha.slice(5), // MM-DD
  }));

  return (
    <div className="card p-4">
      <h3 className="font-bold mb-3">Evolución de ventas por día</h3>
      {chartData.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-slate-500">Sin datos</div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#26313f" />
            <XAxis dataKey="label" stroke="#94a3b8" fontSize={12} />
            <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(v) => money(v)} width={80} />
            <Tooltip
              contentStyle={{ background: '#1b2430', border: '1px solid #38465a', borderRadius: 8 }}
              formatter={(v: number) => [money(v), 'Total']}
            />
            <Bar dataKey="total" fill="#22c55e" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
