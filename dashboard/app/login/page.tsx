'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError('');
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    setCargando(false);
    if (res.ok) {
      router.replace('/');
      router.refresh();
    } else {
      setError('Contraseña incorrecta');
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={entrar} className="card p-6 w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-1">DEL PUEBLO</h1>
        <p className="text-slate-400 text-sm mb-5">Dashboard de ventas</p>
        <label className="block text-sm text-slate-400 mb-1">Contraseña</label>
        <input
          type="password"
          className="input w-full mb-3"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
        <button type="submit" disabled={cargando} className="btn-primary w-full">
          {cargando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </main>
  );
}
