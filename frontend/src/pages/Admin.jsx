import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Settings, Users, LayoutGrid, BarChart3, Shield, Trash2,
  Star, Zap, Ban, CheckCircle, Search, ChevronDown, ChevronUp, Upload, X,
  Wallet, AlertTriangle, RefreshCw, Puzzle, Palette,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  adminGetSettings, adminPatchSettings, adminGetStats,
  adminGetTorrents, adminPatchTorrent,
  adminGetUsers, adminBanUser, adminUnbanUser, adminGetBans,
  adminUploadLogo, adminDeleteLogo, getSiteSettings, adminGetRewardWallet,
} from '../lib/api';
import { formatKth, shortenKlvAddress } from '../lib/klever';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useAdmin } from '../hooks/useAdmin';
import { allExtensions } from '../lib/extensions';
import { themes } from '../lib/themes';
import { useThemeStore } from '../store/themeStore';

const TABS = [
  { id: 'overview',   label: 'Overview',   icon: <BarChart3 size={16} /> },
  { id: 'settings',   label: 'Settings',   icon: <Settings  size={16} /> },
  { id: 'modules',    label: 'Modules',    icon: <Puzzle    size={16} /> },
  { id: 'torrents',   label: 'Torrents',   icon: <LayoutGrid size={16} /> },
  { id: 'users',      label: 'Users',      icon: <Users     size={16} /> },
  { id: 'bans',       label: 'Bans',       icon: <Shield    size={16} /> },
];

export default function Admin() {
  const { isAdmin } = useAdmin();
  const [tab, setTab]   = useState('overview');
  const { data: site }  = useQuery({ queryKey: ['site'], queryFn: getSiteSettings, staleTime: 5 * 60_000 });
  const ticker          = (site?.tokenId || 'KTH-000000').split('-')[0];
  const tokenPrecision  = site?.tokenPrecision ?? 6;

  if (!isAdmin) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <div className="text-5xl mb-4">🚫</div>
        <h1 className="text-2xl font-bold text-white mb-2">Admin only</h1>
        <p className="text-gray-400">Sign in with the owner wallet to access this page.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
        <p className="text-sm text-gray-400 mt-0.5">Tracker management</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 bg-surface-50 border border-white/8 rounded-xl p-1 w-fit flex-wrap">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors
              ${tab === t.id ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview'  && <OverviewTab ticker={ticker} tokenPrecision={tokenPrecision} />}
      {tab === 'settings'  && <SettingsTab ticker={ticker} tokenPrecision={tokenPrecision} />}
      {tab === 'modules'   && <ModulesTab />}
      {tab === 'torrents'  && <TorrentsTab />}
      {tab === 'users'     && <UsersTab />}
      {tab === 'bans'      && <BansTab />}
    </div>
  );
}

// ── Overview ─────────────────────────────────────────────────
function OverviewTab({ ticker, tokenPrecision = 6 }) {
  const { data, isLoading } = useQuery({ queryKey: ['adminStats'], queryFn: adminGetStats });
  const { data: wallet, isLoading: walletLoading, refetch: refetchWallet, isFetching: walletFetching } = useQuery({
    queryKey: ['adminRewardWallet'],
    queryFn:  adminGetRewardWallet,
    staleTime: 60_000,
    retry: false,
  });

  if (isLoading) return <div className="h-40 bg-surface-50 rounded-xl animate-pulse" />;

  const counts = data?.counts || {};

  // Low-balance thresholds: warn if < 1000 tokens or < 5 KLV (fees)
  const tokenLow = wallet?.tokenBalance < 1000 * (10 ** tokenPrecision);
  const klvLow   = wallet?.klvBalance   < 5_000_000;       // < 5 KLV (always precision 6)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Torrents',     value: counts.torrents    },
          { label: 'Users',        value: counts.users       },
          { label: `${ticker} Minted`, value: `${formatKth(counts.totalMinted, tokenPrecision)} ${ticker}` },
          { label: 'Banned',       value: counts.bans        },
          { label: 'Comments',     value: counts.comments    },
          { label: 'Reward Claims',value: counts.claims      },
          { label: 'Deleted',      value: counts.deleted     },
        ].map(s => (
          <div key={s.label} className="bg-surface-50 border border-white/8 rounded-xl p-4">
            <div className="text-2xl font-bold text-white">{s.value ?? 0}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Reward Wallet ── */}
      <div className="bg-surface-50 border border-white/8 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Wallet size={15} className="text-accent-400" /> Reward Wallet
          </h3>
          <button
            onClick={() => refetchWallet()}
            disabled={walletFetching}
            className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
            title="Refresh balances"
          >
            <RefreshCw size={13} className={walletFetching ? 'animate-spin' : ''} />
          </button>
        </div>

        {walletLoading ? (
          <div className="h-12 bg-surface-100 rounded-lg animate-pulse" />
        ) : !wallet?.configured ? (
          <p className="text-sm text-gray-500 flex items-center gap-2">
            <AlertTriangle size={14} className="text-amber-400" />
            <span>Reward wallet not configured — set <code className="text-xs bg-surface-100 px-1 rounded">REWARD_ADMIN_MNEMONIC</code> or <code className="text-xs bg-surface-100 px-1 rounded">REWARD_ADMIN_PRIVATE_KEY</code> in your <code className="text-xs bg-surface-100 px-1 rounded">.env</code>.</span>
          </p>
        ) : (
          <div className="space-y-3">
            {/* Address */}
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Wallet address</p>
              <p className="text-xs font-mono text-gray-300 break-all">{wallet.address}</p>
            </div>
            {/* Balances */}
            <div className="grid grid-cols-2 gap-3">
              <div className={`rounded-xl p-3 border ${tokenLow ? 'bg-red-500/10 border-red-500/30' : 'bg-surface-100 border-white/8'}`}>
                <p className="text-xs text-gray-500 mb-1">{wallet.tokenId ?? ticker} Balance</p>
                <p className={`text-lg font-bold ${tokenLow ? 'text-red-400' : 'text-accent-400'}`}>
                  {(wallet.tokenBalance / (10 ** tokenPrecision)).toLocaleString(undefined, { maximumFractionDigits: tokenPrecision > 0 ? 2 : 0 })}
                </p>
                {tokenLow && <p className="text-xs text-red-400 mt-1 flex items-center gap-1"><AlertTriangle size={10} /> Low balance</p>}
              </div>
              <div className={`rounded-xl p-3 border ${klvLow ? 'bg-amber-500/10 border-amber-500/30' : 'bg-surface-100 border-white/8'}`}>
                <p className="text-xs text-gray-500 mb-1">KLV Balance (fees)</p>
                <p className={`text-lg font-bold ${klvLow ? 'text-amber-400' : 'text-green-400'}`}>
                  {(wallet.klvBalance / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </p>
                {klvLow && <p className="text-xs text-amber-400 mt-1 flex items-center gap-1"><AlertTriangle size={10} /> Low — top up for fees</p>}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Top uploaders */}
        <div className="bg-surface-50 border border-white/8 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Top Uploaders</h3>
          <div className="space-y-2">
            {data?.topUploaders?.map((u, i) => (
              <div key={u.wallet} className="flex items-center justify-between text-sm">
                <span className="text-gray-400">
                  #{i + 1} {u.username || shortenKlvAddress(u.wallet)}
                </span>
                <Badge color="blue">{u.count} torrents</Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Recent users */}
        <div className="bg-surface-50 border border-white/8 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Recent Users</h3>
          <div className="space-y-2">
            {data?.recentUsers?.slice(0, 8).map(u => (
              <div key={u.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-400 font-mono text-xs">
                  {u.username || shortenKlvAddress(u.wallet)}
                </span>
                <span className="text-gray-600 text-xs">
                  {new Date(u.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Settings ─────────────────────────────────────────────────
function SettingsTab({ ticker, tokenPrecision = 6 }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['adminSettings'], queryFn: adminGetSettings });

  const [form, setForm] = useState(null);
  // Initialise form from fetched data once
  if (data && !form) setForm(data.settings);

  const mut = useMutation({
    mutationFn: adminPatchSettings,
    onSuccess: r => {
      setForm(r.settings);
      qc.invalidateQueries({ queryKey: ['adminSettings'] });
      qc.invalidateQueries({ queryKey: ['categories'] });
      qc.invalidateQueries({ queryKey: ['site'] });
      toast.success('Settings saved');
    },
    onError: err => {
      const errors = err?.response?.data?.errors;
      toast.error(errors ? errors.join(', ') : 'Save failed');
    },
  });

  if (isLoading || !form) return <div className="h-40 bg-surface-50 rounded-xl animate-pulse" />;

  const allCats = data.allCategories;

  const toggleCategory = id => {
    const current = form.enabled_categories || [];
    const next = current.includes(id) ? current.filter(c => c !== id) : [...current, id];
    setForm(f => ({ ...f, enabled_categories: next }));
  };

  return (
    <div className="max-w-2xl space-y-6">

      {/* Categories */}
      <div className="bg-surface-50 border border-white/8 rounded-2xl p-6">
        <h2 className="font-semibold text-white mb-1">Categories</h2>
        <p className="text-xs text-gray-500 mb-4">Toggle which categories are visible to users.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {allCats.map(c => {
            const enabled = (form.enabled_categories || []).includes(c.id);
            return (
              <button
                key={c.id}
                onClick={() => toggleCategory(c.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all
                  ${enabled
                    ? 'border-brand-500/50 bg-brand-500/10 text-white'
                    : 'border-white/10 bg-transparent text-gray-500 hover:text-gray-300'}`}
              >
                <span>{c.icon}</span>
                <span>{c.label}</span>
                {enabled
                  ? <CheckCircle size={13} className="ml-auto text-brand-400" />
                  : <span className="ml-auto w-3 h-3 rounded-full border border-white/20" />
                }
              </button>
            );
          })}
        </div>
      </div>

      {/* Reward rate */}
      <div className="bg-surface-50 border border-white/8 rounded-2xl p-6 space-y-3">
        <h2 className="font-semibold text-white">Uploader Reward Rate</h2>
        <p className="text-xs text-gray-500">Earned by users who upload and seed their own torrents.</p>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min="0"
            value={form.reward_rate_per_hour ?? 10000000}
            onChange={e => setForm(f => ({ ...f, reward_rate_per_hour: parseInt(e.target.value, 10) || 0 }))}
            className="w-40 px-3 py-2 bg-surface-100 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <span className="text-sm text-gray-400">minimal units / hour</span>
          <span className="text-xs text-gray-600">
            = {((form.reward_rate_per_hour ?? 0) / (10 ** tokenPrecision)).toFixed(tokenPrecision > 0 ? 2 : 0)} {ticker}/h
          </span>
        </div>
      </div>

      {/* User seeding rewards */}
      <div className="bg-surface-50 border border-white/8 rounded-2xl p-6 space-y-4">
        <div>
          <h2 className="font-semibold text-white">User Seeding Rewards</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            When enabled, users who download and seed torrents they did not upload also earn rewards at a
            separate (typically lower) rate. Users must add their personal tracker URL to their BitTorrent
            client — it is shown on their Dashboard.
          </p>
        </div>

        <label className="flex items-start justify-between gap-4 cursor-pointer">
          <div>
            <p className="text-sm text-white">Enable user seeding rewards</p>
            <p className="text-xs text-gray-500">Non-uploaders earn tokens for seeding after their download completes</p>
          </div>
          <button
            role="switch"
            aria-checked={!!form.user_seeding_rewards_enabled}
            onClick={() => setForm(f => ({ ...f, user_seeding_rewards_enabled: !f.user_seeding_rewards_enabled }))}
            className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors ${form.user_seeding_rewards_enabled ? 'bg-brand-600' : 'bg-white/10'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${form.user_seeding_rewards_enabled ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </label>

        {form.user_seeding_rewards_enabled && (
          <div className="flex items-center gap-3 pt-1">
            <input
              type="number"
              min="0"
              value={form.user_seeding_rate_per_hour ?? 1000000}
              onChange={e => setForm(f => ({ ...f, user_seeding_rate_per_hour: parseInt(e.target.value, 10) || 0 }))}
              className="w-40 px-3 py-2 bg-surface-100 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <span className="text-sm text-gray-400">minimal units / hour</span>
            <span className="text-xs text-gray-600">
              = {((form.user_seeding_rate_per_hour ?? 0) / (10 ** tokenPrecision)).toFixed(tokenPrecision > 0 ? 2 : 0)} {ticker}/h
            </span>
          </div>
        )}
      </div>

      {/* Homepage counts */}
      <div className="bg-surface-50 border border-white/8 rounded-2xl p-6 space-y-4">
        <h2 className="font-semibold text-white">Homepage Sections</h2>
        {[
          { key: 'home_latest_count', label: 'Latest Uploads — items shown' },
          { key: 'home_hot_count',    label: 'Hot Right Now — items shown'  },
        ].map(({ key, label }) => (
          <div key={key} className="flex items-center gap-3">
            <label className="text-sm text-gray-400 w-52">{label}</label>
            <input
              type="number"
              min="1"
              max="50"
              value={form[key] ?? 8}
              onChange={e => setForm(f => ({ ...f, [key]: parseInt(e.target.value, 10) || 1 }))}
              className="w-24 px-3 py-2 bg-surface-100 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        ))}
      </div>

      {/* Toggles */}
      <div className="bg-surface-50 border border-white/8 rounded-2xl p-6 space-y-4">
        <h2 className="font-semibold text-white">Access Control</h2>
        {[
          { key: 'admin_only_uploads',   label: 'Admin-only uploads',              desc: 'Only the owner wallet can upload torrents; other users can still seed and earn rewards' },
          { key: 'show_features_section', label: 'Show features section on homepage', desc: 'Display the four feature highlight boxes (Anonymous, Earn Tokens, Tracker, Open Source)' },
          { key: 'show_hero_section',     label: 'Show hero section on homepage',     desc: 'Display the headline block at the top of the homepage' },
          { key: 'rewards_enabled',       label: 'Enable rewards system',             desc: 'Show token earning, claim UI, and seeding rewards across all pages. Disable to run a plain anonymous tracker.' },
        ].map(({ key, label, desc }) => (
          <label key={key} className="flex items-start justify-between gap-4 cursor-pointer">
            <div>
              <p className="text-sm text-white">{label}</p>
              <p className="text-xs text-gray-500">{desc}</p>
            </div>
            <button
              role="switch"
              aria-checked={!!form[key]}
              onClick={() => setForm(f => ({ ...f, [key]: !f[key] }))}
              className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors ${form[key] ? 'bg-brand-600' : 'bg-white/10'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${form[key] ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </label>
        ))}
      </div>

      {/* Hero Text */}
      <div className="bg-surface-50 border border-white/8 rounded-2xl p-6 space-y-4">
        <div>
          <h2 className="font-semibold text-white">Hero Text</h2>
          <p className="text-xs text-gray-500 mt-0.5">Leave blank to keep the default styled version.</p>
        </div>
        {[
          { key: 'hero_title',    label: 'Custom headline',  placeholder: 'e.g. The best tracker in town' },
          { key: 'hero_subtitle', label: 'Custom body text', placeholder: 'e.g. Join us and start sharing today.' },
        ].map(({ key, label, placeholder }) => (
          <div key={key}>
            <label className="block text-sm text-gray-300 mb-1">{label}</label>
            <input
              value={form[key] ?? ''}
              onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
              placeholder={placeholder}
              className="w-full px-3 py-2 bg-surface-100 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        ))}
      </div>

      {/* Site Branding */}
      <div className="bg-surface-50 border border-white/8 rounded-2xl p-6 space-y-4">
        <h2 className="font-semibold text-white">Site Branding</h2>

        {/* Logo upload */}
        <LogoUpload currentLogo={form.site_logo} onUploaded={url => setForm(f => ({ ...f, site_logo: url }))} onRemoved={() => setForm(f => ({ ...f, site_logo: '' }))} />

        {[
          { key: 'site_name',        label: 'Site name',              placeholder: 'KleverTorrentHub' },
          { key: 'site_description', label: 'Site description',       placeholder: 'Anonymous decentralised BitTorrent tracker' },
          { key: 'announcement',     label: 'Announcement banner',    placeholder: 'Leave empty to hide' },
        ].map(({ key, label, placeholder }) => (
          <div key={key}>
            <label className="block text-sm text-gray-300 mb-1">{label}</label>
            <input
              value={form[key] ?? ''}
              onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
              placeholder={placeholder}
              className="w-full px-3 py-2 bg-surface-100 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        ))}
      </div>

      <Button
        size="lg"
        loading={mut.isPending}
        onClick={() => mut.mutate(form)}
      >
        Save Settings
      </Button>
    </div>
  );
}

// ── Logo Upload ───────────────────────────────────────────────
function LogoUpload({ currentLogo, onUploaded, onRemoved }) {
  const [uploading, setUploading] = useState(false);

  const handleFile = async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('logo', file);
      const { logoUrl } = await adminUploadLogo(fd);
      onUploaded(logoUrl);
      toast.success('Logo uploaded');
    } catch {
      toast.error('Logo upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleRemove = async () => {
    try {
      await adminDeleteLogo();
      onRemoved();
      toast.success('Logo removed');
    } catch {
      toast.error('Failed to remove logo');
    }
  };

  return (
    <div>
      <label className="block text-sm text-gray-300 mb-2">Site logo</label>
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-xl bg-surface-100 border border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
          {currentLogo
            ? <img src={currentLogo} alt="Site logo" className="w-full h-full object-contain" />
            : <span className="text-3xl">⚡</span>
          }
        </div>
        <div className="flex gap-2">
          <label className={`cursor-pointer flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border transition-colors
            ${uploading ? 'opacity-50 pointer-events-none' : 'border-white/20 text-gray-300 hover:border-white/40 hover:text-white'}`}
          >
            <Upload size={13} />
            {uploading ? 'Uploading…' : 'Upload image'}
            <input type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml" className="hidden" onChange={handleFile} disabled={uploading} />
          </label>
          {currentLogo && (
            <button
              onClick={handleRemove}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border border-white/10 text-red-400 hover:text-red-300 hover:border-red-500/30 transition-colors"
            >
              <X size={13} /> Remove
            </button>
          )}
        </div>
      </div>
      <p className="text-xs text-gray-600 mt-1.5">PNG, JPG, GIF, WebP or SVG — max 2 MB</p>
    </div>
  );
}

// ── Torrents ──────────────────────────────────────────────────
function TorrentsTab() {
  const qc = useQueryClient();
  const [q, setQ]           = useState('');
  const [status, setStatus] = useState('active');

  const { data } = useQuery({
    queryKey: ['adminTorrents', status, q],
    queryFn:  () => adminGetTorrents({ status, q: q || undefined, limit: 50 }),
  });

  const patchMut = useMutation({
    mutationFn: ({ id, ...patch }) => adminPatchTorrent(id, patch),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['adminTorrents'] }); toast.success('Updated'); },
    onError:    () => toast.error('Update failed'),
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search by name…"
            className="w-full pl-8 pr-3 py-2 bg-surface-100 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <select
          value={status}
          onChange={e => setStatus(e.target.value)}
          className="px-3 py-2 bg-surface-100 border border-white/10 rounded-lg text-sm text-white focus:outline-none cursor-pointer"
        >
          <option value="active">Active</option>
          <option value="deleted">Deleted</option>
          <option value="pending">Pending</option>
        </select>
      </div>

      <div className="bg-surface-50 border border-white/8 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-xs text-gray-500">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3 hidden sm:table-cell">Category</th>
              <th className="px-4 py-3 hidden md:table-cell">Seeds</th>
              <th className="px-4 py-3">Flags</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {data?.torrents?.map(t => (
              <tr key={t.id} className="hover:bg-white/3 transition-colors">
                <td className="px-4 py-3">
                  <a href={`/torrent/${t.id}`} className="text-white hover:text-brand-300 truncate max-w-xs block">
                    {t.name}
                  </a>
                  <span className="text-xs text-gray-600 font-mono">{t.uploader_username || shortenKlvAddress(t.uploader_wallet)}</span>
                </td>
                <td className="px-4 py-3 hidden sm:table-cell text-gray-400 capitalize">{t.category}</td>
                <td className="px-4 py-3 hidden md:table-cell text-gray-400">{t.seeders}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    {t.is_featured  ? <Badge color="purple">★ Feat</Badge>  : null}
                    {t.is_freeleech ? <Badge color="green">FL</Badge>       : null}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 flex-wrap">
                    <button
                      title={t.is_featured ? 'Unfeature' : 'Feature'}
                      onClick={() => patchMut.mutate({ id: t.id, is_featured: !t.is_featured })}
                      className={`p-1.5 rounded transition-colors ${t.is_featured ? 'text-purple-400 bg-purple-500/10' : 'text-gray-500 hover:text-purple-400 hover:bg-purple-500/10'}`}
                    >
                      <Star size={13} />
                    </button>
                    <button
                      title={t.is_freeleech ? 'Remove Freeleech' : 'Set Freeleech'}
                      onClick={() => patchMut.mutate({ id: t.id, is_freeleech: !t.is_freeleech })}
                      className={`p-1.5 rounded transition-colors ${t.is_freeleech ? 'text-green-400 bg-green-500/10' : 'text-gray-500 hover:text-green-400 hover:bg-green-500/10'}`}
                    >
                      <Zap size={13} />
                    </button>
                    {t.status === 'active'
                      ? <button
                          title="Delete"
                          onClick={() => patchMut.mutate({ id: t.id, status: 'deleted' })}
                          className="p-1.5 rounded text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      : <button
                          title="Restore"
                          onClick={() => patchMut.mutate({ id: t.id, status: 'active' })}
                          className="p-1.5 rounded text-gray-500 hover:text-green-400 hover:bg-green-500/10 transition-colors"
                        >
                          <CheckCircle size={13} />
                        </button>
                    }
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data?.torrents?.length && (
          <p className="text-center py-8 text-gray-500 text-sm">No torrents found</p>
        )}
      </div>
    </div>
  );
}

// ── Users ─────────────────────────────────────────────────────
function UsersTab() {
  const qc      = useQueryClient();
  const [q, setQ]         = useState('');
  const [banReason, setBanReason] = useState('');
  const [banTarget, setBanTarget] = useState(null);

  const { data } = useQuery({
    queryKey: ['adminUsers', q],
    queryFn:  () => adminGetUsers({ q: q || undefined, limit: 50 }),
  });

  const banMut = useMutation({
    mutationFn: ({ wallet, reason }) => adminBanUser(wallet, reason),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['adminUsers'] }); qc.invalidateQueries({ queryKey: ['adminStats'] }); toast.success('User banned'); setBanTarget(null); },
    onError:    err => toast.error(err?.response?.data?.error || 'Ban failed'),
  });

  const unbanMut = useMutation({
    mutationFn: adminUnbanUser,
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['adminUsers'] }); toast.success('Ban lifted'); },
  });

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search wallet or username…"
          className="w-full pl-8 pr-3 py-2 bg-surface-100 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      {/* Ban confirmation modal */}
      {banTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-surface-100 border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4">
            <h3 className="font-semibold text-white">Ban wallet</h3>
            <p className="text-sm text-gray-400 font-mono break-all">{banTarget}</p>
            <input
              value={banReason}
              onChange={e => setBanReason(e.target.value)}
              placeholder="Reason (optional)"
              className="w-full px-3 py-2 bg-surface-200 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setBanTarget(null)}>Cancel</Button>
              <Button variant="danger" size="sm" loading={banMut.isPending} onClick={() => banMut.mutate({ wallet: banTarget, reason: banReason })}>
                Ban
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-surface-50 border border-white/8 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-xs text-gray-500">
              <th className="px-4 py-3">Wallet</th>
              <th className="px-4 py-3 hidden sm:table-cell">Torrents</th>
              <th className="px-4 py-3 hidden md:table-cell">Joined</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {data?.users?.map(u => (
              <tr key={u.id} className="hover:bg-white/3 transition-colors">
                <td className="px-4 py-3">
                  <p className="text-white text-xs font-mono">{u.username || shortenKlvAddress(u.wallet)}</p>
                  <p className="text-gray-600 text-xs font-mono">{shortenKlvAddress(u.wallet)}</p>
                </td>
                <td className="px-4 py-3 hidden sm:table-cell text-gray-400">{u.torrent_count}</td>
                <td className="px-4 py-3 hidden md:table-cell text-gray-500 text-xs">
                  {new Date(u.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  {u.is_banned ? <Badge color="red">Banned</Badge> : <Badge color="green">Active</Badge>}
                </td>
                <td className="px-4 py-3">
                  {u.is_banned
                    ? <button
                        onClick={() => unbanMut.mutate(u.wallet)}
                        className="text-xs text-green-400 hover:text-green-300 hover:bg-green-500/10 px-2 py-1 rounded transition-colors"
                      >
                        Unban
                      </button>
                    : <button
                        onClick={() => { setBanTarget(u.wallet); setBanReason(''); }}
                        className="text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 px-2 py-1 rounded transition-colors flex items-center gap-1"
                      >
                        <Ban size={11} /> Ban
                      </button>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data?.users?.length && (
          <p className="text-center py-8 text-gray-500 text-sm">No users found</p>
        )}
      </div>
    </div>
  );
}

// ── Modules ───────────────────────────────────────────────────
function ModulesTab() {
  const qc = useQueryClient();
  const { setColorTheme } = useThemeStore();
  const { data, isLoading } = useQuery({ queryKey: ['adminSettings'], queryFn: adminGetSettings });
  const [form, setForm] = useState(null);
  const [expandedExt, setExpandedExt] = useState(null);

  if (data && !form) setForm(data.settings);

  const mut = useMutation({
    mutationFn: adminPatchSettings,
    onSuccess: r => {
      setForm(r.settings);
      // Apply theme immediately so the admin sees the change
      if (r.settings.active_theme) setColorTheme(r.settings.active_theme);
      qc.invalidateQueries({ queryKey: ['adminSettings'] });
      qc.invalidateQueries({ queryKey: ['site'] });
      toast.success('Modules saved');
    },
    onError: () => toast.error('Save failed'),
  });

  if (isLoading || !form) return <div className="h-40 bg-surface-50 rounded-xl animate-pulse" />;

  const enabledExts = form.enabled_extensions || [];
  const activeTheme = form.active_theme || 'default';

  const toggleExtension = id => {
    const next = enabledExts.includes(id) ? enabledExts.filter(e => e !== id) : [...enabledExts, id];
    setForm(f => ({ ...f, enabled_extensions: next }));
  };

  return (
    <div className="max-w-3xl space-y-6">

      {/* Theme selector */}
      <div className="bg-surface-50 border border-white/8 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Palette size={18} className="text-accent-400" />
          <h2 className="font-semibold text-white">Color Theme</h2>
        </div>
        <p className="text-xs text-gray-500">Choose a color theme for the site. Themes change brand and accent colours.</p>
        <div className="grid sm:grid-cols-3 gap-2">
          {themes.map(t => (
            <button
              key={t.id}
              onClick={() => setForm(f => ({ ...f, active_theme: t.id }))}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all
                ${activeTheme === t.id
                  ? 'border-brand-500/50 bg-brand-500/10 text-white'
                  : 'border-white/10 text-gray-400 hover:text-white hover:border-white/20'
                }`}
            >
              <div>
                <p className="text-sm font-medium">{t.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{t.description}</p>
              </div>
              {activeTheme === t.id && <CheckCircle size={14} className="ml-auto text-brand-400 flex-shrink-0" />}
            </button>
          ))}
        </div>
      </div>

      {/* Extensions */}
      <div className="bg-surface-50 border border-white/8 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Puzzle size={18} className="text-brand-400" />
          <h2 className="font-semibold text-white">Extensions</h2>
        </div>
        <p className="text-xs text-gray-500">
          Enable or disable extensions. Changes take effect immediately after saving.
        </p>

        <div className="space-y-2">
          {allExtensions.map(ext => {
            const enabled = enabledExts.includes(ext.id);
            const isExpanded = expandedExt === ext.id && enabled && ext.adminPanel;
            return (
              <div key={ext.id} className="border border-white/8 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{ext.name || ext.id}</p>
                    {ext.description && <p className="text-xs text-gray-500 mt-0.5">{ext.description}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    {enabled && ext.adminPanel && (
                      <button
                        onClick={() => setExpandedExt(isExpanded ? null : ext.id)}
                        className="text-xs text-brand-400 hover:text-brand-300 px-2 py-1 rounded transition-colors"
                      >
                        {isExpanded ? 'Hide Settings' : 'Settings'}
                      </button>
                    )}
                    <button
                      role="switch"
                      aria-checked={enabled}
                      onClick={() => toggleExtension(ext.id)}
                      className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors ${enabled ? 'bg-brand-600' : 'bg-white/10'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                </div>

                {/* Expanded admin panel */}
                {isExpanded && (
                  <div className="border-t border-white/8 px-4 py-4 bg-surface-100/50">
                    <ext.adminPanel />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <Button
        size="lg"
        loading={mut.isPending}
        onClick={() => mut.mutate(form)}
      >
        Save Modules
      </Button>
    </div>
  );
}

// ── Bans ──────────────────────────────────────────────────────
function BansTab() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['adminBans'], queryFn: adminGetBans });

  const unbanMut = useMutation({
    mutationFn: adminUnbanUser,
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['adminBans'] }); qc.invalidateQueries({ queryKey: ['adminUsers'] }); toast.success('Ban lifted'); },
  });

  return (
    <div className="bg-surface-50 border border-white/8 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left text-xs text-gray-500">
            <th className="px-4 py-3">Wallet</th>
            <th className="px-4 py-3 hidden sm:table-cell">Reason</th>
            <th className="px-4 py-3 hidden md:table-cell">Banned by</th>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {data?.bans?.map(b => (
            <tr key={b.wallet} className="hover:bg-white/3">
              <td className="px-4 py-3 font-mono text-xs text-gray-300">{shortenKlvAddress(b.wallet)}</td>
              <td className="px-4 py-3 hidden sm:table-cell text-gray-400">{b.reason || '—'}</td>
              <td className="px-4 py-3 hidden md:table-cell font-mono text-xs text-gray-500">{shortenKlvAddress(b.banned_by)}</td>
              <td className="px-4 py-3 text-xs text-gray-500">{new Date(b.created_at).toLocaleDateString()}</td>
              <td className="px-4 py-3">
                <button
                  onClick={() => unbanMut.mutate(b.wallet)}
                  className="text-xs text-green-400 hover:text-green-300 px-2 py-1 hover:bg-green-500/10 rounded transition-colors"
                >
                  Lift ban
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!data?.bans?.length && (
        <p className="text-center py-8 text-gray-500 text-sm">No active bans</p>
      )}
    </div>
  );
}
