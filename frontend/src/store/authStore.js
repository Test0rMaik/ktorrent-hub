import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Auth state — persisted to localStorage so sessions survive page reloads.
 * Klever addresses are klv1... format (bech32 Ed25519).
 */
export const useAuthStore = create(
  persist(
    (set) => ({
      token:         null,
      user:          null,
      isAuthed:      false,
      walletAddress: null,

      setAuth(token, user) {
        set({ token, user, isAuthed: true, walletAddress: user.wallet });
      },

      setUser(user) {
        set({ user, walletAddress: user.wallet });
      },

      logout() {
        set({ token: null, user: null, isAuthed: false, walletAddress: null });
      },
    }),
    {
      name:        'kth-auth',
      partialize: state => ({
        token:         state.token,
        user:          state.user,
        isAuthed:      state.isAuthed,
        walletAddress: state.walletAddress,
      }),
    },
  ),
);
