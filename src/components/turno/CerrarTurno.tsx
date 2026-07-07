import { useState, useEffect } from 'react';
import { useAuth } from '../../store/authStore';
import NumericKeypad from '../pos/NumericKeypad';
import { money } from '../../lib/format';

interface Props {
  onClose: () => void;
}

/**
 * Cierre de caja "por retiro", a ciegas y en 2 pasos:
 *   1) el empleado marca el FONDO que deja en la caja (pre-cargado con lo que abrió);
 *   2) marca el EXCEDENTE que retira (las ventas).
 * NO ve esperado ni diferencia. Se imprime el ticket Z y, si es empleada, se cierra
 * la sesión. El arqueo (y el fondo apertura/cierre) los revisa el admin.
 */
export default function CerrarTurno({ onClose }: Props) {
  const { sesion, logout, refrescarSesion } = useAuth();
  const [paso, setPaso] = useState<'fondo' | 'retiro'>('fondo');
  const [fondoApertura, setFondoApertura] = useState<number | null>(null);
  const [fondoStr, setFondoStr] = useState('');
  const [retiradoStr, setRetiradoStr] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState('');
  const [hecho, setHecho] = useState('');

  const fondo = parseFloat(fondoStr || '0') || 0;
  const retirado = parseFloat(retiradoStr || '0') || 0;

  // Traemos el fondo con el que se abrió y lo pre-cargamos como sugerencia.
  useEffect(() => {
    window.api.turno.actual().then((t) => {
      const f = t?.fondo_inicial ?? 0;
      setFondoApertura(f);
      setFondoStr(String(Math.round(f)));
    });
  }, []);

  async function confirmar() {
    setProcesando(true);
    setError('');
    const res = await window.api.turno.cerrar(retirado, fondo);
    setProcesando(false);
    if (!res.ok || !res.data) {
      setError(res.error ?? 'No se pudo cerrar el turno');
      return;
    }
    setHecho(
      res.data.ticketImpreso
        ? `✅ Turno #${res.data.numero} cerrado. Ticket impreso.`
        : `✅ Turno #${res.data.numero} cerrado. ⚠️ No se imprimió: ${res.data.errorImpresion ?? ''}`
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
            <h2 className="text-xl font-bold mb-3">Cierre registrado</h2>
            <p className="text-slate-300 mb-5">{hecho}</p>
            <button onClick={terminar} className="btn-primary w-full py-4">
              {sesion?.rol === 'empleada' ? 'Salir' : 'Aceptar'}
            </button>
          </>
        ) : paso === 'fondo' ? (
          <>
            <h2 className="text-xl font-bold mb-1">Cerrar caja · Paso 1 de 2</h2>
            <div className="bg-amber-500/15 border border-amber-500/40 rounded-xl p-3 mb-4">
              <p className="text-sm text-amber-200">
                ¿Cuánto <b>fondo</b> dejás en la caja para el próximo turno? Sugerido: lo que abriste
                {fondoApertura != null && <b className="text-amber-100"> ({money(fondoApertura)})</b>}.
              </p>
            </div>

            <div className="bg-base-900 rounded-xl p-4 text-center mb-4">
              <div className="text-xs text-slate-400">Fondo que dejás en la caja</div>
              <div className="text-4xl font-black tabular-nums">{money(fondo)}</div>
            </div>

            <NumericKeypad value={fondoStr} onChange={setFondoStr} allowDecimal={false} />

            <div className="grid grid-cols-2 gap-2 mt-4">
              <button onClick={onClose} className="btn-ghost py-4">
                Cancelar
              </button>
              <button onClick={() => setPaso('retiro')} className="btn-primary py-4">
                Siguiente →
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-xl font-bold mb-1">Cerrar caja · Paso 2 de 2</h2>
            <div className="bg-amber-500/15 border border-amber-500/40 rounded-xl p-3 mb-4">
              <p className="text-sm text-amber-200">
                Dejaste <b className="text-amber-100">{money(fondo)}</b> de fondo. Ahora retirá el{' '}
                <b>excedente</b> (las ventas) y guardalo junto al <b>ticket Z</b>. ¿Cuánto retirás?
              </p>
            </div>

            <div className="bg-base-900 rounded-xl p-4 text-center mb-4">
              <div className="text-xs text-slate-400">Efectivo que retirás</div>
              <div className="text-4xl font-black tabular-nums">{money(retirado)}</div>
            </div>

            <NumericKeypad value={retiradoStr} onChange={setRetiradoStr} allowDecimal={false} />

            {error && <div className="text-red-400 text-sm mt-3">{error}</div>}

            <div className="grid grid-cols-2 gap-2 mt-4">
              <button onClick={() => setPaso('fondo')} disabled={procesando} className="btn-ghost py-4">
                ← Volver
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
