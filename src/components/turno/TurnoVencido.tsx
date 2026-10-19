import { useState } from 'react';
import type { TurnoActualEmpleada } from '@shared/types';
import { fechaHoraLocal } from '../../lib/fechas';
import CerrarTurno from './CerrarTurno';

/**
 * El turno abierto es de otro día (ej: ayer apagaron la compu sin cerrar la caja).
 * No se puede vender sobre ese turno: primero se cierra (con su Z) y después se
 * abre el turno de hoy con su fondo inicial.
 */
export default function TurnoVencido({ turno }: { turno: TurnoActualEmpleada }) {
  const [cerrando, setCerrando] = useState(false);

  return (
    <div className="h-full flex items-center justify-center p-4">
      <div className="card p-6 w-full max-w-md text-center">
        <div className="text-5xl mb-3">⚠️</div>
        <h1 className="text-2xl font-bold mb-2">Quedó una caja sin cerrar</h1>
        <p className="text-slate-300 mb-1">
          El turno <b>#{turno.numero}</b> se abrió el <b>{fechaHoraLocal(turno.apertura_at)}</b> y
          nunca se cerró.
        </p>
        <p className="text-slate-400 mb-5">
          Antes de empezar hay que cerrarlo. Después vas a cargar el fondo del turno de hoy.
        </p>
        <button onClick={() => setCerrando(true)} className="btn-primary w-full py-4 text-lg">
          🔒 Cerrar ese turno
        </button>
      </div>

      {cerrando && <CerrarTurno onClose={() => setCerrando(false)} continuar />}
    </div>
  );
}
