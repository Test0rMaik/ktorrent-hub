import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowRight, Shield, Coins, Zap, Globe } from 'lucide-react';
import { getTorrents, getStats, getCategories, getSiteSettings } from '../lib/api';
import { TorrentCard } from '../components/torrent/TorrentCard';
import { Button } from '../components/ui/Button';

export default function Home() {
  const { data: statsData }      = useQuery({ queryKey: ['stats'],      queryFn: getStats,       staleTime: 30_000 });
  const { data: categoriesData } = useQuery({ queryKey: ['categories'], queryFn: getCategories,  staleTime: 60_000 });
  const { data: site }           = useQuery({ queryKey: ['siteSettings'], queryFn: getSiteSettings, staleTime: 5 * 60_000 });

  const latestCount = site?.homeLatestCount ?? 8;
  const hotCount    = site?.homeHotCount    ?? 8;

  const { data: newestData } = useQuery({ queryKey: ['newest', latestCount], queryFn: () => getTorrents({ limit: latestCount, sort: 'created_at', order: 'desc' }), staleTime: 30_000 });
  const { data: hotData }    = useQuery({ queryKey: ['hot',    hotCount],    queryFn: () => getTorrents({ limit: hotCount,    sort: 'seeders',    order: 'desc' }), staleTime: 60_000 });

  const stats        = statsData || {};
  const cats         = categoriesData?.categories || [];
  const ticker       = (site?.tokenId || 'KTH-000000').split('-')[0];
  const showFeatures = site?.showFeaturesSection !== false;
  const showHero      = site?.showHeroSection !== false;
  const heroTitle     = site?.heroTitle || '';
  const heroSubtitle  = site?.heroSubtitle || '';
  const rewardsOn     = site?.rewardsEnabled !== false;

  const FEATURES = [
    { icon: <Shield size={22} />, title: 'Fully Anonymous',       desc: 'No email, no password. Connect with your Klever wallet — nothing traceable.' },
    rewardsOn && { icon: <Coins size={22} />, title: `Earn ${ticker} Tokens`, desc: `Seed torrents and earn ${ticker} tokens automatically. Claim them on-chain anytime.` },
    { icon: <Zap   size={22} />, title: 'Built-in Tracker',       desc: 'No external tracker needed. The site IS the tracker — HTTP announce & scrape.' },
    { icon: <Globe size={22} />, title: 'Open Source',            desc: 'Self-hostable, MIT licensed. Run your own instance with one command.' },
  ].filter(Boolean);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-16">

      {/* ── Hero ──────────────────────────────────────────── */}
      {showHero && (
      <section className="text-center py-10 space-y-6">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent-600/10 border border-accent-500/20 text-accent-400 text-sm font-medium">
          <span className="w-2 h-2 rounded-full bg-accent-400 animate-pulse-slow" />
          Anonymous · Decentralised · Rewarding
        </div>

        {heroTitle ? (
          <h1 className="text-4xl sm:text-6xl font-bold text-white leading-tight">
            {heroTitle}
          </h1>
        ) : (
          <h1 className="text-4xl sm:text-6xl font-bold text-white leading-tight">
            The torrent tracker<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-accent-400">
              that pays you back
            </span>
          </h1>
        )}

        {heroSubtitle ? (
          <p className="max-w-xl mx-auto text-lg text-gray-400">{heroSubtitle}</p>
        ) : rewardsOn ? (
          <p className="max-w-xl mx-auto text-lg text-gray-400">
            Connect your wallet. No sign-up. No tracking. Seed torrents and earn
            <strong className="text-white"> {ticker} tokens</strong> for every hour you contribute.
          </p>
        ) : (
          <p className="max-w-xl mx-auto text-lg text-gray-400">
            Connect your wallet. No sign-up. No tracking. Share and discover content anonymously.
          </p>
        )}

        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link to="/browse">
            <Button size="lg" variant="primary">
              Browse Torrents <ArrowRight size={16} />
            </Button>
          </Link>
          <Link to="/submit">
            <Button size="lg" variant="outline">
              Upload Torrent
            </Button>
          </Link>
        </div>

        {/* Stats bar */}
        {stats.torrents > 0 && (
          <div className="flex items-center justify-center gap-8 pt-4 text-sm text-gray-400">
            {[
              { label: 'Torrents',   value: stats.torrents?.toLocaleString() },
              { label: 'Seeders',    value: stats.seeders?.toLocaleString() },
              { label: 'Users',      value: stats.users?.toLocaleString() },
              { label: 'Completed',  value: stats.completed?.toLocaleString() },
            ].map(s => (
              <div key={s.label} className="text-center">
                <div className="text-xl font-bold text-white">{s.value}</div>
                <div className="text-xs">{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </section>
      )}

      {/* ── Features ──────────────────────────────────────── */}
      {showFeatures && (
        <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map(f => (
            <div key={f.title} className="bg-surface-50 border border-white/8 rounded-xl p-5 space-y-3">
              <div className="text-brand-400">{f.icon}</div>
              <h3 className="font-semibold text-white">{f.title}</h3>
              <p className="text-sm text-gray-400">{f.desc}</p>
            </div>
          ))}
        </section>
      )}

      {/* ── Categories ────────────────────────────────────── */}
      {cats.length > 0 && (
        <section>
          <h2 className="text-xl font-bold text-white mb-4">Browse by Category</h2>
          <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2">
            {cats.map(c => (
              <Link
                key={c.id}
                to={`/browse?category=${c.id}`}
                className="flex flex-col items-center gap-1.5 p-3 bg-surface-50 border border-white/8 rounded-xl hover:border-brand-500/40 hover:bg-surface-100 transition-all text-center"
              >
                <span className="text-2xl">{c.icon}</span>
                <span className="text-xs font-medium text-gray-300">{c.label}</span>
                {c.count > 0 && <span className="text-xs text-gray-500">{c.count}</span>}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Latest Torrents ───────────────────────────────── */}
      {newestData?.torrents?.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Latest Uploads</h2>
            <Link to="/browse" className="text-sm text-brand-400 hover:text-brand-300 flex items-center gap-1">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {newestData.torrents.map(t => <TorrentCard key={t.id} torrent={t} />)}
          </div>
        </section>
      )}

      {/* ── Hot Right Now ─────────────────────────────────── */}
      {hotData?.torrents?.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">🔥 Hot Right Now</h2>
            <Link to="/browse?sort=seeders" className="text-sm text-brand-400 hover:text-brand-300 flex items-center gap-1">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {hotData.torrents.map(t => <TorrentCard key={t.id} torrent={t} />)}
          </div>
        </section>
      )}
    </div>
  );
}
