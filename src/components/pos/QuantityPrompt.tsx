import { useState } from 'react';
import type { Producto } from '@shared/types';
import NumericKeypad from './NumericKeypad';
import { money } from '../../lib/format';

interface Props {
  producto: Producto;
  onConfirm: (cantidad: number) => void;
  onCancel: () => void;
}

/**
 * Pide cuántas unidades agregar. Prellenado en "1": para una sola alcanza con
 * Enter; para varias se tipea el número (teclado físico o en pantalla) y Enter.
 */
export default function QuantityPrompt({ producto, onConfirm, onCancel }: Props) {
  const [cantStr, setCantStr] = useState('1');
  const precio = producto.precio_unidad ?? 0;
  const cantidad = Math.max(0, Math.floor(parseFloat(cantStr || '0') || 0));
  const subtotal = precio * cantidad;

  const confirmar = () => {
    if (cantidad > 0) onConfirm(cantidad);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-40 p-4">
      <div className="card w-full max-w-md p-5">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-4xl">{producto.emoji}</span>
          <div>
            <div className="font-bold text-lg">{producto.nombre}</div>
            <div className="text-slate-400 text-sm">{money(precio)} c/u</div>
          </div>
        </div>

        <div className="bg-base-900 rounded-xl p-4 text-center mb-3">
          <div className="text-5xl font-black tabular-nums">
            {cantidad} <span className="text-2xl text-slate-400">u</span>
          </div>
          <div className="text-acento font-bold text-xl mt-1">{money(subtotal)}</div>
        </div>

        <div className="text-xs text-slate-400 mb-1">Cantidad (Enter para agregar):</div>
        <NumericKeypad
          value={cantStr}
          onChange={setCantStr}
          allowDecimal={false}
          onEnter={confirmar}
        />

        <div className="grid grid-cols-2 gap-2 mt-4">
          <button onClick={onCancel} className="btn-ghost py-3">
            Cancelar
          </button>
          <button onClick={confirmar} disabled={cantidad <= 0} className="btn-primary py-3">
            Agregar
          </button>
        </div>
      </div>
    </div>
  );
}
