import { useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';
import { connectKleverWallet, signMessage, getCurrentAccount } from '../lib/klever';
import { fetchNonce, verifyAuth, logout as apiLogout } from '../lib/api';
import { useAuthStore } from '../store/authStore';

export function useAuth() {
  const { token, user, isAuthed, setAuth, setUser, logout: storeLogout } = useAuthStore();

  // Sync wallet address on mount (in case extension state changed)
  useEffect(() => {
    if (isAuthed) return;
    const account = getCurrentAccount();
    if (account?.address) {
      useAuthStore.setState({ walletAddress: account.address });
    }
  }, []);

  /**
   * Connect Klever wallet and sign in via Ed25519 challenge.
   * If an invite code is required (new user + require_invite enabled),
   * the caller can pass inviteCode or the function will prompt for one.
   */
  const signIn = useCallback(async (inviteCode) => {
    try {
      // 1. Connect wallet (prompts extension if needed)
      const account = await connectKleverWallet();
      const address = account.address;

      // 2. Get a one-time challenge from the backend
      const { message, nonce } = await fetchNonce(address);

      // 3. Sign the challenge with the Klever extension
      const signature = await signMessage(message);

      // 4. Verify on the backend — get session token
      const payload = { wallet: address, nonce, signature };
      if (inviteCode) payload.invite_code = inviteCode;

      const { token: sessionToken, user: userData } = await verifyAuth(payload);

      setAuth(sessionToken, userData);
      toast.success('Signed in with Klever Wallet');
      return { success: true };
    } catch (err) {
      const errorCode = err?.response?.data?.error;
      const msg       = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Sign-in failed';

      // Invite code required — signal to the UI to show the invite prompt
      if (errorCode === 'invite_required') {
        return { success: false, inviteRequired: true };
      }
      if (errorCode === 'invalid_invite' || errorCode === 'invite_used') {
        toast.error(msg);
        return { success: false, inviteRequired: true, inviteError: msg };
      }

      toast.error(msg);
      return { success: false };
    }
  }, [setAuth]);

  const signOut = useCallback(async () => {
    await apiLogout().catch(() => {});
    storeLogout();
    toast.success('Signed out');
  }, [storeLogout]);

  const walletAddress = user?.wallet ?? getCurrentAccount()?.address ?? null;

  return {
    walletAddress,
    isAuthed,
    user,
    token,
    signIn,
    signOut,
  };
}
