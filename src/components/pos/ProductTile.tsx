import type { Producto, Categoria } from '@shared/types';
import { money } from '../../lib/format';

interface Props {
  producto: Producto;
  categoria?: Categoria;
  onClick: () => void;
}

export default function ProductTile({ producto, categoria, onClick }: Props) {
  const color = producto.color ?? categoria?.color ?? '#3b82f6';

  const precioTexto = () => {
    if (producto.tipo_venta === 'peso') return `${money(producto.precio_kg ?? 0)}/kg`;
    if (producto.tipo_venta === 'ambos')
      return `${money(producto.precio_unidad ?? 0)} · ${money(producto.precio_kg ?? 0)}/kg`;
    return money(producto.precio_unidad ?? 0);
  };

  return (
    <button
      onClick={onClick}
      className="relative flex flex-col justify-between p-3 rounded-2xl text-left h-28
                 border border-white/10 hover:brightness-110 active:scale-[.97] transition
                 shadow-lg overflow-hidden"
      style={{ background: `linear-gradient(160deg, ${color}dd, ${color}88)` }}
    >
      <div className="flex items-start justify-between">
        <span className="text-3xl leading-none drop-shadow">{producto.emoji}</span>
        {producto.tipo_venta !== 'unidad' && (
          <span className="text-[10px] font-bold bg-black/30 rounded px-1.5 py-0.5 uppercase">
            {producto.tipo_venta === 'peso' ? 'peso' : 'u/peso'}
          </span>
        )}
      </div>
      <div>
        <div className="font-bold leading-tight text-sm line-clamp-2 drop-shadow">
          {producto.nombre}
        </div>
        <div className="text-xs font-semibold text-white/90">{precioTexto()}</div>
      </div>
    </button>
  );
}
