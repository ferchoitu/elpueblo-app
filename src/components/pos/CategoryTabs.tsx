import type { Categoria } from '@shared/types';

interface Props {
  categorias: Categoria[];
  activa: string | null; // null = todas
  onSelect: (id: string | null) => void;
}

export default function CategoryTabs({ categorias, activa, onSelect }: Props) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      <button
        onClick={() => onSelect(null)}
        className={`shrink-0 px-4 py-2 rounded-xl font-semibold ${
          activa === null ? 'bg-acento text-white' : 'bg-base-700 hover:bg-base-600'
        }`}
      >
        Todos
      </button>
      {categorias.map((c) => (
        <button
          key={c.id}
          onClick={() => onSelect(c.id)}
          className="shrink-0 px-4 py-2 rounded-xl font-semibold border-2 transition"
          style={
            activa === c.id
              ? { background: c.color, borderColor: c.color, color: 'white' }
              : { borderColor: c.color + '66', color: '#e2e8f0' }
          }
        >
          <span className="mr-1">{c.emoji}</span>
          {c.nombre}
        </button>
      ))}
    </div>
  );
}
