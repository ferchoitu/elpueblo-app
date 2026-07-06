import { useState } from 'react';
import type { MetodoPago, NuevaVenta } from '@shared/types';
import { useCart } from '../../store/cartStore';
import NumericKeypad from './NumericKeypad';
import { money } from '../../lib/format';

interface Props {
  onClose: (mensaje?: string) => void;
}

const METODOS: { id: MetodoPago; label: string; emoji: string }[] = [
  { id: 'efectivo', label: 'Efectivo', emoji: '💵' },
  { id: 'debito', label: 'Débito', emoji: '💳' },
  { id: 'credito', label: 'Crédito', emoji: '💳' },
  { id: 'qr', label: 'QR', emoji: '📱' },
  { id: 'transferencia', label: 'Transfer.', emoji: '🏦' },
];

export default function CheckoutModal({ onClose }: Props) {
  const { items, total, limpiar } = useCart();
  const totalNum = total();

  const [metodo, setMetodo] = useState<MetodoPago | null>(null);
  const [recibidoStr, setRecibidoStr] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState('');

  const recibido = parseFloat(recibidoStr || '0') || 0;
  const vuelto = Math.max(0, recibido - totalNum);
  const efectivoInsuf = metodo === 'efectivo' && recibido < totalNum;

  async function confirmar() {
    if (!metodo) return;
    setProcesando(true);
    setError('');

    const payload: NuevaVenta = {
      items: items.map(({ key, emoji, ...rest }) => rest),
      total: totalNum,
      metodo_pago: metodo,
      monto_recibido: metodo === 'efectivo' ? recibido : null,
      vuelto: metodo === 'efectivo' ? vuelto : null,
    };

    const res = await window.api.venta.crear(payload);
    if (!res.ok || !res.data) {
      setProcesando(false);
      setError(res.error ?? 'No se pudo registrar la venta');
      return;
    }

    // Imprimir ticket (no bloquea el cierre de la venta si la impresora falla).
    const imp = await window.api.ticket.imprimir(res.data);

    limpiar();
    setProcesando(false);
    onClose(
      imp.ok
        ? `✅ Venta #${res.data.numero} registrada`
        : `✅ Venta #${res.data.numero} registrada — ⚠️ no se imprimió: ${imp.error}`
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-40 p-4">
      <div className="card w-full max-w-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Cobrar</h2>
          <div className="text-3xl font-black text-acento tabular-nums">{money(totalNum)}</div>
        </div>

        <div className="text-sm text-slate-400 mb-2">Método de pago</div>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {METODOS.map((m) => (
            <button
              key={m.id}
              onClick={() => setMetodo(m.id)}
              className={`py-4 rounded-xl font-semibold ${
                metodo === m.id ? 'bg-acento text-white' : 'bg-base-700 hover:bg-base-600'
              }`}
            >
              <div className="text-2xl">{m.emoji}</div>
              <div className="text-sm">{m.label}</div>
            </button>
          ))}
        </div>

        {metodo === 'efectivo' && (
          <div className="mb-4">
            <div className="flex justify-between items-center bg-base-900 rounded-xl p-3 mb-2">
              <div>
                <div className="text-xs text-slate-400">Recibido</div>
                <div className="text-2xl font-bold tabular-nums">{money(recibido)}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-400">Vuelto</div>
                <div
                  className={`text-2xl font-black tabular-nums ${
                    efectivoInsuf ? 'text-red-400' : 'text-acento'
                  }`}
                >
                  {efectivoInsuf ? 'Falta ' + money(totalNum - recibido) : money(vuelto)}
                </div>
              </div>
            </div>
            <NumericKeypad value={recibidoStr} onChange={setRecibidoStr} />
            <div className="grid grid-cols-3 gap-2 mt-2">
              {[totalNum, 5000, 10000].map((v, i) => (
                <button
                  key={i}
                  onClick={() => setRecibidoStr(String(Math.round(v)))}
                  className="btn-ghost py-2 text-sm"
                >
                  {i === 0 ? 'Justo' : money(v)}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && <div className="text-red-400 text-sm mb-2">{error}</div>}

        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => onClose()} disabled={procesando} className="btn-ghost py-4">
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={!metodo || efectivoInsuf || procesando}
            className="btn-primary py-4 text-lg"
          >
            {procesando ? 'Procesando…' : 'Confirmar e imprimir'}
          </button>
        </div>
      </div>
    </div>
  );
}
