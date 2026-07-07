import { useState, useEffect } from 'react';
import { useAuth } from '../../store/authStore';
import { money } from '../../lib/format';

interface Props {
  onClose: () => void;
}

/**
 * Cierre de caja simple, sin contar: el empleado deja en la caja el fondo con el
 * que empezó y guarda el excedente (las ventas) junto al ticket Z. NO cuenta nada.
 * El admin cuenta el sobre después y registra el resultado desde "Turnos".
 */
export default function CerrarTurno({ onClose }: Props) {
  const { sesion, logout, refrescarSesion } = useAuth();
  const [paso, setPaso] = useState<'fondo' | 'excedente'>('fondo');
  const [fondo, setFondo] = useState<number | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState('');
  const [hecho, setHecho] = useState('');

  useEffect(() => {
    window.api.turno.actual().then((t) => setFondo(t?.fondo_inicial ?? 0));
  }, []);

  async function confirmar() {
    setProcesando(true);
    setError('');
    const res = await window.api.turno.cerrar();
    setProcesando(false);
    if (!res.ok || !res.data) {
      setError(res.error ?? 'No se pudo cerrar el turno');
      return;
    }
    setHecho(
      res.data.ticketImpreso
        ? `✅ Caja cerrada (turno #${res.data.numero}). Ticket Z impreso.`
        : `✅ Caja cerrada (turno #${res.data.numero}). ⚠️ No se imprimió: ${res.data.errorImpresion ?? ''}`
    );
  }

  async function terminar() {
    if (sesion?.rol === 'empleada') await logout();
    else await refrescarSesion();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-40 p-4">
      <div className="card p-6 w-full max-w-md">
        {hecho ? (
          <>
            <h2 className="text-xl font-bold mb-3">Listo ✅</h2>
            <p className="text-slate-300 mb-5">{hecho}</p>
            <button onClick={terminar} className="btn-primary w-full py-4">
              {sesion?.rol === 'empleada' ? 'Salir' : 'Aceptar'}
            </button>
          </>
        ) : paso === 'fondo' ? (
          <>
            <h2 className="text-xl font-bold mb-4">Cerrar caja · Paso 1 de 2</h2>
            <div className="bg-amber-500/15 border border-amber-500/40 rounded-2xl p-5 mb-4 text-center">
              <div className="text-5xl mb-3">💰</div>
              <p className="text-lg text-amber-100">
                Dejá en la caja el dinero con el que <b>empezaste</b>:
              </p>
              <div className="text-4xl font-black text-amber-200 my-3 tabular-nums">
                {fondo != null ? money(fondo) : '…'}
              </div>
              <p className="text-sm text-amber-200/80">No retires este fondo. Queda para mañana.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={onClose} className="btn-ghost py-4">
                Cancelar
              </button>
              <button onClick={() => setPaso('excedente')} className="btn-primary py-4">
                Ya lo dejé →
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-xl font-bold mb-4">Cerrar caja · Paso 2 de 2</h2>
            <div className="bg-amber-500/15 border border-amber-500/40 rounded-2xl p-5 mb-4 text-center">
              <div className="text-5xl mb-3">🧾</div>
              <p className="text-lg text-amber-100">
                Ahora guardá <b>el resto del efectivo</b> (el excedente) junto con el{' '}
                <b>ticket Z</b> que se va a imprimir.
              </p>
              <p className="text-sm text-amber-200/80 mt-2">Listo, no tenés que contar nada.</p>
            </div>

            {error && <div className="text-red-400 text-sm mb-3 text-center">{error}</div>}

            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setPaso('fondo')} disabled={procesando} className="btn-ghost py-4">
                ← Volver
              </button>
              <button onClick={confirmar} disabled={procesando} className="btn-primary py-4">
                {procesando ? 'Cerrando…' : 'Cerrar caja e imprimir Z'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
