import { useState } from 'react';
import { useAuth } from '../../store/authStore';
import NumericKeypad from '../pos/NumericKeypad';
import { money } from '../../lib/format';

/** Pantalla de apertura de turno: se carga el fondo inicial (con qué plata arranca la caja). */
export default function AbrirTurno() {
  const { sesion, refrescarSesion } = useAuth();
  const [fondoStr, setFondoStr] = useState('');
  const [error, setError] = useState('');
  const [abriendo, setAbriendo] = useState(false);
  const fondo = parseFloat(fondoStr || '0') || 0;

  async function abrir() {
    setAbriendo(true);
    setError('');
    const res = await window.api.turno.abrir(fondo);
    setAbriendo(false);
    if (res.ok) await refrescarSesion();
    else setError(res.error ?? 'No se pudo abrir el turno');
  }

  return (
    <div className="h-full flex items-center justify-center p-4">
      <div className="card p-6 w-full max-w-md">
        <h1 className="text-2xl font-bold mb-1">Abrir turno</h1>
        <p className="text-slate-400 mb-4">
          Hola <b>{sesion?.nombre}</b>. ¿Con cuánto efectivo arranca la caja (fondo inicial)?
        </p>

        <div className="bg-base-900 rounded-xl p-4 text-center mb-4">
          <div className="text-xs text-slate-400">Fondo inicial</div>
          <div className="text-4xl font-black tabular-nums">{money(fondo)}</div>
        </div>

        <NumericKeypad value={fondoStr} onChange={setFondoStr} allowDecimal={false} />

        {error && <div className="text-red-400 text-sm mt-3">{error}</div>}

        <button onClick={abrir} disabled={abriendo} className="btn-primary w-full py-4 text-lg mt-4">
          {abriendo ? 'Abriendo…' : 'Abrir turno y empezar'}
        </button>
      </div>
    </div>
  );
}
