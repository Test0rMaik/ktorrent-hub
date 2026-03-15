import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { SlidersHorizontal, Search } from 'lucide-react';
import { getTorrents, getCategories } from '../lib/api';
import { TorrentCard } from '../components/torrent/TorrentCard';
import { Select } from '../components/ui/Input';

const SORTS = [
  { value: 'created_at', label: 'Newest' },
  { value: 'seeders',    label: 'Most Seeded' },
  { value: 'leechers',   label: 'Most Active' },
  { value: 'completed',  label: 'Most Downloaded' },
  { value: 'size',       label: 'Largest' },
  { value: 'name',       label: 'Name A-Z' },
];

export default function Browse() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery]               = useState(searchParams.get('q') || '');

  const category = searchParams.get('category') || '';
  const sort     = searchParams.get('sort')     || 'created_at';
  const order    = searchParams.get('order')    || 'desc';
  const page     = parseInt(searchParams.get('page') || '1', 10);

  const setParam = (key, value) => setSearchParams(prev => {
    if (value) prev.set(key, value); else prev.delete(key);
    prev.set('page', '1');
    return prev;
  });

  const { data, isLoading } = useQuery({
    queryKey: ['torrents', { category, sort, order, page, q: searchParams.get('q') }],
    queryFn:  () => getTorrents({ category, sort, order, page, limit: 20, q: searchParams.get('q') }),
    staleTime: 15_000,
  });

  const { data: catsData } = useQuery({ queryKey: ['categories'], queryFn: getCategories, staleTime: 60_000 });
  const cats = catsData?.categories || [];

  const handleSearch = e => {
    e.preventDefault();
    setSearchParams(prev => {
      if (query.trim()) prev.set('q', query.trim()); else prev.delete('q');
      prev.set('page', '1');
      return prev;
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col lg:flex-row gap-6">

        {/* ── Sidebar filters ───────────────────────────── */}
        <aside className="lg:w-56 flex-shrink-0">
          <div className="bg-surface-50 border border-white/8 rounded-xl p-4 space-y-4 sticky top-20">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <SlidersHorizontal size={15} /> Filters
            </h3>

            <div>
              <p className="text-xs text-gray-500 mb-2">Category</p>
              <div className="space-y-1">
                <button
                  onClick={() => setParam('category', '')}
                  className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${!category ? 'bg-brand-600/20 text-brand-300' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                >
                  All
                </button>
                {cats.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setParam('category', c.id)}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-2 ${category === c.id ? 'bg-brand-600/20 text-brand-300' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                  >
                    <span>{c.icon}</span> {c.label}
                    {c.count > 0 && <span className="ml-auto text-xs text-gray-600">{c.count}</span>}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* ── Main list ─────────────────────────────────── */}
        <main className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            {/* Search */}
            <form onSubmit={handleSearch} className="flex-1 relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search by name or description…"
                className="w-full pl-9 pr-4 py-2 bg-surface-100 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </form>

            {/* Sort */}
            <select
              value={sort}
              onChange={e => setParam('sort', e.target.value)}
              className="px-3 py-2 bg-surface-100 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer"
            >
              {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          {/* Results info */}
          {data && (
            <p className="text-sm text-gray-500 mb-4">
              {data.total.toLocaleString()} result{data.total !== 1 ? 's' : ''}
              {searchParams.get('q') && ` for "${searchParams.get('q')}"`}
            </p>
          )}

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-20 bg-surface-50 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : data?.torrents?.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <p className="text-4xl mb-3">📭</p>
              <p>No torrents found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data?.torrents?.map(t => <TorrentCard key={t.id} torrent={t} />)}
            </div>
          )}

          {/* Pagination */}
          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              {Array.from({ length: Math.min(data.totalPages, 10) }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  onClick={() => setSearchParams(prev => { prev.set('page', String(p)); return prev; })}
                  className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${p === page ? 'bg-brand-600 text-white' : 'bg-surface-100 text-gray-400 hover:text-white hover:bg-surface-200'}`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
