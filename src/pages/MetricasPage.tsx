import { useState, useEffect, useCallback } from 'react';
import type { MetricasResumen, VentaConItems, RangoFechas, DetalleItemVendido, Turno } from '@shared/types';
import { rangoDePreset, rangoPersonalizado, fechaHoraLocal, type PeriodoPreset } from '../lib/fechas';
import { money, cantidadTexto } from '../lib/format';
import KpiCards from '../components/metricas/KpiCards';
import SalesChart from '../components/metricas/SalesChart';
import SalesByHour from '../components/metricas/SalesByHour';
import MonthlyCompare from '../components/metricas/MonthlyCompare';
import { TopProducts, MetodosPago } from '../components/metricas/TopProducts';
import DetalleArticulos from '../components/metricas/DetalleArticulos';
import CajaAperturaCierre from '../components/metricas/CajaAperturaCierre';

const PRESETS: { id: PeriodoPreset; label: string }[] = [
  { id: 'hoy', label: 'Hoy' },
  { id: 'semana', label: 'Esta semana' },
  { id: 'mes', label: 'Este mes' },
  { id: 'anio', label: 'Este año' },
  { id: 'personalizado', label: 'Personalizado' },
];

export default function MetricasPage() {
  const [preset, setPreset] = useState<PeriodoPreset>('mes');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [resumen, setResumen] = useState<MetricasResumen | null>(null);
  const [ventas, setVentas] = useState<VentaConItems[]>([]);
  const [items, setItems] = useState<DetalleItemVendido[]>([]);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [detalle, setDetalle] = useState<VentaConItems | null>(null);

  const rangoActual = useCallback((): RangoFechas => {
    if (preset === 'personalizado') return rangoPersonalizado(desde, hasta);
    return rangoDePreset(preset);
  }, [preset, desde, hasta]);

  const cargar = useCallback(async () => {
    const rango = rangoActual();
    const [r, v, it, tu] = await Promise.all([
      window.api.metricas.resumen(rango),
      window.api.ventas.listar(rango),
      window.api.ventas.itemsDetalle(rango),
      window.api.turno.listar(rango),
    ]);
    setResumen(r);
    setVentas(v);
    setItems(it);
    setTurnos(tu);
  }, [rangoActual]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function exportarVentas() {
    const res = await window.api.ventas.exportarCSV(rangoActual());
    if (res.ok && res.data) alert(`CSV de ventas exportado en:\n${res.data}`);
    else if (!res.ok) alert(res.error);
  }

  async function exportarCierres() {
    const res = await window.api.turno.exportarCSV(rangoActual());
    if (res.ok && res.data) alert(`CSV de cierres exportado en:\n${res.data}`);
    else if (!res.ok) alert(res.error);
  }

  return (
    <div className="h-full overflow-y-auto p-6 space-y-5">
      {/* Selector de período */}
      <div className="flex flex-wrap items-center gap-3">
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
        <div className="ml-auto flex gap-2">
          <button onClick={exportarVentas} className="btn-ghost px-4 py-2">
            ⬇️ Ventas (CSV)
          </button>
          <button onClick={exportarCierres} className="btn-ghost px-4 py-2">
            ⬇️ Cierres (CSV)
          </button>
        </div>
      </div>

      {resumen && (
        <>
          <KpiCards
            totalVendido={resumen.totalVendido}
            cantidadTickets={resumen.cantidadTickets}
            ticketPromedio={resumen.ticketPromedio}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <SalesChart data={resumen.porDia} />
            <SalesByHour data={resumen.porHora} />
            <MonthlyCompare data={resumen.porMes} />
            <TopProducts data={resumen.topProductos} />
            <MetodosPago data={resumen.porMetodoPago} />
          </div>

          {/* Caja: con cuánto fondo se abrió y cerró cada turno */}
          <CajaAperturaCierre turnos={turnos} />

          {/* Desglose: qué se vendió, a qué hora y qué artículo */}
          <DetalleArticulos items={items} />

          {/* Listado de tickets */}
          <div className="card p-4">
            <h3 className="font-bold mb-3">Tickets del período ({ventas.length})</h3>
            <div className="max-h-80 overflow-y-auto divide-y divide-base-700">
              {ventas.length === 0 && (
                <div className="text-slate-500 py-6 text-center">Sin tickets</div>
              )}
              {ventas.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setDetalle(v)}
                  className="w-full flex items-center justify-between py-2 px-1 hover:bg-base-700/50 text-left"
                >
                  <span className="text-slate-400 w-16">#{v.numero}</span>
                  <span className="flex-1 text-sm">{fechaHoraLocal(v.fecha)}</span>
                  <span className="text-sm text-slate-400 w-28">{v.metodo_pago}</span>
                  {v.estado === 'anulada' && (
                    <span className="text-red-400 text-xs mr-2">ANULADA</span>
                  )}
                  <span className="font-bold tabular-nums w-24 text-right">{money(v.total)}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Detalle de ticket */}
      {detalle && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-40 p-4"
          onClick={() => setDetalle(null)}
        >
          <div className="card p-5 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between mb-3">
              <h3 className="font-bold text-lg">Ticket #{detalle.numero}</h3>
              <button onClick={() => setDetalle(null)} className="text-slate-400">
                ✕
              </button>
            </div>
            <div className="text-sm text-slate-400 mb-3">
              {fechaHoraLocal(detalle.fecha)} · {detalle.metodo_pago}
              {detalle.estado === 'anulada' && (
                <span className="text-red-400 ml-2">(ANULADA)</span>
              )}
            </div>
            <div className="divide-y divide-base-700">
              {detalle.items.map((it) => (
                <div key={it.id} className="flex justify-between py-1.5 text-sm">
                  <span>
                    {it.nombre_producto}
                    <span className="text-slate-500 ml-2">
                      {cantidadTexto(it.cantidad, it.unidad)}
                    </span>
                  </span>
                  <span className="tabular-nums">{money(it.subtotal)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-3 pt-3 border-t border-base-700 text-lg font-bold">
              <span>TOTAL</span>
              <span className="tabular-nums">{money(detalle.total)}</span>
            </div>
            {detalle.metodo_pago === 'efectivo' && detalle.monto_recibido != null && (
              <div className="text-sm text-slate-400 mt-2">
                Recibido {money(detalle.monto_recibido)} · Vuelto {money(detalle.vuelto ?? 0)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
