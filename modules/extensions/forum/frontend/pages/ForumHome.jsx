import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { MessageSquare, Pin, Lock, ChevronRight } from 'lucide-react';
import { api } from '../../../../../frontend/src/lib/api';
import { Badge } from '../../../../../frontend/src/components/ui/Badge';

const getCategories = () => api.get('/ext/forum/categories').then(r => r.data);
const getThreads = params => api.get('/ext/forum/threads', { params }).then(r => r.data);

function shortenWallet(w) {
  if (!w) return '?';
  return w.length > 16 ? w.slice(0, 8) + '...' + w.slice(-4) : w;
}

export default function ForumHome() {
  const [params] = useSearchParams();
  const categoryId = params.get('category');
  const page = parseInt(params.get('page'), 10) || 1;

  const { data: catData } = useQuery({
    queryKey: ['forum-categories'],
    queryFn: getCategories,
    staleTime: 60_000,
  });

  const { data: threadData, isLoading } = useQuery({
    queryKey: ['forum-threads', categoryId, page],
    queryFn: () => getThreads({ category: categoryId || undefined, page }),
    staleTime: 15_000,
  });

  const categories = catData?.categories || [];
  const threads = threadData?.threads || [];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <MessageSquare size={22} className="text-brand-400" /> Forum
        </h1>
        <Link
          to="/forum/new"
          className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          New Thread
        </Link>
      </div>

      {/* Category cards (when no category filter is active) */}
      {!categoryId && categories.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {categories.map(c => (
            <Link
              key={c.id}
              to={`/forum?category=${c.id}`}
              className="bg-surface-50 border border-white/8 rounded-xl p-4 hover:border-brand-500/40 hover:bg-surface-100 transition-all"
            >
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-semibold text-white">{c.name}</h3>
                <span className="text-xs text-gray-500 tabular-nums">{c.thread_count}</span>
              </div>
              {c.description && (
                <p className="text-xs text-gray-500 line-clamp-2">{c.description}</p>
              )}
            </Link>
          ))}
        </div>
      )}

      {/* Category filter bar (when viewing threads) */}
      <div className="flex gap-2 flex-wrap">
        <Link
          to="/forum"
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
            ${!categoryId ? 'bg-brand-600 text-white' : 'bg-surface-50 text-gray-400 hover:text-white border border-white/8'}`}
        >
          All
        </Link>
        {categories.map(c => (
          <Link
            key={c.id}
            to={`/forum?category=${c.id}`}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
              ${categoryId === c.id ? 'bg-brand-600 text-white' : 'bg-surface-50 text-gray-400 hover:text-white border border-white/8'}`}
          >
            {c.name}
            {c.thread_count > 0 && <span className="ml-1.5 text-xs opacity-60">{c.thread_count}</span>}
          </Link>
        ))}
      </div>

      {/* Threads list */}
      <div className="bg-surface-50 border border-white/8 rounded-xl overflow-hidden divide-y divide-white/5">
        {threads.map(t => (
          <Link
            key={t.id}
            to={`/forum/thread/${t.id}`}
            className="flex items-center gap-4 px-4 py-3.5 hover:bg-white/3 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                {t.is_pinned ? <Pin size={12} className="text-amber-400 flex-shrink-0" /> : null}
                {t.is_locked ? <Lock size={12} className="text-gray-500 flex-shrink-0" /> : null}
                <span className="text-white font-medium text-sm truncate">{t.title}</span>
              </div>
              <div className="text-xs text-gray-500">
                <span>{t.author_username || shortenWallet(t.author_wallet)}</span>
                <span className="mx-1.5">in</span>
                <span className="text-gray-400">{t.category_name}</span>
                <span className="mx-1.5">&middot;</span>
                <span>{new Date(t.created_at).toLocaleDateString()}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="text-center">
                <div className="text-sm font-medium text-white">{t.reply_count}</div>
                <div className="text-xs text-gray-500">replies</div>
              </div>
              <ChevronRight size={14} className="text-gray-600" />
            </div>
          </Link>
        ))}

        {isLoading && <div className="h-32 animate-pulse" />}
        {!isLoading && !threads.length && (
          <div className="text-center py-12 text-gray-500">
            <MessageSquare size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No threads yet. Be the first to start a discussion!</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {threadData?.total > 25 && (
        <div className="flex items-center justify-center gap-2">
          {page > 1 && (
            <Link
              to={`/forum?${categoryId ? `category=${categoryId}&` : ''}page=${page - 1}`}
              className="px-3 py-1.5 bg-surface-50 border border-white/10 rounded-lg text-sm text-gray-400 hover:text-white"
            >
              Previous
            </Link>
          )}
          <span className="text-sm text-gray-500">Page {page}</span>
          {threads.length === 25 && (
            <Link
              to={`/forum?${categoryId ? `category=${categoryId}&` : ''}page=${page + 1}`}
              className="px-3 py-1.5 bg-surface-50 border border-white/10 rounded-lg text-sm text-gray-400 hover:text-white"
            >
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
