import { useState, useEffect, useCallback } from 'react';
import type { Producto } from '@shared/types';
import NumericKeypad from './NumericKeypad';
import { money } from '../../lib/format';

interface Props {
  producto: Producto;
  onConfirm: (gramos: number) => void;
  onCancel: () => void;
}

/**
 * Pide el peso a la balanza y permite corregirlo a mano.
 * La caja nunca se traba: si la balanza falla, se ingresa manualmente.
 */
export default function WeightPrompt({ producto, onConfirm, onCancel }: Props) {
  const [gramosStr, setGramosStr] = useState('');
  const [leyendo, setLeyendo] = useState(false);
  const [estado, setEstado] = useState<string>('');
  const precioKg = producto.precio_kg ?? 0;

  const leerBalanza = useCallback(async () => {
    setLeyendo(true);
    setEstado('Leyendo balanza…');
    const r = await window.api.balanza.pedirPeso();
    setLeyendo(false);
    if (r.ok) {
      setGramosStr(String(r.gramos));
      setEstado(r.estable ? '✅ Peso estable' : '⚠️ Peso inestable, verificá');
    } else {
      setEstado(r.error ?? 'No se pudo leer la balanza. Ingresá el peso a mano.');
    }
  }, []);

  useEffect(() => {
    leerBalanza();
  }, [leerBalanza]);

  const gramos = parseFloat(gramosStr || '0') || 0;
  const subtotal = (precioKg * gramos) / 1000;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-40 p-4">
      <div className="card w-full max-w-md p-5">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-4xl">{producto.emoji}</span>
          <div>
            <div className="font-bold text-lg">{producto.nombre}</div>
            <div className="text-slate-400 text-sm">{money(precioKg)}/kg</div>
          </div>
        </div>

        <div className="bg-base-900 rounded-xl p-4 text-center mb-3">
          <div className="text-5xl font-black tabular-nums">
            {gramos.toLocaleString('es-AR')} <span className="text-2xl text-slate-400">g</span>
          </div>
          <div className="text-acento font-bold text-xl mt-1">{money(subtotal)}</div>
          <div className="text-sm text-slate-400 mt-1 min-h-[1.25rem]">{estado}</div>
        </div>

        <button onClick={leerBalanza} disabled={leyendo} className="btn-ghost w-full py-3 mb-3">
          {leyendo ? 'Leyendo…' : '⚖️ Volver a leer balanza'}
        </button>

        <div className="text-xs text-slate-400 mb-1">O ingresá los gramos a mano:</div>
        <NumericKeypad
          value={gramosStr}
          onChange={setGramosStr}
          allowDecimal={false}
          onEnter={() => gramos > 0 && onConfirm(gramos)}
        />

        <div className="grid grid-cols-2 gap-2 mt-4">
          <button onClick={onCancel} className="btn-ghost py-3">
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(gramos)}
            disabled={gramos <= 0}
            className="btn-primary py-3"
          >
            Agregar
          </button>
        </div>
      </div>
    </div>
  );
}
