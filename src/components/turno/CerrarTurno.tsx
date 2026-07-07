import { useState, useEffect } from 'react';
import { useAuth } from '../../store/authStore';
import NumericKeypad from '../pos/NumericKeypad';
import { money } from '../../lib/format';

interface Props {
  onClose: () => void;
}

/**
 * Cierre de caja "por retiro", a ciegas: el fondo inicial queda en la caja; el
 * empleado retira el excedente (las ventas) y lo carga. NO ve esperado ni
 * diferencia. Al confirmar se imprime el ticket Z y, si es empleada, se cierra la
 * sesión. El arqueo lo revisa el admin en "Turnos".
 */
export default function CerrarTurno({ onClose }: Props) {
  const { sesion, logout, refrescarSesion } = useAuth();
  const [retiradoStr, setRetiradoStr] = useState('');
  const [fondo, setFondo] = useState<number | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState('');
  const [hecho, setHecho] = useState<string>('');
  const retirado = parseFloat(retiradoStr || '0') || 0;

  // Traemos el fondo inicial del turno para recordarle cuánto dejar en la caja.
  useEffect(() => {
    window.api.turno.actual().then((t) => setFondo(t?.fondo_inicial ?? 0));
  }, []);

  async function confirmar() {
    setProcesando(true);
    setError('');
    const res = await window.api.turno.cerrar(retirado);
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

            {/* Recordatorio: dejar el fondo, retirar el excedente con el ticket Z */}
            <div className="bg-amber-500/15 border border-amber-500/40 rounded-xl p-3 mb-4">
              <p className="text-sm text-amber-200">
                Dejá{' '}
                <b className="text-amber-100">
                  {fondo != null ? money(fondo) : '…'}
                </b>{' '}
                de fondo en la caja (con lo que abriste el turno). Retirá el <b>excedente</b> (las
                ventas) y guardalo junto al <b>ticket Z</b>. Ingresá cuánto retirás:
              </p>
            </div>

            <div className="bg-base-900 rounded-xl p-4 text-center mb-4">
              <div className="text-xs text-slate-400">Efectivo que retirás</div>
              <div className="text-4xl font-black tabular-nums">{money(retirado)}</div>
            </div>

            <NumericKeypad value={retiradoStr} onChange={setRetiradoStr} allowDecimal={false} />

            {error && <div className="text-red-400 text-sm mt-3">{error}</div>}

            <div className="grid grid-cols-2 gap-2 mt-4">
              <button onClick={onClose} disabled={procesando} className="btn-ghost py-4">
                Cancelar
              </button>
              <button
                onClick={confirmar}
                disabled={procesando || retirado <= 0}
                className="btn-primary py-4"
              >
                {procesando ? 'Cerrando…' : 'Cerrar caja'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
