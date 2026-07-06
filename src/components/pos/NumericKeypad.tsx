interface Props {
  value: string;
  onChange: (v: string) => void;
  allowDecimal?: boolean;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];

export default function NumericKeypad({ value, onChange, allowDecimal = true }: Props) {
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
