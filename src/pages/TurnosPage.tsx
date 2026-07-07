import { useState, useEffect, useCallback } from 'react';
import type { Turno } from '@shared/types';
import { rangoDePreset, rangoPersonalizado, fechaHoraLocal, type PeriodoPreset } from '../lib/fechas';
import { money } from '../lib/format';

const PRESETS: { id: PeriodoPreset; label: string }[] = [
  { id: 'hoy', label: 'Hoy' },
  { id: 'semana', label: 'Esta semana' },
  { id: 'mes', label: 'Este mes' },
  { id: 'anio', label: 'Este año' },
  { id: 'personalizado', label: 'Personalizado' },
];

export default function TurnosPage() {
  const [preset, setPreset] = useState<PeriodoPreset>('mes');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [msg, setMsg] = useState('');

  const cargar = useCallback(async () => {
    const rango = preset === 'personalizado' ? rangoPersonalizado(desde, hasta) : rangoDePreset(preset);
    setTurnos(await window.api.turno.listar(rango));
  }, [preset, desde, hasta]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function reimprimir(t: Turno) {
    const res = await window.api.turno.reimprimirZ(t.id);
    setMsg(res.ok ? `Ticket Z del turno #${t.numero} enviado` : res.error ?? 'Error al imprimir');
    setTimeout(() => setMsg(''), 3000);
  }

  async function exportar() {
    const rango = preset === 'personalizado' ? rangoPersonalizado(desde, hasta) : rangoDePreset(preset);
    const res = await window.api.turno.exportarCSV(rango);
    if (res.ok && res.data) alert(`CSV de cierres exportado en:\n${res.data}`);
    else if (!res.ok) alert(res.error);
  }

  const dif = (t: Turno) => t.diferencia ?? 0;

  return (
    <div className="h-full overflow-y-auto p-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold mr-2">Turnos / Cierres de caja</h1>
        <div className="flex gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPreset(p.id)}
              className={`px-4 py-2 rounded-lg font-semibold ${
                preset === p.id ? 'bg-acento text-white' : 'bg-base-700 hover:bg-base-600'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {preset === 'personalizado' && (
          <div className="flex items-center gap-2">
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="input w-auto" />
            <span className="text-slate-400">a</span>
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="input w-auto" />
          </div>
        )}
        <button onClick={exportar} className="btn-ghost px-4 py-2 ml-auto">
          ⬇️ Exportar cierres (CSV)
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="grid grid-cols-[auto_1fr_1fr_1fr_1fr_1fr_1fr_auto] gap-2 px-4 py-2 text-xs text-slate-400 border-b border-base-700 font-semibold">
          <div>#</div>
          <div>Empleada</div>
          <div>Apertura</div>
          <div>Cierre</div>
          <div className="text-right">Ventas</div>
          <div className="text-right">A retirar</div>
          <div className="text-right">Retirado</div>
          <div className="text-right">Dif.</div>
        </div>
        {turnos.length === 0 && (
          <div className="text-slate-500 py-8 text-center">No hay turnos en el período</div>
        )}
        {turnos.map((t) => (
          <div
            key={t.id}
            className="grid grid-cols-[auto_1fr_1fr_1fr_1fr_1fr_1fr_auto] gap-2 px-4 py-2 text-sm items-center border-b border-base-700/50"
          >
            <div className="text-slate-400">{t.numero}</div>
            <div className="truncate">{t.usuario_nombre}</div>
            <div className="text-slate-400 text-xs">{fechaHoraLocal(t.apertura_at)}</div>
            <div className="text-slate-400 text-xs">
              {t.estado === 'abierto' ? (
                <span className="text-acento font-semibold">ABIERTO</span>
              ) : (
                fechaHoraLocal(t.cierre_at!)
              )}
            </div>
            <div className="text-right tabular-nums">{t.total_ventas != null ? money(t.total_ventas) : '—'}</div>
            <div className="text-right tabular-nums">{t.esperado_efectivo != null ? money(t.esperado_efectivo) : '—'}</div>
            <div className="text-right tabular-nums">{t.efectivo_contado != null ? money(t.efectivo_contado) : '—'}</div>
            <div className="text-right tabular-nums flex items-center justify-end gap-2">
              {t.estado === 'cerrado' ? (
                <>
                  <span
                    className={dif(t) === 0 ? 'text-slate-400' : dif(t) > 0 ? 'text-sky-400' : 'text-red-400'}
                    title={dif(t) > 0 ? 'Sobrante' : dif(t) < 0 ? 'Faltante' : 'Sin diferencia'}
                  >
                    {dif(t) > 0 ? '+' : ''}
                    {money(dif(t))}
                  </span>
                  <button
                    onClick={() => reimprimir(t)}
                    className="btn-ghost px-2 py-1 text-xs"
                    title="Reimprimir ticket Z"
                  >
                    🖨 Z
                  </button>
                </>
              ) : (
                <span className="text-slate-600">—</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {msg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-base-700 border border-base-600 px-5 py-3 rounded-xl shadow-xl z-50">
          {msg}
        </div>
      )}
    </div>
  );
}
