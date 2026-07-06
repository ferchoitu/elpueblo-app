import { money, numero } from '../../lib/format';
import type { MetodoPago } from '@shared/types';

interface TopProps {
  data: { nombre: string; cantidad: number; totalDinero: number }[];
}

export function TopProducts({ data }: TopProps) {
  const max = Math.max(1, ...data.map((d) => d.totalDinero));
  return (
    <div className="card p-4">
      <h3 className="font-bold mb-3">Productos más vendidos</h3>
      {data.length === 0 ? (
        <div className="text-slate-500 py-8 text-center">Sin datos</div>
      ) : (
        <div className="space-y-2">
          {data.map((d, i) => (
            <div key={d.nombre}>
              <div className="flex justify-between text-sm mb-0.5">
                <span className="truncate">
                  <span className="text-slate-500 mr-2">{i + 1}.</span>
                  {d.nombre}
                </span>
                <span className="font-semibold tabular-nums ml-2">
                  {money(d.totalDinero)}
                  <span className="text-slate-500 text-xs ml-1">({numero(d.cantidad)})</span>
                </span>
              </div>
              <div className="h-2 bg-base-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-acento rounded-full"
                  style={{ width: `${(d.totalDinero / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const NOMBRE_METODO: Record<MetodoPago, string> = {
  efectivo: '💵 Efectivo',
  debito: '💳 Débito',
  credito: '💳 Crédito',
  qr: '📱 QR',
  transferencia: '🏦 Transferencia',
};

interface MetodoProps {
  data: { metodo: MetodoPago; total: number; tickets: number }[];
}

export function MetodosPago({ data }: MetodoProps) {
  const total = data.reduce((a, d) => a + d.total, 0) || 1;
  return (
    <div className="card p-4">
      <h3 className="font-bold mb-3">Desglose por método de pago</h3>
      {data.length === 0 ? (
        <div className="text-slate-500 py-8 text-center">Sin datos</div>
      ) : (
        <div className="space-y-2">
          {data.map((d) => (
            <div key={d.metodo} className="flex items-center justify-between">
              <span>{NOMBRE_METODO[d.metodo] ?? d.metodo}</span>
              <span className="tabular-nums">
                <span className="font-semibold">{money(d.total)}</span>
                <span className="text-slate-500 text-sm ml-2">
                  {Math.round((d.total / total) * 100)}%
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
