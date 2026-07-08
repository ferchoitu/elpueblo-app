import { useEffect } from 'react';

interface Props {
  value: string;
  onChange: (v: string) => void;
  allowDecimal?: boolean;
  /** Si se pasa, Enter en el teclado físico dispara esta acción (ej: confirmar). */
  onEnter?: () => void;
  /**
   * Escuchar el teclado físico (por defecto sí). Ponerlo en false si hay más de
   * un teclado montado a la vez para que no reciban la misma tecla dos veces.
   */
  keyboard?: boolean;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];

export default function NumericKeypad({
  value,
  onChange,
  allowDecimal = true,
  onEnter,
  keyboard = true,
}: Props) {
  const press = (k: string) => {
    if (k === '⌫') {
      onChange(value.slice(0, -1));
      return;
    }
    if (k === '.') {
      if (!allowDecimal || value.includes('.')) return;
      onChange(value === '' ? '0.' : value + '.');
      return;
    }
    // Evitar ceros a la izquierda inútiles.
    if (value === '0') {
      onChange(k);
      return;
    }
    onChange(value + k);
  };

  // Teclado físico: dígitos, punto/coma (decimal), backspace y Enter (confirmar).
  useEffect(() => {
    if (!keyboard) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // Si el foco está en un campo de texto real, dejá que el teclado escriba ahí
      // (ej: la descripción del monto libre) en vez de robar la tecla para el pad.
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key >= '0' && e.key <= '9') {
        press(e.key);
        e.preventDefault();
      } else if (e.key === '.' || e.key === ',') {
        press('.');
        e.preventDefault();
      } else if (e.key === 'Backspace') {
        press('⌫');
        e.preventDefault();
      } else if (e.key === 'Enter' && onEnter) {
        onEnter();
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // Se re-liga en cada cambio para que `press`/`onEnter` usen el valor actual.
  }, [value, allowDecimal, onEnter, keyboard]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="grid grid-cols-3 gap-2">
      {KEYS.map((k) => (
        <button
          key={k}
          onClick={() => press(k)}
          disabled={k === '.' && !allowDecimal}
          className="btn-ghost text-2xl py-5 disabled:opacity-30"
        >
          {k}
        </button>
      ))}
    </div>
  );
}
