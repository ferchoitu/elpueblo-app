import { useState } from 'react';
import { useAuth } from '../../store/authStore';
import NumericKeypad from '../pos/NumericKeypad';
import { money } from '../../lib/format';

interface Props {
  onClose: () => void;
}

/**
 * Cierre de caja "a ciegas": la empleada cuenta el efectivo y lo carga, pero NO ve
 * el esperado ni la diferencia. Al confirmar se imprime el ticket de cierre y,
 * si es empleada, se cierra la sesión. El arqueo lo revisa el admin en "Turnos".
 */
export default function CerrarTurno({ onClose }: Props) {
  const { sesion, logout, refrescarSesion } = useAuth();
  const [contadoStr, setContadoStr] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState('');
  const [hecho, setHecho] = useState<string>('');
  const contado = parseFloat(contadoStr || '0') || 0;

  async function confirmar() {
    setProcesando(true);
    setError('');
    const res = await window.api.turno.cerrar(contado);
    setProcesando(false);
    if (!res.ok || !res.data) {
      setError(res.error ?? 'No se pudo cerrar el turno');
      return;
    }
    const aviso = res.data.ticketImpreso
      ? `✅ Turno #${res.data.numero} cerrado. Ticket impreso.`
      : `✅ Turno #${res.data.numero} cerrado. ⚠️ No se imprimió: ${res.data.errorImpresion ?? ''}`;
    setHecho(aviso);
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
            <h2 className="text-xl font-bold mb-3">Cierre registrado</h2>
            <p className="text-slate-300 mb-5">{hecho}</p>
            <button onClick={terminar} className="btn-primary w-full py-4">
              {sesion?.rol === 'empleada' ? 'Salir' : 'Aceptar'}
            </button>
          </>
        ) : (
          <>
            <h2 className="text-xl font-bold mb-1">Cerrar caja</h2>
            <p className="text-slate-400 mb-4 text-sm">
              Contá todo el efectivo que hay en la caja e ingresá el total. El arqueo lo revisa el
              administrador.
            </p>

            <div className="bg-base-900 rounded-xl p-4 text-center mb-4">
              <div className="text-xs text-slate-400">Efectivo contado</div>
              <div className="text-4xl font-black tabular-nums">{money(contado)}</div>
            </div>

            <NumericKeypad value={contadoStr} onChange={setContadoStr} allowDecimal={false} />

            {error && <div className="text-red-400 text-sm mt-3">{error}</div>}

            <div className="grid grid-cols-2 gap-2 mt-4">
              <button onClick={onClose} disabled={procesando} className="btn-ghost py-4">
                Cancelar
              </button>
              <button onClick={confirmar} disabled={procesando || contado <= 0} className="btn-primary py-4">
                {procesando ? 'Cerrando…' : 'Cerrar caja'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
