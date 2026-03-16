import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { useState } from 'react';
import { Download, Magnet, Bookmark, BookmarkCheck, MessageSquare, Users, Clock, FileText, ChevronDown, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { getTorrent, addComment, toggleBookmark, formatBytes } from '../lib/api';
import { shortenKlvAddress } from '../lib/klever';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useAuth } from '../hooks/useAuth';

export default function TorrentDetail() {
  const { id }         = useParams();
  const { isAuthed, token } = useAuth();
  const qc             = useQueryClient();
  const [comment, setComment] = useState('');
  const [filesOpen, setFilesOpen] = useState(false);

  const { data: t, isLoading } = useQuery({
    queryKey: ['torrent', id],
    queryFn:  () => getTorrent(id),
  });

  const commentMut = useMutation({
    mutationFn: body => addComment(id, body),
    onSuccess:  ()   => { qc.invalidateQueries(['torrent', id]); setComment(''); toast.success('Comment added'); },
    onError:    err  => toast.error(err?.response?.data?.error || 'Failed'),
  });

  const bookmarkMut = useMutation({
    mutationFn: () => toggleBookmark(id),
    onSuccess:  ()  => qc.invalidateQueries(['torrent', id]),
  });

  if (isLoading) return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="space-y-4">
        {[80, 40, 60, 200].map(h => (
          <div key={h} className={`h-${h / 4} bg-surface-50 rounded-xl animate-pulse`} />
        ))}
      </div>
    </div>
  );

  if (!t) return <div className="text-center py-20 text-gray-400">Torrent not found</div>;

  const magnetUrl = t.magnet || `magnet:?xt=urn:btih:${t.info_hash}&dn=${encodeURIComponent(t.name)}`;
  const torrentDownloadUrl = t.torrent_file ? `/api/torrents/${t.id}/download` : null;

  const downloadTorrent = async () => {
    if (!torrentDownloadUrl) return;
    try {
      const res = await fetch(torrentDownloadUrl, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) { toast.error('Download failed'); return; }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      const cd   = res.headers.get('Content-Disposition');
      a.download = cd?.match(/filename="([^"]+)"/)?.[1] ?? `${t.name}.torrent`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('Download failed'); }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">

      {/* ── Header card ───────────────────────────────── */}
      <div className="bg-surface-50 border border-white/8 rounded-2xl p-6">
        <div className="flex items-start gap-4">
          {t.poster_url && (
            <img src={t.poster_url} alt="" className="w-20 h-28 rounded-lg object-cover flex-shrink-0 bg-surface-200" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-gray-500 capitalize">{t.category}</span>
                  {t.isFreeleech && <Badge color="green">Freeleech</Badge>}
                  {t.isFeatured  && <Badge color="purple">Featured</Badge>}
                </div>
                <h1 className="text-2xl font-bold text-white">{t.name}</h1>
              </div>
              {isAuthed && (
                <button
                  onClick={() => bookmarkMut.mutate()}
                  className="p-2 text-gray-400 hover:text-brand-400 hover:bg-brand-500/10 rounded-lg transition-colors"
                >
                  {t.bookmarked ? <BookmarkCheck size={20} className="text-brand-400" /> : <Bookmark size={20} />}
                </button>
              )}
            </div>

            {t.description && <p className="mt-2 text-gray-400 text-sm">{t.description}</p>}

            {t.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {t.tags.map(tag => <Badge key={tag} color="gray">#{tag}</Badge>)}
              </div>
            )}

            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
              {[
                { label: 'Seeders',    value: t.liveSeeders  ?? t.seeders,  color: 'text-emerald-400' },
                { label: 'Leechers',   value: t.liveLeechers ?? t.leechers, color: 'text-red-400' },
                { label: 'Completed',  value: t.completed,                  color: 'text-blue-400' },
                { label: 'Size',       value: formatBytes(t.size),          color: 'text-white' },
              ].map(s => (
                <div key={s.label} className="bg-surface-100 rounded-lg p-2 text-center">
                  <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
                  <div className="text-xs text-gray-500">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Download buttons */}
        <div className="flex flex-wrap gap-3 mt-6">
          <a href={magnetUrl} className="inline-flex">
            <Button variant="accent" size="md">
              <Magnet size={16} /> Open Magnet
            </Button>
          </a>
          {torrentDownloadUrl && (
            <Button variant="secondary" size="md" onClick={downloadTorrent}>
              <Download size={16} /> Download .torrent
            </Button>
          )}
        </div>

        {/* Info */}
        <div className="mt-4 pt-4 border-t border-white/10 flex flex-wrap gap-4 text-xs text-gray-500">
          <span>Uploader: <Link to={`/user/${t.uploader_wallet}`} className="text-brand-400 hover:underline">{t.uploader_username || shortenKlvAddress(t.uploader_wallet)}</Link></span>
          <span>Added: {new Date(t.created_at).toLocaleDateString()}</span>
          <span>Files: {t.file_count}</span>
          <span>Views: {t.views}</span>
          <span className="font-mono text-gray-600">Hash: {t.info_hash}</span>
        </div>
      </div>

      {/* ── File list ─────────────────────────────────── */}
      {t.files?.length > 0 && (
        <div className="bg-surface-50 border border-white/8 rounded-2xl overflow-hidden">
          <button
            className="w-full flex items-center gap-3 px-6 py-4 text-left hover:bg-white/5 transition-colors"
            onClick={() => setFilesOpen(o => !o)}
          >
            <FileText size={16} className="text-gray-400" />
            <span className="font-medium text-white">{t.file_count} File{t.file_count !== 1 ? 's' : ''}</span>
            <span className="ml-auto text-gray-400">{filesOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</span>
          </button>
          {filesOpen && (
            <div className="px-6 pb-4 space-y-1 max-h-64 overflow-y-auto">
              {t.files.map((f, i) => (
                <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-white/5">
                  <span className="text-gray-300 truncate font-mono text-xs">{f.path}</span>
                  <span className="text-gray-500 text-xs ml-4 flex-shrink-0">{formatBytes(f.size)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Comments ──────────────────────────────────── */}
      <div className="bg-surface-50 border border-white/8 rounded-2xl p-6 space-y-5">
        <h2 className="font-semibold text-white flex items-center gap-2">
          <MessageSquare size={16} /> Comments ({t.comments?.length || 0})
        </h2>

        {/* Comment form */}
        {isAuthed ? (
          <div className="flex flex-col gap-2">
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Add a comment…"
              rows={3}
              className="w-full px-3 py-2 bg-surface-100 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                loading={commentMut.isPending}
                disabled={!comment.trim()}
                onClick={() => commentMut.mutate(comment.trim())}
              >
                Post
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Connect your wallet to comment.</p>
        )}

        {/* Comment list */}
        <div className="space-y-4">
          {t.comments?.map(c => (
            <div key={c.id} className="flex gap-3">
              <div
                className="w-8 h-8 rounded-full flex-shrink-0 mt-0.5"
                style={{ background: `hsl(${parseInt(c.wallet?.slice(4, 6), 36) * 5}, 60%, 50%)` }}
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Link to={`/user/${c.wallet}`} className="text-sm font-medium text-brand-400 hover:underline">
                    {c.username || shortenKlvAddress(c.wallet)}
                  </Link>
                  <span className="text-xs text-gray-600">{new Date(c.created_at).toLocaleString()}</span>
                </div>
                <p className="text-sm text-gray-300 whitespace-pre-wrap">{c.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
