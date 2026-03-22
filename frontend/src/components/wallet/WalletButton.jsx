import { Wallet, LogOut, ChevronDown, ExternalLink, X } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useAdmin } from '../../hooks/useAdmin';
import { Button } from '../ui/Button';
import { shortenKlvAddress, isKleverInstalled } from '../../lib/klever';

export function WalletButton() {
  const { walletAddress, isAuthed, user, signIn, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loading, setLoading]           = useState(false);
  const [showInvitePrompt, setShowInvitePrompt] = useState(false);
  const [inviteCode, setInviteCode]     = useState('');
  const [inviteError, setInviteError]   = useState('');

  const handleSignIn = async (code) => {
    setLoading(true);
    const result = await signIn(code || undefined);
    setLoading(false);

    if (result?.inviteRequired) {
      setShowInvitePrompt(true);
      if (result.inviteError) setInviteError(result.inviteError);
    } else {
      setShowInvitePrompt(false);
      setInviteCode('');
      setInviteError('');
    }
  };

  const handleInviteSubmit = async () => {
    if (!inviteCode.trim()) return;
    setInviteError('');
    await handleSignIn(inviteCode.trim());
  };

  // Extension not installed
  if (!isKleverInstalled() && !isAuthed) {
    return (
      <a
        href="https://klever.io/extension"
        target="_blank"
        rel="noopener noreferrer"
      >
        <Button variant="accent" size="sm">
          <Wallet size={15} />
          Install Klever Extension
          <ExternalLink size={12} />
        </Button>
      </a>
    );
  }

  // Not signed in
  if (!isAuthed) {
    return (
      <>
        <Button variant="accent" size="sm" loading={loading} onClick={() => handleSignIn()}>
          <Wallet size={15} />
          Connect Wallet
        </Button>

        {/* Invite code modal */}
        {showInvitePrompt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-surface-100 border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-4 animate-slide-up">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white">Invite Code Required</h3>
                <button
                  onClick={() => { setShowInvitePrompt(false); setInviteError(''); }}
                  className="p-1 text-gray-500 hover:text-white transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
              <p className="text-sm text-gray-400">
                This tracker requires an invite code to register. Enter your code below.
              </p>
              <input
                value={inviteCode}
                onChange={e => { setInviteCode(e.target.value); setInviteError(''); }}
                placeholder="Enter invite code"
                className="w-full px-3 py-2 bg-surface-200 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
                onKeyDown={e => { if (e.key === 'Enter') handleInviteSubmit(); }}
                autoFocus
              />
              {inviteError && (
                <p className="text-xs text-red-400">{inviteError}</p>
              )}
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => { setShowInvitePrompt(false); setInviteError(''); }}>
                  Cancel
                </Button>
                <Button size="sm" loading={loading} onClick={handleInviteSubmit} disabled={!inviteCode.trim()}>
                  Submit & Sign In
                </Button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // Authenticated — show address + dropdown
  const displayAddr = user?.username || shortenKlvAddress(walletAddress);
  const hue = walletAddress
    ? parseInt(walletAddress.slice(4, 6), 36) * 5
    : 200;

  return (
    <div className="relative">
      <button
        onClick={() => setDropdownOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-1.5 bg-surface-200 border border-white/10 rounded-lg text-sm text-gray-200 hover:border-white/30 hover:text-white transition-all"
      >
        {/* Deterministic colour avatar from klv address */}
        <span
          className="w-5 h-5 rounded-full flex-shrink-0"
          style={{ background: `hsl(${hue}, 65%, 55%)` }}
        />
        <span className="font-mono text-xs">{displayAddr}</span>
        <ChevronDown size={13} className="text-gray-400" />
      </button>

      {dropdownOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
          <div className="absolute right-0 mt-2 w-52 bg-surface-100 border border-white/10 rounded-xl shadow-2xl z-20 animate-slide-up overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10">
              <p className="text-xs text-gray-400 mb-0.5">Klever Wallet</p>
              <p className="text-xs font-mono text-white break-all leading-tight">{walletAddress}</p>
            </div>
            <nav className="p-1">
              {[
                { to: '/dashboard', label: 'Dashboard'        },
                { to: '/submit',    label: 'Submit Torrent'   },
                ...(isAdmin ? [{ to: '/admin', label: '⚙️ Admin Panel' }] : []),
              ].map(({ to, label }) => (
                <a
                  key={to}
                  href={to}
                  className="block px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                  onClick={() => setDropdownOpen(false)}
                >
                  {label}
                </a>
              ))}
            </nav>
            <div className="p-1 border-t border-white/10">
              <button
                onClick={() => { setDropdownOpen(false); signOut(); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
              >
                <LogOut size={14} />
                Sign Out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
