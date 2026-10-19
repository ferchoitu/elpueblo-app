import { useEffect, useState } from 'react';
import type { MetricasReparto as Metricas } from '@shared/types';
import { money, kilos, numero } from '../../lib/format';
import { rangoDiasDePreset } from '../../lib/fechas';
import { Diferencia } from './HistorialReparto';

type Preset = 'semana' | 'mes' | 'anio';
const PRESETS: { id: Preset; label: string }[] = [
  { id: 'semana', label: 'Esta semana' },
  { id: 'mes', label: 'Este mes' },
  { id: 'anio', label: 'Este año' },
];
const MES = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleDateString('es-AR', { month: 'short', year: '2-digit' });

/** Métricas del reparto (Administración). Período = día del reparto / del cobro. */
export default function MetricasReparto() {
  const [preset, setPreset] = useState<Preset>('mes');
  const [m, setM] = useState<Metricas | null>(null);

  useEffect(() => {
    window.api.reparto.metricas(rangoDiasDePreset(preset)).then((r) => r.ok && r.data && setM(r.data));
  }, [preset]);

  if (!m) return null;
  const maxMes = Math.max(1, ...m.porMes.map((x) => Math.max(x.vendido, x.cobrado)));
  const kpis = [
    { label: 'Vendido en reparto', valor: money(m.totalVendido), emoji: '🛵' },
    { label: 'Kilos', valor: kilos(m.kilos), emoji: '⚖️' },
    { label: 'Cobrado', valor: money(m.cobradoEfectivo + m.cobradoTransferencia), emoji: '💰', sub: `${money(m.cobradoEfectivo)} efectivo · ${money(m.cobradoTransferencia)} transf.` },
    { label: 'Deuda de clientes (hoy)', valor: money(m.deudaClientes), emoji: '📒' },
  ];

  return (
    <div className="h-full overflow-y-auto space-y-4 pr-1">
      <div className="flex gap-2">
        {PRESETS.map((p) => (
          <button key={p.id} onClick={() => setPreset(p.id)} className={`px-3 py-2 rounded-lg text-sm font-semibold ${preset === p.id ? 'bg-acento text-white' : 'bg-base-700'}`}>
            {p.label}
          </button>
        ))}
        <div className="ml-auto text-sm text-slate-400 self-center">
          {numero(m.liquidaciones)} liquidaciones{m.unidades ? ` · ${numero(m.unidades)} unidades` : ''} · diferencia de efectivo:{' '}
          <Diferencia d={m.liquidaciones ? m.diferenciaEfectivo : null} />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="card p-4">
            <div className="text-2xl">{k.emoji}</div>
            <div className="text-slate-400 text-sm">{k.label}</div>
            <div className="text-2xl font-black tabular-nums">{k.valor}</div>
            {k.sub && <div className="text-xs text-slate-500">{k.sub}</div>}
          </div>
        ))}
      </div>

      <div className="card p-4">
        <div className="font-bold mb-2">Por repartidor</div>
        <table className="w-full text-sm">
          <thead className="text-slate-400 text-left">
            <tr>
              <th className="py-1">Reparto</th>
              <th className="py-1 text-right">Liquidaciones</th>
              <th className="py-1 text-right">Kilos</th>
              <th className="py-1 text-right">Vendido</th>
              <th className="py-1 text-right">Cobrado</th>
              <th className="py-1 text-right">Diferencia efectivo</th>
            </tr>
          </thead>
          <tbody>
            {m.porRepartidor.map((r) => (
              <tr key={r.repartidor} className="border-t border-base-700">
                <td className="py-1.5 font-semibold">{r.repartidor}</td>
                <td className="py-1.5 text-right">{r.liquidaciones}</td>
                <td className="py-1.5 text-right tabular-nums">{kilos(r.kilos)}</td>
                <td className="py-1.5 text-right tabular-nums">{money(r.vendido)}</td>
                <td className="py-1.5 text-right tabular-nums">{money(r.cobrado)}</td>
                <td className="py-1.5 text-right tabular-nums">
                  <Diferencia d={r.liquidaciones ? r.diferencia : null} />
                </td>
              </tr>
            ))}
            {!m.porRepartidor.length && (
              <tr>
                <td colSpan={6} className="py-4 text-center text-slate-500">
                  Sin movimientos en el período.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {m.porMes.length > 0 && (
        <div className="card p-4">
          <div className="font-bold mb-2">Mes a mes</div>
          <div className="space-y-2">
            {m.porMes.map((x) => (
              <div key={x.mes} className="flex items-center gap-3 text-sm">
                <div className="w-16 text-slate-400">{MES(x.mes)}</div>
                <div className="flex-1 space-y-1">
                  <div className="h-3 rounded bg-acento" style={{ width: `${(x.vendido / maxMes) * 100}%` }} title="Vendido" />
                  <div className="h-3 rounded bg-emerald-500/70" style={{ width: `${(x.cobrado / maxMes) * 100}%` }} title="Cobrado" />
                </div>
                <div className="w-56 text-right tabular-nums">
                  {money(x.vendido)} vendido · {money(x.cobrado)} cobrado · {kilos(x.kilos)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="card p-4">
          <div className="font-bold mb-2">Clientes que más compran</div>
          {m.topClientes.map((c) => (
            <div key={c.cliente + c.repartidor} className="flex justify-between text-sm border-t border-base-700 py-1">
              <span>
                {c.cliente} <span className="text-slate-500">· {c.repartidor}</span>
              </span>
              <span className="tabular-nums">
                {kilos(c.kilos)} · {money(c.vendido)}
              </span>
            </div>
          ))}
        </div>
        <div className="card p-4">
          <div className="font-bold mb-2">Productos</div>
          {m.topProductos.map((p) => (
            <div key={p.producto} className="flex justify-between text-sm border-t border-base-700 py-1">
              <span>{p.producto}</span>
              <span className="tabular-nums">
                {p.kilos ? kilos(p.kilos) : ''}
                {p.kilos && p.unidades ? ' + ' : ''}
                {p.unidades ? `${numero(p.unidades)} u` : ''} · {money(p.vendido)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
