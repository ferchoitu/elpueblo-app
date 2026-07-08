import type { TurnoRow } from '../lib/queries';
import { money, fechaHora } from '../lib/format';

export default function TablaTurnos({ turnos }: { turnos: TurnoRow[] }) {
  return (
    <div className="card p-4">
      <h3 className="font-semibold mb-3">Cierres de caja (turnos)</h3>
      {turnos.length === 0 ? (
        <div className="text-slate-500 py-6 text-center">Sin turnos en el período</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 text-left border-b border-base-700">
                <th className="py-2 pr-2 font-medium">#</th>
                <th className="py-2 px-2 font-medium">Empleada</th>
                <th className="py-2 px-2 font-medium">Cierre</th>
                <th className="py-2 px-2 font-medium text-right">Ventas</th>
                <th className="py-2 px-2 font-medium text-right">Contado</th>
                <th className="py-2 pl-2 font-medium text-right">Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {turnos.map((t) => {
                const dif = t.diferencia;
                const difColor =
                  dif == null ? 'text-slate-500' : dif === 0 ? 'text-slate-300' : dif > 0 ? 'text-emerald-400' : 'text-red-400';
                return (
                  <tr key={t.id} className="border-b border-base-700/50">
                    <td className="py-2 pr-2 tabular-nums">{t.numero ?? '—'}</td>
                    <td className="py-2 px-2">{t.empleada ?? '—'}</td>
                    <td className="py-2 px-2 text-slate-300">
                      {t.estado === 'abierto' ? 'Abierto' : fechaHora(t.cierre_at)}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums">{money(t.total_ventas)}</td>
                    <td className="py-2 px-2 text-right tabular-nums">
                      {t.efectivo_contado == null ? '—' : money(t.efectivo_contado)}
                    </td>
                    <td className={`py-2 pl-2 text-right tabular-nums font-semibold ${difColor}`}>
                      {dif == null ? '—' : money(dif)}
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
