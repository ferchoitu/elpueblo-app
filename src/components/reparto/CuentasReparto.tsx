import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CuentaCliente, MetodoCobroReparto, MovimientoCuenta, Repartidor } from '@shared/types';
import { money, parsePlata } from '../../lib/format';
import { diaCorto, fechaISOLocal } from '../../lib/fechas';

/** Cuentas corrientes de los clientes del reparto: quién debe cuánto, movimientos y pagos sueltos. */
export default function CuentasReparto() {
  const [repartidores, setRepartidores] = useState<Repartidor[]>([]);
  const [repId, setRepId] = useState<string | null>(null);
  const [cuentas, setCuentas] = useState<CuentaCliente[]>([]);
  const [soloDeudores, setSoloDeudores] = useState(true);
  const [sel, setSel] = useState<CuentaCliente | null>(null);
  const [movs, setMovs] = useState<MovimientoCuenta[]>([]);
  const [monto, setMonto] = useState('');
  const [metodo, setMetodo] = useState<MetodoCobroReparto>('efectivo');
  const [fecha, setFecha] = useState(fechaISOLocal());
  const [msg, setMsg] = useState('');

  useEffect(() => {
    window.api.reparto.repartidores(true).then((r) => r.ok && r.data && setRepartidores(r.data));
  }, []);

  const cargar = useCallback(async () => {
    const r = await window.api.reparto.cuentas(repId);
    if (r.ok && r.data) setCuentas(r.data);
  }, [repId]);
  useEffect(() => {
    cargar();
  }, [cargar]);

  async function abrir(c: CuentaCliente) {
    setSel(c);
    setMonto('');
    setMsg('');
    const r = await window.api.reparto.movimientos(c.cliente_id);
    if (r.ok && r.data) setMovs(r.data);
  }

  async function registrarPago() {
    if (!sel) return;
    const r = await window.api.reparto.registrarCobro(sel.cliente_id, parsePlata(monto), metodo, fecha);
    if (!r.ok) return setMsg(r.error ?? 'No se pudo registrar');
    setMsg(`✅ Pago de ${money(parsePlata(monto))} registrado`);
    setMonto('');
    await cargar();
    const m = await window.api.reparto.movimientos(sel.cliente_id);
    if (m.ok && m.data) setMovs(m.data);
  }

  const visibles = useMemo(() => (soloDeudores ? cuentas.filter((c) => c.saldo > 0) : cuentas), [cuentas, soloDeudores]);
  const deudaTotal = cuentas.reduce((a, c) => a + Math.max(0, c.saldo), 0);
  const actual = sel ? cuentas.find((c) => c.cliente_id === sel.cliente_id) ?? sel : null;

  return (
    <div className="h-full flex gap-3 min-h-0">
      <div className="flex-1 min-w-0 flex flex-col gap-3 min-h-0">
        <div className="flex items-center gap-2 flex-wrap">
          <select className="input w-56" value={repId ?? ''} onChange={(e) => setRepId(e.target.value || null)}>
            <option value="">Todos los repartos</option>
            {repartidores.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nombre}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={soloDeudores} onChange={(e) => setSoloDeudores(e.target.checked)} /> Solo los que deben
          </label>
          <div className="ml-auto text-right">
            <div className="text-xs text-slate-400">Deuda total de clientes</div>
            <div className="text-2xl font-black text-amber-300 tabular-nums">{money(deudaTotal)}</div>
          </div>
        </div>
        <div className="card flex-1 min-h-0 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-400 sticky top-0 bg-base-800">
              <tr className="text-left">
                <th className="p-2">Cliente</th>
                <th className="p-2">Reparto</th>
                <th className="p-2 text-right">Vendido</th>
                <th className="p-2 text-right">Pagó</th>
                <th className="p-2 text-right">Saldo</th>
                <th className="p-2">Último mov.</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((c) => (
                <tr
                  key={c.cliente_id}
                  onClick={() => abrir(c)}
                  className={`border-t border-base-700 cursor-pointer hover:bg-base-700/50 ${sel?.cliente_id === c.cliente_id ? 'bg-base-700/60' : ''}`}
                >
                  <td className="p-2 font-semibold">{c.cliente_nombre}</td>
                  <td className="p-2 text-slate-400">{c.repartidor_nombre}</td>
                  <td className="p-2 text-right tabular-nums">{money(c.vendido)}</td>
                  <td className="p-2 text-right tabular-nums">{money(c.cobrado)}</td>
                  <td className={`p-2 text-right tabular-nums font-bold ${c.saldo > 0 ? 'text-amber-300' : c.saldo < 0 ? 'text-emerald-300' : ''}`}>
                    {c.saldo < 0 ? `A favor ${money(-c.saldo)}` : money(c.saldo)}
                  </td>
                  <td className="p-2 text-slate-400">{c.ultimo_movimiento ? diaCorto(c.ultimo_movimiento) : '—'}</td>
                </tr>
              ))}
              {!visibles.length && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-500">
                    {soloDeudores ? 'Nadie debe nada 🎉' : 'No hay clientes.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {actual && (
        <div className="w-[380px] shrink-0 card p-4 flex flex-col min-h-0">
          <div className="flex items-start justify-between">
            <div>
              <div className="font-bold text-lg">{actual.cliente_nombre}</div>
              <div className="text-slate-400 text-sm">{actual.repartidor_nombre}</div>
            </div>
            <button onClick={() => setSel(null)} className="text-slate-500">
              ✕
            </button>
          </div>
          <div className={`text-3xl font-black my-2 tabular-nums ${actual.saldo > 0 ? 'text-amber-300' : 'text-emerald-300'}`}>
            {actual.saldo > 0 ? `Debe ${money(actual.saldo)}` : actual.saldo < 0 ? `A favor ${money(-actual.saldo)}` : 'Al día ✓'}
          </div>

          <div className="bg-base-900 rounded-xl p-3 mb-3 space-y-2">
            <div className="text-sm font-semibold">Registrar un pago (fuera del reparto)</div>
            <div className="flex gap-2">
              <input className="input flex-1 text-right" inputMode="decimal" placeholder="$ monto" value={monto} onChange={(e) => setMonto(e.target.value)} />
              <input type="date" className="input w-40" value={fecha} max={fechaISOLocal()} onChange={(e) => setFecha(e.target.value)} />
            </div>
            <div className="flex gap-2">
              {(['efectivo', 'transferencia'] as MetodoCobroReparto[]).map((m) => (
                <button key={m} onClick={() => setMetodo(m)} className={`flex-1 py-2 rounded-lg text-sm ${metodo === m ? 'bg-acento text-white' : 'bg-base-700'}`}>
                  {m === 'efectivo' ? '💵 Efectivo' : '🏦 Transferencia'}
                </button>
              ))}
            </div>
            <button onClick={registrarPago} disabled={!(parsePlata(monto) > 0)} className="btn-primary w-full py-2">
              Registrar pago
            </button>
            {msg && <div className="text-sm">{msg}</div>}
          </div>

          <div className="text-sm text-slate-400 mb-1">Movimientos</div>
          <div className="flex-1 min-h-0 overflow-y-auto space-y-1">
            {movs.map((m, i) => (
              <div key={i} className="flex justify-between gap-2 text-sm border-b border-base-700 pb-1">
                <div className="min-w-0">
                  <div className="text-slate-400 text-xs">
                    {diaCorto(m.fecha)}
                    {m.liquidacion_numero != null ? ` · liq. #${m.liquidacion_numero}` : ''}
                  </div>
                  <div className="truncate">{m.detalle}</div>
                </div>
                <div className={`tabular-nums font-semibold ${m.tipo === 'cobro' ? 'text-emerald-300' : ''}`}>
                  {m.tipo === 'cobro' ? `−${money(m.monto)}` : money(m.monto)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
