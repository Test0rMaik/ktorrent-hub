import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Pin, Lock, Send, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../../../../frontend/src/lib/api';
import { Button } from '../../../../../frontend/src/components/ui/Button';
import { Badge } from '../../../../../frontend/src/components/ui/Badge';
import { useAuthStore } from '../../../../../frontend/src/store/authStore';
import { useAdmin } from '../../../../../frontend/src/hooks/useAdmin';

const getThread = id => api.get(`/ext/forum/threads/${id}`).then(r => r.data);
const replyToThread = (id, body) => api.post(`/ext/forum/threads/${id}/posts`, { body }).then(r => r.data);
const patchThread = (id, data) => api.patch(`/ext/forum/threads/${id}`, data).then(r => r.data);
const deletePost = id => api.delete(`/ext/forum/posts/${id}`).then(r => r.data);
const deleteThread = id => api.delete(`/ext/forum/threads/${id}`).then(r => r.data);

function shortenWallet(w) {
  if (!w) return '?';
  return w.length > 16 ? w.slice(0, 8) + '...' + w.slice(-4) : w;
}

export default function ForumThread() {
  const { id } = useParams();
  const qc = useQueryClient();
  const isAuthed = useAuthStore(s => s.isAuthed);
  const { isAdmin } = useAdmin();
  const [reply, setReply] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['forum-thread', id],
    queryFn: () => getThread(id),
    staleTime: 15_000,
  });

  const replyMut = useMutation({
    mutationFn: () => replyToThread(id, reply),
    onSuccess: () => {
      setReply('');
      qc.invalidateQueries(['forum-thread', id]);
      toast.success('Reply posted');
    },
    onError: (err) => toast.error(err?.response?.data?.error || 'Reply failed'),
  });

  const pinMut = useMutation({
    mutationFn: () => patchThread(id, { is_pinned: !data?.thread?.is_pinned }),
    onSuccess: () => qc.invalidateQueries(['forum-thread', id]),
  });

  const lockMut = useMutation({
    mutationFn: () => patchThread(id, { is_locked: !data?.thread?.is_locked }),
    onSuccess: () => qc.invalidateQueries(['forum-thread', id]),
  });

  const deletePostMut = useMutation({
    mutationFn: deletePost,
    onSuccess: () => {
      qc.invalidateQueries(['forum-thread', id]);
      toast.success('Post deleted');
    },
  });

  const deleteThreadMut = useMutation({
    mutationFn: () => deleteThread(id),
    onSuccess: () => {
      toast.success('Thread deleted');
      window.location.href = '/forum';
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="h-8 bg-surface-50 rounded animate-pulse mb-4 w-2/3" />
        <div className="h-32 bg-surface-50 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!data?.thread) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <p className="text-2xl text-gray-500">Thread not found</p>
        <Link to="/forum" className="text-brand-400 text-sm mt-2 inline-block">Back to Forum</Link>
      </div>
    );
  }

  const { thread, posts } = data;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <div>
        <Link to="/forum" className="text-sm text-gray-400 hover:text-brand-400 flex items-center gap-1 mb-3">
          <ArrowLeft size={14} /> Back to Forum
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2 flex-wrap">
              {thread.is_pinned && <Pin size={14} className="text-amber-400" />}
              {thread.is_locked && <Lock size={14} className="text-gray-500" />}
              {thread.title}
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              by {thread.author_username || shortenWallet(thread.author_wallet)}
              <span className="mx-1">&middot;</span>
              in <span className="text-gray-400">{thread.category_name}</span>
              <span className="mx-1">&middot;</span>
              {new Date(thread.created_at).toLocaleString()}
            </p>
          </div>

          {isAdmin && (
            <div className="flex gap-1 flex-shrink-0">
              <button
                onClick={() => pinMut.mutate()}
                className={`p-2 rounded-lg transition-colors ${thread.is_pinned ? 'text-amber-400 bg-amber-500/10' : 'text-gray-500 hover:text-amber-400'}`}
                title={thread.is_pinned ? 'Unpin' : 'Pin'}
              >
                <Pin size={14} />
              </button>
              <button
                onClick={() => lockMut.mutate()}
                className={`p-2 rounded-lg transition-colors ${thread.is_locked ? 'text-red-400 bg-red-500/10' : 'text-gray-500 hover:text-red-400'}`}
                title={thread.is_locked ? 'Unlock' : 'Lock'}
              >
                <Lock size={14} />
              </button>
              <button
                onClick={() => { if (confirm('Delete this thread?')) deleteThreadMut.mutate(); }}
                className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title="Delete thread"
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Posts */}
      <div className="space-y-3">
        {posts?.map((post, i) => (
          <div key={post.id} className="bg-surface-50 border border-white/8 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white">
                  {post.author_username || shortenWallet(post.author_wallet)}
                </span>
                {i === 0 && <Badge color="blue">OP</Badge>}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600">
                  {new Date(post.created_at).toLocaleString()}
                </span>
                {isAdmin && (
                  <button
                    onClick={() => deletePostMut.mutate(post.id)}
                    className="p-1 rounded text-gray-600 hover:text-red-400 transition-colors"
                    title="Delete post"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>
            <div className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
              {post.body}
            </div>
          </div>
        ))}
      </div>

      {/* Reply */}
      {thread.is_locked ? (
        <div className="text-center py-4">
          <Badge color="gray"><Lock size={12} /> This thread is locked</Badge>
        </div>
      ) : isAuthed ? (
        <div className="bg-surface-50 border border-white/8 rounded-xl p-4 space-y-3">
          <textarea
            value={reply}
            onChange={e => setReply(e.target.value)}
            rows={4}
            placeholder="Write your reply..."
            className="w-full px-3 py-2 bg-surface-100 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-y"
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              loading={replyMut.isPending}
              onClick={() => reply.trim() && replyMut.mutate()}
              disabled={!reply.trim()}
            >
              <Send size={13} /> Reply
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-center text-sm text-gray-500 py-4">
          Connect your wallet to reply.
        </p>
      )}
    </div>
  );
}
