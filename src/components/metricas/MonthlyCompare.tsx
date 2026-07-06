import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { money } from '../../lib/format';

interface Props {
  data: { mes: string; total: number; tickets: number }[];
}

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export default function MonthlyCompare({ data }: Props) {
  const chartData = data.map((d) => {
    const [y, m] = d.mes.split('-');
    return { ...d, label: `${MESES[parseInt(m, 10) - 1]} ${y.slice(2)}` };
  });

  return (
    <div className="card p-4">
      <h3 className="font-bold mb-3">Comparativa mensual (evolución mes a mes)</h3>
      {chartData.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-slate-500">Sin datos</div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#26313f" />
            <XAxis dataKey="label" stroke="#94a3b8" fontSize={12} />
            <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(v) => money(v)} width={80} />
            <Tooltip
              contentStyle={{ background: '#1b2430', border: '1px solid #38465a', borderRadius: 8 }}
              formatter={(v: number) => [money(v), 'Total']}
            />
            <Line
              type="monotone"
              dataKey="total"
              stroke="#22c55e"
              strokeWidth={3}
              dot={{ r: 4, fill: '#22c55e' }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
