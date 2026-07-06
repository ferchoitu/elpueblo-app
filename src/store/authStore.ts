import { create } from 'zustand';
import type { Sesion } from '@shared/types';

interface AuthState {
  cargando: boolean;
  sesion: Sesion | null;
  necesitaSetup: boolean;
  init: () => Promise<void>;
  setSesion: (s: Sesion | null) => void;
  refrescarSesion: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  cargando: true,
  sesion: null,
  necesitaSetup: false,

  init: async () => {
    const [estado, sesion] = await Promise.all([
      window.api.auth.estadoInicial(),
      window.api.auth.sesion(),
    ]);
    set({ cargando: false, sesion, necesitaSetup: estado.necesitaSetup });
  },

  setSesion: (s) => set({ sesion: s }),

  refrescarSesion: async () => {
    const sesion = await window.api.auth.sesion();
    set({ sesion });
  },

  logout: async () => {
    await window.api.auth.logout();
    set({ sesion: null });
  },
}));
