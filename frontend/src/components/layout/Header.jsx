import { Link, useLocation } from 'react-router-dom';
import { Search, Rss } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { WalletButton } from '../wallet/WalletButton';
import { ThemeToggle } from '../ui/ThemeToggle';
import { getSiteSettings } from '../../lib/api';

const CORE_NAV = [
  { to: '/',        label: 'Home'   },
  { to: '/browse',  label: 'Browse' },
];

export function Header({ enabledExtensions = [] }) {
  const location             = useLocation();
  const navigate             = useNavigate();
  const [query, setQuery]    = useState('');
  const { data: site }       = useQuery({ queryKey: ['site'], queryFn: getSiteSettings, staleTime: 5 * 60_000 });

  const siteName = site?.siteName || 'KleverTorrentHub';
  const logoUrl  = site?.logoUrl  || null;

  // Build nav from core + enabled extension nav items
  const NAV = [
    ...CORE_NAV,
    ...enabledExtensions.flatMap(ext => ext.navItems || []),
  ];

  const handleSearch = e => {
    e.preventDefault();
    if (query.trim()) navigate(`/browse?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <header className="sticky top-0 z-40 bg-surface/80 backdrop-blur-xl border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-16 gap-4">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 flex-shrink-0">
            {logoUrl
              ? <img src={logoUrl} alt={siteName} className="h-8 w-auto object-contain" />
              : <span className="text-2xl">⚡</span>
            }
            <span className="font-bold text-white text-lg hidden sm:block">{siteName}</span>
          </Link>

          {/* Nav */}
          <nav className="hidden md:flex items-center gap-1 ml-4">
            {NAV.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === to || (to !== '/' && location.pathname.startsWith(to))
                    ? 'text-white bg-white/10'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* Search */}
          <form onSubmit={handleSearch} className="flex-1 max-w-sm hidden sm:block">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search torrents..."
                className="w-full pl-9 pr-4 py-1.5 bg-surface-100 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </form>

          <div className="ml-auto flex items-center gap-2">
            <a
              href="/api/meta/rss"
              target="_blank"
              rel="noopener noreferrer"
              title="RSS Feed"
              className="p-2 text-gray-400 hover:text-orange-400 hover:bg-orange-400/10 rounded-lg transition-colors"
            >
              <Rss size={17} />
            </a>
            <ThemeToggle />
            <WalletButton />
          </div>
        </div>
      </div>
    </header>
  );
}
