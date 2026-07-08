'use client';

import { useRouter } from 'next/navigation';

export default function LogoutButton() {
  const router = useRouter();
  async function salir() {
    await fetch('/api/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  }
  return (
    <button onClick={salir} className="btn-ghost text-sm">
      Salir
    </button>
  );
}
