import { rangoDe, type Periodo } from '../lib/dates';
import { cargarDatos } from '../lib/queries';
import Filtros from '../components/Filtros';
import Kpis from '../components/Kpis';
import { GraficoPorDia, GraficoPorPago } from '../components/Graficos';
import TablaItems from '../components/TablaItems';
import TablaTurnos from '../components/TablaTurnos';
import LogoutButton from '../components/LogoutButton';

// Siempre dinámico: los datos dependen de la request y de Supabase en runtime.
export const dynamic = 'force-dynamic';

const one = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

export default async function Page({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const periodo = (one(searchParams.periodo) as Periodo) || 'mes';
  const device = one(searchParams.device) || null;
  const rango = rangoDe(periodo, one(searchParams.d1), one(searchParams.d2));

  let datos = null;
  let error: string | null = null;
  try {
    datos = await cargarDatos(rango.desde, rango.hasta, device);
  } catch (e) {
    error = (e as Error).message;
  }

  return (
    <main className="max-w-6xl mx-auto p-4 sm:p-6 space-y-4">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black">DEL PUEBLO — Ventas</h1>
          <p className="text-slate-400 text-sm">{rango.label}</p>
        </div>
        <LogoutButton />
      </header>

      <Filtros devices={datos?.devices ?? []} />

      {error ? (
        <div className="card p-6 border-red-500/40">
          <div className="font-semibold text-red-400 mb-1">No se pudieron cargar los datos</div>
          <p className="text-sm text-slate-400">{error}</p>
          <p className="text-xs text-slate-500 mt-2">
            Revisá que estén configuradas las variables SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY y que el
            esquema y las funciones (migrations 0001 y 0002) estén aplicados.
          </p>
        </div>
      ) : datos ? (
        <>
          <Kpis resumen={datos.resumen} />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <GraficoPorDia data={datos.porDia} />
            </div>
            <GraficoPorPago data={datos.porPago} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <TablaItems items={datos.topItems} />
            <TablaTurnos turnos={datos.turnos} />
          </div>
        </>
      ) : null}
    </main>
  );
}
