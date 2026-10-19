import { useCallback, useEffect, useState } from 'react';
import type { Liquidacion, LiquidacionDetalle, Repartidor } from '@shared/types';
import { money, kilos } from '../../lib/format';
import { diaCorto, fechaHoraLocal, rangoDiasDePreset } from '../../lib/fechas';

type Preset = 'semana' | 'mes' | 'anio';
const PRESETS: { id: Preset; label: string }[] = [
  { id: 'semana', label: 'Esta semana' },
  { id: 'mes', label: 'Este mes' },
  { id: 'anio', label: 'Este año' },
];

export function Diferencia({ d }: { d: number | null }) {
  if (d == null) return <span className="text-slate-500">—</span>;
  if (d === 0) return <span className="text-emerald-300">✓</span>;
  return <span className={d < 0 ? 'text-red-400 font-bold' : 'text-amber-300'}>{d < 0 ? `−${money(-d)}` : `+${money(d)}`}</span>;
}

/** Liquidaciones cargadas, con detalle por cliente y anulación (Administración). */
export default function HistorialReparto() {
  const [preset, setPreset] = useState<Preset>('mes');
  const [repartidores, setRepartidores] = useState<Repartidor[]>([]);
  const [repId, setRepId] = useState<string | null>(null);
  const [lista, setLista] = useState<Liquidacion[]>([]);
  const [detalle, setDetalle] = useState<LiquidacionDetalle | null>(null);
  const [confirmAnular, setConfirmAnular] = useState(false);

  useEffect(() => {
    window.api.reparto.repartidores(true).then((r) => r.ok && r.data && setRepartidores(r.data));
  }, []);

  const cargar = useCallback(async () => {
    const r = await window.api.reparto.liquidaciones(rangoDiasDePreset(preset), repId);
    if (r.ok && r.data) setLista(r.data);
  }, [preset, repId]);
  useEffect(() => {
    cargar();
  }, [cargar]);

  async function abrir(id: string) {
    const r = await window.api.reparto.liquidacion(id);
    if (r.ok && r.data) setDetalle(r.data);
  }

  async function anular() {
    if (!detalle) return;
    const r = await window.api.reparto.anularLiquidacion(detalle.id);
    setConfirmAnular(false);
    if (r.ok) {
      setDetalle(null);
      cargar();
    } else alert(r.error);
  }

  // Detalle agrupado por cliente.
  const porCliente = detalle
    ? [...new Set([...detalle.items.map((i) => i.cliente_id), ...detalle.cobros.map((c) => c.cliente_id)])].map((id) => ({
        nombre: detalle.items.find((i) => i.cliente_id === id)?.cliente_nombre ?? detalle.cobros.find((c) => c.cliente_id === id)?.cliente_nombre,
        items: detalle.items.filter((i) => i.cliente_id === id),
        cobros: detalle.cobros.filter((c) => c.cliente_id === id),
      }))
    : [];

  return (
    <div className="h-full flex flex-col gap-3 min-h-0">
      <div className="flex gap-2 flex-wrap">
        {PRESETS.map((p) => (
          <button key={p.id} onClick={() => setPreset(p.id)} className={`px-3 py-2 rounded-lg text-sm font-semibold ${preset === p.id ? 'bg-acento text-white' : 'bg-base-700'}`}>
            {p.label}
          </button>
        ))}
        <select className="input w-56 ml-2" value={repId ?? ''} onChange={(e) => setRepId(e.target.value || null)}>
          <option value="">Todos los repartos</option>
          {repartidores.map((r) => (
            <option key={r.id} value={r.id}>
              {r.nombre}
            </option>
          ))}
        </select>
      </div>

      <div className="card flex-1 min-h-0 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="text-slate-400 sticky top-0 bg-base-800">
            <tr className="text-left">
              <th className="p-2">N°</th>
              <th className="p-2">Día</th>
              <th className="p-2">Reparto</th>
              <th className="p-2 text-right">Vendido</th>
              <th className="p-2 text-right">Efectivo</th>
              <th className="p-2 text-right">Transf.</th>
              <th className="p-2 text-right">Entregó</th>
              <th className="p-2 text-right">Diferencia</th>
              <th className="p-2">Cargó</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((l) => (
              <tr
                key={l.id}
                onClick={() => abrir(l.id)}
                className={`border-t border-base-700 cursor-pointer hover:bg-base-700/50 ${l.estado === 'anulada' ? 'opacity-40 line-through' : ''}`}
              >
                <td className="p-2 font-bold">{l.numero}</td>
                <td className="p-2">{diaCorto(l.fecha)}</td>
                <td className="p-2">{l.repartidor_nombre}</td>
                <td className="p-2 text-right tabular-nums">{money(l.total_vendido)}</td>
                <td className="p-2 text-right tabular-nums">{money(l.cobrado_efectivo)}</td>
                <td className="p-2 text-right tabular-nums">{money(l.cobrado_transferencia)}</td>
                <td className="p-2 text-right tabular-nums">{l.efectivo_entregado == null ? '—' : money(l.efectivo_entregado)}</td>
                <td className="p-2 text-right tabular-nums">
                  <Diferencia d={l.diferencia} />
                </td>
                <td className="p-2 text-slate-400">{l.cargado_por}</td>
              </tr>
            ))}
            {!lista.length && (
              <tr>
                <td colSpan={9} className="p-6 text-center text-slate-500">
                  No hay liquidaciones en el período.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {detalle && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-40 p-4">
          <div className="card w-full max-w-2xl p-5 max-h-full overflow-y-auto">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h2 className="text-2xl font-black">
                  Liquidación #{detalle.numero} · {detalle.repartidor_nombre}
                </h2>
                <div className="text-slate-400 text-sm">
                  Reparto del {diaCorto(detalle.fecha)} · cargó {detalle.cargado_por} el {fechaHoraLocal(detalle.created_at)}
                </div>
                {detalle.estado === 'anulada' && (
                  <div className="text-red-400 text-sm font-bold">
                    ANULADA por {detalle.anulada_por} el {fechaHoraLocal(detalle.anulada_at!)}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3 mb-4">
              {porCliente.map((c) => (
                <div key={c.nombre} className="bg-base-900 rounded-xl p-3">
                  <div className="font-bold mb-1">{c.nombre}</div>
                  {c.items.map((i) => (
                    <div key={i.id} className="flex justify-between text-sm">
                      <span>
                        {i.nombre_producto} · {i.unidad === 'kg' ? kilos(i.cantidad) : `x${i.cantidad}`} a {money(i.precio_unitario)}
                        {i.unidad === 'kg' ? '/kg' : ''}
                      </span>
                      <span className="tabular-nums">{money(i.subtotal)}</span>
                    </div>
                  ))}
                  {c.cobros.map((x) => (
                    <div key={x.id} className="flex justify-between text-sm text-emerald-300">
                      <span>Pagó ({x.metodo})</span>
                      <span className="tabular-nums">−{money(x.monto)}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-4 gap-2 text-center mb-4">
              <div className="bg-base-900 rounded-xl p-2">
                <div className="text-xs text-slate-400">Vendido</div>
                <div className="font-black">{money(detalle.total_vendido)}</div>
              </div>
              <div className="bg-base-900 rounded-xl p-2">
                <div className="text-xs text-slate-400">Cobró efectivo</div>
                <div className="font-black">{money(detalle.cobrado_efectivo)}</div>
              </div>
              <div className="bg-base-900 rounded-xl p-2">
                <div className="text-xs text-slate-400">Entregó</div>
                <div className="font-black">{detalle.efectivo_entregado == null ? '—' : money(detalle.efectivo_entregado)}</div>
              </div>
              <div className="bg-base-900 rounded-xl p-2">
                <div className="text-xs text-slate-400">Diferencia</div>
                <div className="font-black">
                  <Diferencia d={detalle.diferencia} />
                </div>
              </div>
            </div>
            {detalle.notas && <div className="text-amber-200 mb-3">📝 {detalle.notas}</div>}

            <div className="flex gap-2">
              {detalle.estado === 'confirmada' && (
                <button onClick={() => setConfirmAnular(true)} className="btn-danger px-4 py-3 text-sm">
                  Anular liquidación
                </button>
              )}
              <button onClick={() => setDetalle(null)} className="btn-ghost py-3 flex-1">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmAnular && detalle && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="card p-6 w-full max-w-sm text-center">
            <div className="font-bold text-lg mb-2">¿Anular la liquidación #{detalle.numero}?</div>
            <p className="text-slate-400 text-sm mb-4">
              Se descuentan sus ventas y sus cobros de las cuentas corrientes. Si estaba mal cargada, después cargala de nuevo.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setConfirmAnular(false)} className="btn-ghost py-3">
                No
              </button>
              <button onClick={anular} className="btn-danger py-3">
                Sí, anular
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
