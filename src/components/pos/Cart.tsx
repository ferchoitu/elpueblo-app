import { useCart } from '../../store/cartStore';
import { money, cantidadTexto } from '../../lib/format';

interface Props {
  onCobrar: () => void;
}

export default function Cart({ onCobrar }: Props) {
  const { items, total, incrementar, decrementar, eliminar, limpiar } = useCart();
  const totalNum = total();

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-base-700">
        <h2 className="font-bold text-lg">Carrito</h2>
        {items.length > 0 && (
          <button onClick={limpiar} className="text-sm text-slate-400 hover:text-red-400">
            Vaciar
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-2 py-2 space-y-1">
        {items.length === 0 && (
          <div className="h-full flex items-center justify-center text-slate-500 text-center px-6">
            Tocá un producto para empezar a cobrar
          </div>
        )}
        {items.map((it) => (
          <div key={it.key} className="flex items-center gap-2 bg-base-700/60 rounded-xl p-2">
            <span className="text-2xl">{it.emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm truncate">{it.nombre_producto}</div>
              <div className="text-xs text-slate-400">
                {cantidadTexto(it.cantidad, it.unidad)} · {money(it.subtotal)}
              </div>
            </div>
            {it.tipo_venta_usado === 'unidad' ? (
              <div className="flex items-center gap-1">
                <button onClick={() => decrementar(it.key)} className="btn-ghost w-8 h-8 text-lg">
                  −
                </button>
                <span className="w-6 text-center font-bold">{it.cantidad}</span>
                <button onClick={() => incrementar(it.key)} className="btn-ghost w-8 h-8 text-lg">
                  +
                </button>
              </div>
            ) : (
              <span className="text-xs font-mono text-slate-300">{it.cantidad}g</span>
            )}
            <button
              onClick={() => eliminar(it.key)}
              className="w-8 h-8 rounded-lg bg-base-600 hover:bg-red-600 text-lg"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="border-t border-base-700 p-4 space-y-3">
        <div className="flex items-end justify-between">
          <span className="text-slate-400 font-semibold">TOTAL</span>
          <span className="text-4xl font-black tabular-nums">{money(totalNum)}</span>
        </div>
        <button
          onClick={onCobrar}
          disabled={items.length === 0}
          className="btn-primary w-full py-5 text-2xl"
        >
          COBRAR
        </button>
      </div>
    </div>
  );
}
