import { useState } from 'react';
import { useAuth } from '../../store/authStore';

/** Primer arranque: crea el administrador y muestra el código de recuperación. */
export default function SetupWizard() {
  const { init } = useAuth();
  const [nombre, setNombre] = useState('');
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');

  async function crear() {
    setError('');
    if (usuario.trim().length < 3) return setError('El usuario debe tener al menos 3 caracteres');
    if (password.length < 4) return setError('La contraseña debe tener al menos 4 caracteres');
    if (password !== password2) return setError('Las contraseñas no coinciden');

    const res = await window.api.auth.setupAdmin({ nombre, usuario, password });
    if (!res.ok || !res.data) return setError(res.error ?? 'No se pudo crear el administrador');
    setRecoveryCode(res.data.recoveryCode);
  }

  if (recoveryCode) {
    return (
      <Centrado>
        <h1 className="text-2xl font-bold mb-2">✅ Administrador creado</h1>
        <p className="text-slate-400 mb-4">
          Guardá este <b>código de recuperación</b> en un lugar seguro. Es la única forma de
          resetear la contraseña si te la olvidás. <b>No se vuelve a mostrar.</b>
        </p>
        <div className="bg-base-900 border border-acento rounded-xl p-5 text-center mb-5">
          <div className="text-3xl font-black tracking-[0.3em] tabular-nums">{recoveryCode}</div>
        </div>
        <button onClick={() => init()} className="btn-primary w-full py-4 text-lg">
          Ya lo guardé, continuar
        </button>
      </Centrado>
    );
  }

  return (
    <Centrado>
      <h1 className="text-2xl font-bold mb-1">Bienvenido 👋</h1>
      <p className="text-slate-400 mb-5">Creá la cuenta del administrador para empezar.</p>

      <label className="block text-sm text-slate-400 mb-1">Tu nombre</label>
      <input className="input mb-3" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Fermín" />

      <label className="block text-sm text-slate-400 mb-1">Usuario (para entrar)</label>
      <input className="input mb-3" value={usuario} onChange={(e) => setUsuario(e.target.value)} placeholder="admin" autoCapitalize="none" />

      <label className="block text-sm text-slate-400 mb-1">Contraseña</label>
      <input type="password" className="input mb-3" value={password} onChange={(e) => setPassword(e.target.value)} />

      <label className="block text-sm text-slate-400 mb-1">Repetir contraseña</label>
      <input type="password" className="input mb-4" value={password2} onChange={(e) => setPassword2(e.target.value)} />

      {error && <div className="text-red-400 text-sm mb-3">{error}</div>}

      <button onClick={crear} className="btn-primary w-full py-4 text-lg">
        Crear administrador
      </button>
    </Centrado>
  );
}

export function Centrado({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full flex items-center justify-center p-4">
      <div className="card p-6 w-full max-w-md">{children}</div>
    </div>
  );
}
