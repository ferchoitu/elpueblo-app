'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import type { Device } from '../lib/queries';

const PERIODOS: { id: string; label: string }[] = [
  { id: 'hoy', label: 'Hoy' },
  { id: 'semana', label: '7 días' },
  { id: 'mes', label: 'Mes' },
  { id: 'anio', label: 'Año' },
  { id: 'custom', label: 'Personalizado' },
];

export default function Filtros({ devices }: { devices: Device[] }) {
  const router = useRouter();
  const sp = useSearchParams();
  const periodo = sp.get('periodo') ?? 'mes';
  const device = sp.get('device') ?? '';
  const d1 = sp.get('d1') ?? '';
  const d2 = sp.get('d2') ?? '';

  function set(patch: Record<string, string>) {
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    router.push(`/?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap gap-1">
        {PERIODOS.map((p) => (
          <button
            key={p.id}
            onClick={() => set({ periodo: p.id })}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              periodo === p.id ? 'bg-acento text-base-900' : 'bg-base-700 hover:bg-base-600'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {periodo === 'custom' && (
        <div className="flex items-center gap-1 text-sm">
          <input
            type="date"
            value={d1}
            onChange={(e) => set({ periodo: 'custom', d1: e.target.value })}
            className="input py-1"
          />
          <span className="text-slate-500">→</span>
          <input
            type="date"
            value={d2}
            onChange={(e) => set({ periodo: 'custom', d2: e.target.value })}
            className="input py-1"
          />
        </div>
      )}

      {devices.length > 1 && (
        <select value={device} onChange={(e) => set({ device: e.target.value })} className="input py-1.5 text-sm">
          <option value="">Todas las cajas</option>
          {devices.map((d) => (
            <option key={d.id} value={d.id}>
              {d.nombre ?? d.id.slice(0, 8)}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
