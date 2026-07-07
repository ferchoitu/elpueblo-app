import type { Turno } from '@shared/types';
import { money } from '../../lib/format';
import { fechaLocal } from '../../lib/fechas';

interface Props {
  turnos: Turno[];
}

/** Con cuánto fondo se abrió y se cerró la caja en cada turno del período. */
export default function CajaAperturaCierre({ turnos }: Props) {
  return (
    <div className="card p-4">
      <h3 className="font-bold mb-3">Caja por turno (fondo, excedente y conteo)</h3>
      {turnos.length === 0 ? (
        <div className="text-slate-500 py-8 text-center">Sin turnos en el período</div>
      ) : (
        <div className="max-h-80 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-base-800">
              <tr className="text-left text-slate-400 border-b border-base-700">
                <th className="py-2 pr-2 font-semibold">Fecha</th>
                <th className="py-2 pr-2 font-semibold">Empleada</th>
                <th className="py-2 pr-2 font-semibold text-right">Fondo</th>
                <th className="py-2 pr-2 font-semibold text-right">Excedente esp.</th>
                <th className="py-2 pr-2 font-semibold text-right">Contado</th>
                <th className="py-2 font-semibold text-right">Dif.</th>
              </tr>
            </thead>
            <tbody>
              {turnos.map((t) => {
                const dif = t.diferencia ?? 0;
                const cerrado = t.estado === 'cerrado';
                return (
                  <tr key={t.id} className="border-b border-base-700/40 hover:bg-base-700/30">
                    <td className="py-1.5 pr-2 whitespace-nowrap">
                      {fechaLocal(t.apertura_at)}
                      <span className="text-slate-500 ml-1">#{t.numero}</span>
                    </td>
                    <td className="py-1.5 pr-2">{t.usuario_nombre}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{money(t.fondo_inicial)}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">
                      {cerrado ? money(t.esperado_efectivo ?? t.total_efectivo ?? 0) : <span className="text-acento">abierto</span>}
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">
                      {t.efectivo_contado != null ? (
                        money(t.efectivo_contado)
                      ) : cerrado ? (
                        <span className="text-slate-500">s/contar</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td
                      className={`py-1.5 text-right tabular-nums ${
                        t.efectivo_contado == null
                          ? 'text-slate-600'
                          : dif === 0
                          ? 'text-slate-400'
                          : dif > 0
                          ? 'text-sky-400'
                          : 'text-red-400'
                      }`}
                    >
                      {t.efectivo_contado != null ? `${dif > 0 ? '+' : ''}${money(dif)}` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
