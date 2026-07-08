'use client';

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import type { PorDia, PorPago } from '../lib/queries';
import { money, diaCorto } from '../lib/format';

const COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#a855f7', '#14b8a6'];

export function GraficoPorDia({ data }: { data: PorDia[] }) {
  const chartData = data.map((d) => ({ dia: diaCorto(d.dia), total: Number(d.total), tickets: d.tickets }));
  return (
    <div className="card p-4">
      <h3 className="font-semibold mb-3">Ventas por día</h3>
      {chartData.length === 0 ? (
        <Vacio />
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis dataKey="dia" stroke="#94a3b8" fontSize={12} />
            <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(v) => money(v)} width={70} />
            <Tooltip
              contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
              formatter={(v: number) => [money(v), 'Ventas']}
            />
            <Bar dataKey="total" fill="#f59e0b" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export function GraficoPorPago({ data }: { data: PorPago[] }) {
  const chartData = data.map((d) => ({ name: d.metodo, value: Number(d.total) }));
  return (
    <div className="card p-4">
      <h3 className="font-semibold mb-3">Por método de pago</h3>
      {chartData.length === 0 ? (
        <Vacio />
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
              {chartData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
              formatter={(v: number) => money(v)}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function Vacio() {
  return <div className="h-[260px] flex items-center justify-center text-slate-500">Sin datos en el período</div>;
}
