import { useAuthStore } from '../store/authStore';

/**
 * Returns true if the connected wallet matches the OWNER_WALLET
 * that the frontend is told about via the settings endpoint.
 *
 * We derive admin status from whether the /api/admin/* calls succeed (403 = not admin).
 * The frontend also reads the owner wallet from a public env var so it can
 * hide/show the admin link without an extra round-trip.
 */
export function useAdmin() {
  const { isAuthed, walletAddress } = useAuthStore();
  const ownerWallet = (import.meta.env.VITE_OWNER_WALLET || '').toLowerCase();

  const isAdmin = isAuthed && !!ownerWallet && walletAddress?.toLowerCase() === ownerWallet;

  return { isAdmin };
}
