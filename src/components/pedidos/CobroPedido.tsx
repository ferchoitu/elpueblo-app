import { useState } from 'react';
import type { MetodoPago, PagoPedidoInput } from '@shared/types';
import NumericKeypad from '../pos/NumericKeypad';
import { money } from '../../lib/format';

const METODOS: { id: MetodoPago; label: string; emoji: string }[] = [
  { id: 'efectivo', label: 'Efectivo', emoji: '💵' },
  { id: 'debito', label: 'Débito', emoji: '💳' },
  { id: 'credito', label: 'Crédito', emoji: '💳' },
  { id: 'qr', label: 'QR', emoji: '📱' },
  { id: 'transferencia', label: 'Transfer.', emoji: '🏦' },
];

interface Props {
  /**
   * sena: al tomar el pedido; el monto se tipea (puede ser 0 = sin seña).
   * saldo: al entregar; el monto es fijo (lo que falta) y en efectivo se calcula el vuelto.
   */
  modo: 'sena' | 'saldo';
  total: number; // sena: total del pedido · saldo: lo que falta pagar
  titulo: string;
  etiquetaConfirmar: string; // ej: "Guardar pedido" / "Entregar"
  procesando: boolean;
  error: string;
  onConfirmar: (pago: PagoPedidoInput | null, imprimir: boolean) => void;
  onCancelar: () => void;
}

export default function CobroPedido({
  modo,
  total,
  titulo,
  etiquetaConfirmar,
  procesando,
  error,
  onConfirmar,
  onCancelar,
}: Props) {
  const [metodo, setMetodo] = useState<MetodoPago | null>(null);
  // sena: monto de la seña · saldo: efectivo recibido (para el vuelto)
  const [valorStr, setValorStr] = useState('');
  const valor = parseFloat(valorStr || '0') || 0;

  const monto = modo === 'sena' ? valor : total;
  const hayCobro = monto > 0;
  const recibido = modo === 'saldo' && metodo === 'efectivo' ? valor : null;
  const efectivoInsuf = recibido != null && valorStr !== '' && recibido < monto;
  const senaExcede = modo === 'sena' && monto > total;
  const puedeConfirmar = !procesando && !senaExcede && !efectivoInsuf && (!hayCobro || !!metodo);

  function confirmar(imprimir: boolean) {
    const pago: PagoPedidoInput | null =
      hayCobro && metodo
        ? {
            monto,
            metodo_pago: metodo,
            monto_recibido: recibido != null && valorStr !== '' ? recibido : null,
          }
        : null;
    onConfirmar(pago, imprimir);
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">{titulo}</h2>
          <div className="text-right">
            <div className="text-xs text-slate-400">{modo === 'sena' ? 'Total del pedido' : 'Saldo a cobrar'}</div>
            <div className="text-3xl font-black text-acento tabular-nums">{money(total)}</div>
          </div>
        </div>

        {modo === 'saldo' && !hayCobro ? (
          <div className="bg-emerald-500/15 border border-emerald-500/40 rounded-xl p-4 mb-4 text-center text-emerald-200">
            ✅ Ya está pagado. Solo falta entregarlo.
          </div>
        ) : (
          <>
            {modo === 'sena' && (
              <div className="mb-3">
                <div className="flex justify-between items-center bg-base-900 rounded-xl p-3 mb-2">
                  <div>
                    <div className="text-xs text-slate-400">Deja de seña</div>
                    <div className={`text-2xl font-bold tabular-nums ${senaExcede ? 'text-red-400' : ''}`}>
                      {money(monto)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-400">Queda debiendo</div>
                    <div className="text-2xl font-black tabular-nums">{money(Math.max(0, total - monto))}</div>
                  </div>
                </div>
                <NumericKeypad value={valorStr} onChange={setValorStr} allowDecimal={false} />
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <button onClick={() => setValorStr('')} className="btn-ghost py-2 text-sm">
                    Sin seña
                  </button>
                  <button onClick={() => setValorStr(String(Math.round(total / 2)))} className="btn-ghost py-2 text-sm">
                    50%
                  </button>
                  <button onClick={() => setValorStr(String(Math.round(total)))} className="btn-ghost py-2 text-sm">
                    Pago total
                  </button>
                </div>
                {senaExcede && <div className="text-red-400 text-sm mt-2">La seña no puede superar el total.</div>}
              </div>
            )}

            {hayCobro && (
              <>
                <div className="text-sm text-slate-400 mb-2">Método de pago</div>
                <div className="grid grid-cols-5 gap-2 mb-3">
                  {METODOS.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setMetodo(m.id)}
                      className={`py-3 rounded-xl font-semibold ${
                        metodo === m.id ? 'bg-acento text-white' : 'bg-base-700 hover:bg-base-600'
                      }`}
                    >
                      <div className="text-xl">{m.emoji}</div>
                      <div className="text-xs">{m.label}</div>
                    </button>
                  ))}
                </div>
              </>
            )}

            {modo === 'saldo' && metodo === 'efectivo' && (
              <div className="mb-3">
                <div className="flex justify-between items-center bg-base-900 rounded-xl p-3 mb-2">
                  <div>
                    <div className="text-xs text-slate-400">Recibido</div>
                    <div className="text-2xl font-bold tabular-nums">{money(valor)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-400">Vuelto</div>
                    <div className={`text-2xl font-black tabular-nums ${efectivoInsuf ? 'text-red-400' : 'text-acento'}`}>
                      {efectivoInsuf ? 'Falta ' + money(monto - valor) : money(Math.max(0, valor - monto))}
                    </div>
                  </div>
                </div>
                <NumericKeypad value={valorStr} onChange={setValorStr} allowDecimal={false} />
              </div>
            )}
          </>
        )}

        {error && <div className="text-red-400 text-sm mb-2">{error}</div>}

        <div className="grid grid-cols-2 gap-2 mb-2">
          <button onClick={() => confirmar(false)} disabled={!puedeConfirmar} className="btn-ghost py-4 font-semibold">
            {procesando ? 'Guardando…' : `${etiquetaConfirmar} sin ticket`}
          </button>
          <button onClick={() => confirmar(true)} disabled={!puedeConfirmar} className="btn-primary py-4">
            {procesando ? 'Guardando…' : `🧾 ${etiquetaConfirmar} e imprimir`}
          </button>
        </div>
        <button onClick={onCancelar} disabled={procesando} className="btn-ghost py-3 w-full text-sm">
          ← Volver
        </button>
      </div>
    </div>
  );
}
