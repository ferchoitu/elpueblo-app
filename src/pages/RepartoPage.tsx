import { useState } from 'react';
import { useAuth } from '../store/authStore';
import CargarLiquidacion from '../components/reparto/CargarLiquidacion';
import HistorialReparto from '../components/reparto/HistorialReparto';
import CuentasReparto from '../components/reparto/CuentasReparto';
import MetricasReparto from '../components/reparto/MetricasReparto';
import RepartidoresConfig from '../components/reparto/RepartidoresConfig';

type Vista = 'cargar' | 'clientes' | 'historial' | 'cuentas' | 'metricas' | 'repartidores';

// soloAdmin: true = solo Administración · false = todos · 'personal' = solo el personal
// (Administración gestiona clientes desde "Repartidores", que además muestra saldos).
const VISTAS: { id: Vista; label: string; soloAdmin: boolean | 'personal' }[] = [
  { id: 'cargar', label: '🧾 Cargar liquidación', soloAdmin: false },
  { id: 'clientes', label: '👥 Clientes', soloAdmin: 'personal' },
  { id: 'historial', label: '📜 Historial', soloAdmin: true },
  { id: 'cuentas', label: '📒 Cuentas corrientes', soloAdmin: true },
  { id: 'metricas', label: '📊 Métricas', soloAdmin: true },
  { id: 'repartidores', label: '🛵 Repartidores', soloAdmin: true },
];

/** Reparto: por fuera de la caja del local. El personal carga; Administración ve todo. */
export default function RepartoPage() {
  const esAdmin = useAuth((s) => s.sesion?.rol === 'admin');
  const [vista, setVista] = useState<Vista>('cargar');
  const visibles = VISTAS.filter((v) => (v.soloAdmin === 'personal' ? !esAdmin : esAdmin || !v.soloAdmin));
  const actual = visibles.some((v) => v.id === vista) ? vista : 'cargar';

  return (
    <div className="h-full flex flex-col p-4 gap-3 min-h-0">
      {visibles.length > 1 && (
        <div className="flex gap-2">
          {visibles.map((v) => (
            <button
              key={v.id}
              onClick={() => setVista(v.id)}
              className={`px-4 py-2 rounded-lg font-semibold text-sm ${actual === v.id ? 'bg-acento text-white' : 'bg-base-700 hover:bg-base-600'}`}
            >
              {v.label}
            </button>
          ))}
        </div>
      )}
      <div className="flex-1 min-h-0">
        {actual === 'cargar' && <CargarLiquidacion />}
        {actual === 'historial' && <HistorialReparto />}
        {actual === 'cuentas' && <CuentasReparto />}
        {actual === 'metricas' && <MetricasReparto />}
        {actual === 'clientes' && <RepartidoresConfig soloClientes />}
        {actual === 'repartidores' && <RepartidoresConfig />}
      </div>
    </div>
  );
}
