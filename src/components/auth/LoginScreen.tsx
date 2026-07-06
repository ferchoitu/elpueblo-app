import { useEffect, useState, useCallback } from 'react';
import type { Usuario } from '@shared/types';
import { useAuth } from '../../store/authStore';
import NumericKeypad from '../pos/NumericKeypad';
import { Centrado } from './SetupWizard';

type Modo = 'elegir' | 'pin' | 'admin' | 'recovery';

export default function LoginScreen() {
  const { setSesion } = useAuth();
  const [empleadas, setEmpleadas] = useState<Usuario[]>([]);
  const [modo, setModo] = useState<Modo>('elegir');
  const [sel, setSel] = useState<Usuario | null>(null);

  const cargar = useCallback(async () => {
    setEmpleadas(await window.api.usuarios.listarEmpleadas());
  }, []);
  useEffect(() => {
    cargar();
  }, [cargar]);

  if (modo === 'pin' && sel) {
    return <PinPad empleada={sel} onBack={() => setModo('elegir')} onOk={setSesion} />;
  }
  if (modo === 'admin') {
    return <AdminLogin onBack={() => setModo('elegir')} onOk={setSesion} onRecovery={() => setModo('recovery')} />;
  }
  if (modo === 'recovery') {
    return <RecoveryForm onBack={() => setModo('admin')} />;
  }

  return (
    <Centrado>
      <h1 className="text-2xl font-bold mb-1">DEL PUEBLO · Caja</h1>
      <p className="text-slate-400 mb-5">Elegí tu usuario para entrar.</p>

      {empleadas.length > 0 && (
        <>
          <div className="text-sm text-slate-400 mb-2">Empleadas</div>
          <div className="grid grid-cols-2 gap-2 mb-5">
            {empleadas.map((e) => (
              <button
                key={e.id}
                onClick={() => {
                  setSel(e);
                  setModo('pin');
                }}
                className="btn-ghost py-5 text-lg"
              >
                👤 {e.nombre}
              </button>
            ))}
          </div>
        </>
      )}

      <button onClick={() => setModo('admin')} className="btn-primary w-full py-4">
        🔑 Entrar como administrador
      </button>
    </Centrado>
  );
}

function PinPad({
  empleada,
  onBack,
  onOk,
}: {
  empleada: Usuario;
  onBack: () => void;
  onOk: (s: import('@shared/types').Sesion) => void;
}) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  async function intentar(valor: string) {
    const res = await window.api.auth.loginEmpleada(empleada.id, valor);
    if (res.ok && res.data) onOk(res.data);
    else {
      setError('PIN incorrecto');
      setPin('');
    }
  }

  function onChange(v: string) {
    if (v.length > 4) return;
    setError('');
    setPin(v);
    if (v.length === 4) intentar(v);
  }

  return (
    <Centrado>
      <button onClick={onBack} className="text-slate-400 mb-2">
        ← Volver
      </button>
      <h1 className="text-xl font-bold mb-1">Hola, {empleada.nombre}</h1>
      <p className="text-slate-400 mb-4">Ingresá tu PIN de 4 dígitos.</p>

      <div className="flex justify-center gap-3 mb-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`w-5 h-5 rounded-full border-2 ${
              pin.length > i ? 'bg-acento border-acento' : 'border-base-500'
            }`}
          />
        ))}
      </div>
      {error && <div className="text-red-400 text-sm mb-2 text-center">{error}</div>}
      <NumericKeypad value={pin} onChange={onChange} allowDecimal={false} />
    </Centrado>
  );
}

function AdminLogin({
  onBack,
  onOk,
  onRecovery,
}: {
  onBack: () => void;
  onOk: (s: import('@shared/types').Sesion) => void;
  onRecovery: () => void;
}) {
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function entrar() {
    setError('');
    const res = await window.api.auth.loginAdmin(usuario, password);
    if (res.ok && res.data) onOk(res.data);
    else setError(res.error ?? 'No se pudo iniciar sesión');
  }

  return (
    <Centrado>
      <button onClick={onBack} className="text-slate-400 mb-2">
        ← Volver
      </button>
      <h1 className="text-xl font-bold mb-4">Administrador</h1>
      <label className="block text-sm text-slate-400 mb-1">Usuario</label>
      <input className="input mb-3" value={usuario} onChange={(e) => setUsuario(e.target.value)} autoCapitalize="none" />
      <label className="block text-sm text-slate-400 mb-1">Contraseña</label>
      <input
        type="password"
        className="input mb-4"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && entrar()}
      />
      {error && <div className="text-red-400 text-sm mb-3">{error}</div>}
      <button onClick={entrar} className="btn-primary w-full py-4 mb-3">
        Entrar
      </button>
      <button onClick={onRecovery} className="text-slate-400 text-sm w-full text-center">
        ¿Olvidaste la contraseña?
      </button>
    </Centrado>
  );
}

function RecoveryForm({ onBack }: { onBack: () => void }) {
  const [usuario, setUsuario] = useState('');
  const [code, setCode] = useState('');
  const [nueva, setNueva] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  async function resetear() {
    setError('');
    setMsg('');
    const res = await window.api.auth.resetAdmin(usuario, code, nueva);
    if (res.ok) setMsg('✅ Contraseña actualizada. Ya podés entrar.');
    else setError(res.error ?? 'No se pudo resetear');
  }

  return (
    <Centrado>
      <button onClick={onBack} className="text-slate-400 mb-2">
        ← Volver
      </button>
      <h1 className="text-xl font-bold mb-1">Recuperar contraseña</h1>
      <p className="text-slate-400 mb-4 text-sm">
        Usá el código de recuperación que anotaste al crear el administrador.
      </p>
      <label className="block text-sm text-slate-400 mb-1">Usuario admin</label>
      <input className="input mb-3" value={usuario} onChange={(e) => setUsuario(e.target.value)} autoCapitalize="none" />
      <label className="block text-sm text-slate-400 mb-1">Código de recuperación</label>
      <input className="input mb-3" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ej: A1B2C3D4E5" />
      <label className="block text-sm text-slate-400 mb-1">Nueva contraseña</label>
      <input type="password" className="input mb-4" value={nueva} onChange={(e) => setNueva(e.target.value)} />
      {error && <div className="text-red-400 text-sm mb-3">{error}</div>}
      {msg && <div className="text-acento text-sm mb-3">{msg}</div>}
      <button onClick={resetear} className="btn-primary w-full py-4">
        Resetear contraseña
      </button>
    </Centrado>
  );
}
