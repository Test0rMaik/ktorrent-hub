import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../../../../../frontend/src/lib/api';
import { Button } from '../../../../../frontend/src/components/ui/Button';
import { useAuthStore } from '../../../../../frontend/src/store/authStore';

const getCategories = () => api.get('/ext/forum/categories').then(r => r.data);
const createThread = data => api.post('/ext/forum/threads', data).then(r => r.data);

export default function ForumNewThread() {
  const navigate = useNavigate();
  const isAuthed = useAuthStore(s => s.isAuthed);

  const [categoryId, setCategoryId] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const { data: catData } = useQuery({
    queryKey: ['forum-categories'],
    queryFn: getCategories,
    staleTime: 60_000,
  });

  const mut = useMutation({
    mutationFn: () => createThread({ categoryId, title: title.trim(), body: body.trim() }),
    onSuccess: (res) => {
      toast.success('Thread created');
      navigate(`/forum/thread/${res.threadId}`);
    },
    onError: (err) => toast.error(err?.response?.data?.error || 'Failed to create thread'),
  });

  if (!isAuthed) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <p className="text-gray-400">Connect your wallet to create a thread.</p>
      </div>
    );
  }

  const categories = catData?.categories || [];

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <Link to="/forum" className="text-sm text-gray-400 hover:text-brand-400 flex items-center gap-1">
        <ArrowLeft size={14} /> Back to Forum
      </Link>

      <h1 className="text-xl font-bold text-white">New Thread</h1>

      <div className="bg-surface-50 border border-white/8 rounded-2xl p-6 space-y-4">
        {/* Category */}
        <div>
          <label className="block text-sm text-gray-300 mb-1">Category</label>
          <select
            value={categoryId}
            onChange={e => setCategoryId(e.target.value)}
            className="w-full px-3 py-2 bg-surface-100 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer"
          >
            <option value="">Select a category...</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Title */}
        <div>
          <label className="block text-sm text-gray-300 mb-1">Title</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            maxLength={200}
            placeholder="Thread title..."
            className="w-full px-3 py-2 bg-surface-100 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        {/* Body */}
        <div>
          <label className="block text-sm text-gray-300 mb-1">Body</label>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={10}
            maxLength={10000}
            placeholder="Write your post..."
            className="w-full px-3 py-2 bg-surface-100 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-y"
          />
          <p className="text-xs text-gray-600 mt-1">{body.length}/10,000</p>
        </div>

        <div className="flex justify-end">
          <Button
            size="lg"
            loading={mut.isPending}
            onClick={() => mut.mutate()}
            disabled={!categoryId || !title.trim() || !body.trim()}
          >
            Create Thread
          </Button>
        </div>
      </div>
    </div>
  );
}
