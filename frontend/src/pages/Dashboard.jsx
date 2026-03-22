import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Coins, Upload, Clock, TrendingUp, ExternalLink, Copy, Check, UserPlus, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { getMe, getPendingRewards, claimRewards, getOnChainBalance, getSiteSettings, getMyPasskey, api } from '../lib/api';
import { formatKth, shortenKlvAddress } from '../lib/klever';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { TorrentCard } from '../components/torrent/TorrentCard';
import { useAuth } from '../hooks/useAuth';

export default function Dashboard() {
  const { isAuthed, walletAddress } = useAuth();
  const qc = useQueryClient();

  const { data: me, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn:  getMe,
    enabled:  isAuthed,
  });

  const { data: pendingData } = useQuery({
    queryKey: ['pendingRewards'],
    queryFn:  getPendingRewards,
    enabled:  isAuthed,
    refetchInterval: 60_000,
  });

  const { data: balanceData } = useQuery({
    queryKey: ['onChainBalance'],
    queryFn:  getOnChainBalance,
    enabled:  isAuthed,
    staleTime: 120_000,
  });

  const { data: site }    = useQuery({ queryKey: ['site'],      queryFn: getSiteSettings, staleTime: 5 * 60_000 });
  const { data: pkData }  = useQuery({ queryKey: ['passkey'],   queryFn: getMyPasskey,    enabled: isAuthed, staleTime: Infinity });

  const claimMut = useMutation({
    mutationFn: claimRewards,
    onSuccess:  data => {
      const t = data?.tokenId?.split('-')[0] || 'token';
      toast.success(`Claimed ${data.amountKth} ${t}! TX: ${data.txHash?.slice(0, 12)}…`);
      qc.invalidateQueries(['me', 'pendingRewards', 'onChainBalance']);
    },
    onError: err => toast.error(err?.response?.data?.error || 'Claim failed'),
  });

  const [activeTab, setActiveTab] = React.useState('torrents');
  const [copied, setCopied] = useState(false);

  // All derived values (no hooks below this point)
  const pendingKth     = pendingData?.amountKth  || '0';
  const pendingAmt     = pendingData?.amount      || 0;
  const onChainBal     = balanceData?.balance     || 0;
  const tokenId        = site?.tokenId || pendingData?.tokenId || 'KTH-000000';
  const ticker         = tokenId.split('-')[0];
  const seedSecs       = me?.pendingSeedSeconds || 0;
  const seedHours      = Math.floor(seedSecs / 3600);
  const seedMins       = Math.floor((seedSecs % 3600) / 60);
  const seedTime       = seedHours > 0 ? `${seedHours}h ${seedMins}m` : `${seedMins}m`;
  const totalSecs      = me?.totalSeedSeconds || 0;
  const totalHours     = Math.floor(totalSecs / 3600);
  const totalMins      = Math.floor((totalSecs % 3600) / 60);
  const totalSeedTime  = totalHours > 0 ? `${totalHours}h ${totalMins}m` : `${totalMins}m`;
  const rewardsOn      = site?.rewardsEnabled !== false;
  const tokenPrecision = site?.tokenPrecision ?? 6;
  const passkey        = pkData?.passkey || '';
  const announceUrl    = passkey ? `${window.location.origin}/announce?passkey=${passkey}` : '';

  const copyUrl = useCallback(() => {
    if (!announceUrl) return;
    navigator.clipboard.writeText(announceUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [announceUrl]);

  if (!isAuthed) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="text-5xl mb-4">🔒</div>
        <h1 className="text-2xl font-bold text-white mb-2">Connect your wallet</h1>
        <p className="text-gray-400">Sign in with your Klever Wallet to access your dashboard.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">

      {/* ── Header ────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-gray-400 font-mono mt-0.5">{shortenKlvAddress(walletAddress)}</p>
        </div>
        <Link to="/submit">
          <Button size="sm" variant="primary">
            <Upload size={14} /> Upload Torrent
          </Button>
        </Link>
      </div>

      {/* ── Stats cards ───────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        {[
          rewardsOn && { label: 'Total Earned',   value: `${formatKth(me?.total_rewards, tokenPrecision)} ${ticker}`, icon: <Coins size={18} />,      color: 'text-accent-400', bg: 'bg-accent-500/10' },
          rewardsOn && { label: 'Wallet Balance', value: `${formatKth(onChainBal, tokenPrecision)} ${ticker}`,        icon: <TrendingUp size={18} />, color: 'text-green-400',  bg: 'bg-green-500/10' },
                        { label: 'My Uploads',    value: me?.torrents?.length ?? 0,                   icon: <Upload size={18} />,     color: 'text-brand-400',  bg: 'bg-brand-500/10' },
          rewardsOn && { label: 'Pending Seed',   value: seedTime,      icon: <Clock size={18} />,        color: 'text-amber-400',  bg: 'bg-amber-500/10' },
          rewardsOn && { label: 'Total Seeded',  value: totalSeedTime, icon: <Clock size={18} />,        color: 'text-gray-400',   bg: 'bg-white/5' },
        ].filter(Boolean).map(s => (
          <div key={s.label} className="bg-surface-50 border border-white/8 rounded-xl p-4">
            <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center ${s.color} mb-3`}>
              {s.icon}
            </div>
            <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Personalized Tracker URL ──────────────────── */}
      {rewardsOn && announceUrl && (
        <div className="bg-surface-50 border border-brand-500/20 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
            🔗 Your personal tracker URL
          </h2>
          <p className="text-xs text-gray-500 mb-3">
            Add this URL as a tracker in your BitTorrent client for every torrent you seed.
            Your seeding time will be tracked automatically and rewards will accumulate.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-1.5 bg-surface-100 border border-white/10 rounded-lg text-xs text-brand-300 font-mono truncate">
              {announceUrl}
            </code>
            <button
              onClick={copyUrl}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-xs text-gray-300 hover:text-white hover:border-white/30 transition-colors"
            >
              {copied ? <><Check size={12} className="text-green-400" /> Copied</> : <><Copy size={12} /> Copy</>}
            </button>
          </div>
        </div>
      )}

      {/* ── Reward Centre ─────────────────────────────── */}
      {rewardsOn && <div className="bg-surface-50 border border-white/8 rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Coins size={18} className="text-accent-400" /> Reward Centre
        </h2>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div>
            <p className="text-3xl font-bold text-accent-400">
              {pendingKth} <span className="text-lg text-gray-400">{ticker}</span>
            </p>
            <p className="text-sm text-gray-500 mt-0.5">Pending rewards (unclaimed)</p>
          </div>

          <div className="flex flex-col gap-2">
            <Button
              variant="accent"
              loading={claimMut.isPending}
              disabled={pendingAmt === 0}
              onClick={() => claimMut.mutate()}
            >
              Claim to Klever Wallet
            </Button>
            <p className="text-xs text-gray-500 text-center">
              Tokens sent directly to <span className="font-mono">{shortenKlvAddress(walletAddress)}</span>
            </p>
          </div>
        </div>

        {/* Token info */}
        <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-3 text-xs text-gray-500">
          <span>Token: <span className="font-mono text-gray-300">{tokenId}</span></span>
          <a
            href={`https://kleverscan.org/asset/${tokenId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-brand-400 hover:text-brand-300"
          >
            View on KleverScan <ExternalLink size={11} />
          </a>
        </div>

        {/* Claim history */}
        {me?.vouchers?.length > 0 && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <p className="text-xs text-gray-500 mb-2">Recent claims</p>
            <div className="space-y-1">
              {me.vouchers.slice(0, 5).map(v => (
                <div key={v.id} className="flex items-center justify-between text-xs py-1">
                  <span className="text-gray-400">{new Date(v.created_at).toLocaleDateString()}</span>
                  <span className="font-mono text-gray-300">
                    {formatKth(v.amount, v.token_precision ?? tokenPrecision)} {(v.token_id ?? tokenId).split('-')[0]}
                  </span>
                  {v.tx_hash && (
                    <a
                      href={`https://kleverscan.org/transaction/${v.tx_hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-400 hover:text-brand-300 flex items-center gap-1"
                    >
                      {v.tx_hash.slice(0, 8)}… <ExternalLink size={10} />
                    </a>
                  )}
                  <Badge color="green">{v.status}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>}

      {/* ── Invite Codes (if extension enabled) ──────── */}
      <InviteSection isAuthed={isAuthed} enabledExtensions={site?.enabledExtensions || []} />

      {/* ── Tabs ──────────────────────────────────────── */}
      <div>
        <div className="flex gap-1 mb-4 bg-surface-50 border border-white/8 rounded-xl p-1 w-fit">
          {[
            { id: 'torrents',  label: `My Torrents (${me?.torrents?.length || 0})` },
            { id: 'bookmarks', label: `Bookmarks (${me?.bookmarks?.length || 0})` },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === tab.id ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'torrents' && (
          <div className="space-y-3">
            {me?.torrents?.length === 0
              ? <p className="text-gray-500 text-sm py-8 text-center">No uploads yet. <Link to="/submit" className="text-brand-400 hover:underline">Upload your first torrent</Link></p>
              : me?.torrents?.map(t => <TorrentCard key={t.id} torrent={t} />)
            }
          </div>
        )}

        {activeTab === 'bookmarks' && (
          <div className="space-y-3">
            {me?.bookmarks?.length === 0
              ? <p className="text-gray-500 text-sm py-8 text-center">No bookmarks yet.</p>
              : me?.bookmarks?.map(t => <TorrentCard key={t.id} torrent={t} />)
            }
          </div>
        )}
      </div>
    </div>
  );
}

// ── Invite Codes Section ─────────────────────────────────────
const getMyInvites = () => api.get('/ext/invite-system/my-invites').then(r => r.data);
const requestMoreInvites = () => api.post('/ext/invite-system/request').then(r => r.data);

function InviteSection({ isAuthed, enabledExtensions }) {
  const qc = useQueryClient();
  const isEnabled = enabledExtensions.includes('invite-system');

  const { data } = useQuery({
    queryKey: ['my-invites'],
    queryFn: getMyInvites,
    staleTime: 60_000,
    enabled: isAuthed && isEnabled,
    retry: false,
  });

  const requestMut = useMutation({
    mutationFn: requestMoreInvites,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-invites'] });
      toast.success('Request submitted — waiting for admin approval');
    },
    onError: (err) => toast.error(err?.response?.data?.error || 'Request failed'),
  });

  if (!isEnabled || !data?.enabled) return null;

  const copyCode = code => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(code);
    } else {
      const ta = document.createElement('textarea');
      ta.value = code;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    toast.success('Copied to clipboard');
  };

  const allUsed = data.available === 0 && data.total > 0;

  return (
    <div className="bg-surface-50 border border-white/8 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <UserPlus size={18} className="text-brand-400" /> My Invite Codes
        </h2>
        <Link to="/invites" className="text-xs text-brand-400 hover:text-brand-300">
          View all
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center">
          <div className="text-xl font-bold text-white">{data.total}</div>
          <div className="text-xs text-gray-500">Total</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-green-400">{data.available}</div>
          <div className="text-xs text-gray-500">Available</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-gray-500">{data.used}</div>
          <div className="text-xs text-gray-500">Used</div>
        </div>
      </div>

      {/* Show available codes */}
      <div className="space-y-1.5">
        {data.invites?.filter(i => !i.used_by_wallet).slice(0, 5).map(inv => (
          <div key={inv.code} className="flex items-center justify-between px-3 py-2 bg-surface-100 rounded-lg">
            <span className="font-mono text-sm text-white">{inv.code}</span>
            <button
              onClick={() => copyCode(inv.code)}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-brand-400 transition-colors"
            >
              <Copy size={12} /> Copy
            </button>
          </div>
        ))}
        {data.invites?.filter(i => i.used_by_wallet).length > 0 && (
          <p className="text-xs text-gray-600 pt-1">
            + {data.used} used code{data.used !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Request more */}
      {allUsed && (
        <div className="mt-4 pt-4 border-t border-white/10 text-center">
          <p className="text-xs text-gray-500 mb-2">All invite codes have been used.</p>
          <Button size="sm" variant="outline" loading={requestMut.isPending} onClick={() => requestMut.mutate()}>
            Request More Invites
          </Button>
        </div>
      )}
    </div>
  );
}

// React is needed for useState
import React from 'react';
