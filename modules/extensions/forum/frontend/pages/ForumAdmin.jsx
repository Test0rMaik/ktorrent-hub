import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Plus, Trash2, Pencil, ChevronUp, ChevronDown, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../../../../frontend/src/lib/api';
import { Button } from '../../../../../frontend/src/components/ui/Button';

const getCategories = () => api.get('/ext/forum/categories').then(r => r.data);
const getStats = () => api.get('/ext/forum/stats').then(r => r.data);
const createCategory = data => api.post('/ext/forum/categories', data).then(r => r.data);
const patchCategory = (id, data) => api.patch(`/ext/forum/categories/${id}`, data).then(r => r.data);
const deleteCategory = id => api.delete(`/ext/forum/categories/${id}`).then(r => r.data);

export default function ForumAdmin() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [editing, setEditing] = useState(null);   // category id being edited
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const { data: stats, isError: statsError } = useQuery({ queryKey: ['forum-stats'], queryFn: getStats, staleTime: 30_000, retry: false });
  const { data: catData, isLoading, isError } = useQuery({ queryKey: ['forum-categories'], queryFn: getCategories, staleTime: 15_000, retry: false });

  if (isError || statsError) {
    return (
      <div className="bg-surface-50 border border-white/8 rounded-xl p-6 text-center space-y-2">
        <p className="text-sm text-gray-400">Could not load Forum settings.</p>
        <p className="text-xs text-gray-500">Make sure the backend is running and try refreshing the page.</p>
      </div>
    );
  }

  const invalidate = () => { qc.invalidateQueries({ queryKey: ['forum-categories'] }); qc.invalidateQueries({ queryKey: ['forum-stats'] }); };

  const createMut = useMutation({
    mutationFn: () => createCategory({ name: name.trim(), description: desc.trim() }),
    onSuccess: () => { setName(''); setDesc(''); invalidate(); toast.success('Category created'); },
    onError: (err) => toast.error(err?.response?.data?.error || 'Failed'),
  });

  const patchMut = useMutation({
    mutationFn: ({ id, ...data }) => patchCategory(id, data),
    onSuccess: () => { setEditing(null); invalidate(); toast.success('Category updated'); },
    onError: (err) => toast.error(err?.response?.data?.error || 'Update failed'),
  });

  const deleteMut = useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => { invalidate(); toast.success('Category deleted'); },
  });

  const categories = catData?.categories || [];

  const startEdit = (cat) => {
    setEditing(cat.id);
    setEditName(cat.name);
    setEditDesc(cat.description || '');
  };

  const saveEdit = () => {
    if (!editName.trim()) return;
    patchMut.mutate({ id: editing, name: editName.trim(), description: editDesc.trim() });
  };

  const moveCategory = (cat, direction) => {
    // Swap sort_order with the adjacent category
    const idx = categories.findIndex(c => c.id === cat.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= categories.length) return;

    const other = categories[swapIdx];
    // Use their current sort_orders, or fall back to index-based
    const catOrder = cat.sort_order ?? idx;
    const otherOrder = other.sort_order ?? swapIdx;

    // Fire both patches
    patchMut.mutate({ id: cat.id, sort_order: otherOrder });
    patchMut.mutate({ id: other.id, sort_order: catOrder });
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Categories', value: stats.categories },
            { label: 'Threads', value: stats.threads },
            { label: 'Posts', value: stats.posts },
          ].map(s => (
            <div key={s.label} className="bg-surface-50 border border-white/8 rounded-xl p-4">
              <div className="text-2xl font-bold text-white">{s.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Create category */}
      <div className="bg-surface-50 border border-white/8 rounded-2xl p-6 space-y-3">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <Plus size={16} className="text-brand-400" /> Add Forum Category
        </h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Category name"
            maxLength={100}
            className="px-3 py-2 bg-surface-100 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <input
            value={desc}
            onChange={e => setDesc(e.target.value)}
            placeholder="Description (optional)"
            maxLength={500}
            className="px-3 py-2 bg-surface-100 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <Button size="sm" loading={createMut.isPending} onClick={() => name.trim() && createMut.mutate()} disabled={!name.trim()}>
          Create Category
        </Button>
      </div>

      {/* Category list */}
      <div className="bg-surface-50 border border-white/8 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/8">
          <h3 className="font-semibold text-white text-sm">Categories</h3>
          <p className="text-xs text-gray-500 mt-0.5">Click the pencil to edit. Use arrows to reorder.</p>
        </div>

        <div className="divide-y divide-white/5">
          {categories.map((c, idx) => (
            <div key={c.id} className="px-4 py-3 hover:bg-white/3 transition-colors">
              {editing === c.id ? (
                /* Edit mode */
                <div className="space-y-2">
                  <div className="grid sm:grid-cols-2 gap-2">
                    <input
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      placeholder="Category name"
                      maxLength={100}
                      className="px-3 py-1.5 bg-surface-100 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
                      autoFocus
                      onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(null); }}
                    />
                    <input
                      value={editDesc}
                      onChange={e => setEditDesc(e.target.value)}
                      placeholder="Description (optional)"
                      maxLength={500}
                      className="px-3 py-1.5 bg-surface-100 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
                      onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(null); }}
                    />
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={saveEdit}
                      disabled={!editName.trim() || patchMut.isPending}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
                    >
                      <Check size={12} /> Save
                    </button>
                    <button
                      onClick={() => setEditing(null)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                    >
                      <X size={12} /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* Display mode */
                <div className="flex items-center gap-3">
                  {/* Order arrows */}
                  <div className="flex flex-col gap-0.5 flex-shrink-0">
                    <button
                      onClick={() => moveCategory(c, 'up')}
                      disabled={idx === 0}
                      className="p-0.5 rounded text-gray-600 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                      title="Move up"
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      onClick={() => moveCategory(c, 'down')}
                      disabled={idx === categories.length - 1}
                      className="p-0.5 rounded text-gray-600 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                      title="Move down"
                    >
                      <ChevronDown size={14} />
                    </button>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{c.name}</p>
                    {c.description && <p className="text-xs text-gray-500 mt-0.5 truncate">{c.description}</p>}
                  </div>

                  {/* Thread count */}
                  <span className="text-xs text-gray-500 flex-shrink-0 tabular-nums">
                    {c.thread_count} {c.thread_count === 1 ? 'thread' : 'threads'}
                  </span>

                  {/* Actions */}
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={() => startEdit(c)}
                      className="p-1.5 rounded text-gray-500 hover:text-brand-400 hover:bg-brand-500/10 transition-colors"
                      title="Edit category"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => { if (confirm(`Delete category "${c.name}" and all its threads?`)) deleteMut.mutate(c.id); }}
                      className="p-1.5 rounded text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Delete category"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {isLoading && <div className="h-20 animate-pulse" />}
        {!isLoading && !categories.length && (
          <p className="text-center py-8 text-gray-500 text-sm">No forum categories yet</p>
        )}
      </div>
    </div>
  );
}
