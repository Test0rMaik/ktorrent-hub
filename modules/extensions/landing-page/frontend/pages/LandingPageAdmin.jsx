import { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText, Eye, Bold, Italic, Underline, Heading1, Heading2, Heading3,
  Link, Image, List, ListOrdered, Quote, Minus,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../../../../frontend/src/lib/api';
import { Button } from '../../../../../frontend/src/components/ui/Button';
import { renderContent } from '../renderContent';

const getSettings = () => api.get('/ext/landing-page/settings').then(r => r.data);
const patchSettings = data => api.patch('/ext/landing-page/settings', data).then(r => r.data);

export default function LandingPageAdmin() {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['lp-admin-settings'],
    queryFn: getSettings,
    retry: false,
  });
  const [form, setForm] = useState(null);
  const [preview, setPreview] = useState(false);
  const textareaRef = useRef(null);

  if (data && !form) setForm(data);

  const mut = useMutation({
    mutationFn: patchSettings,
    onSuccess: (res) => {
      setForm(res);
      qc.invalidateQueries({ queryKey: ['lp-admin-settings'] });
      qc.invalidateQueries({ queryKey: ['landing-page-content'] });
      toast.success('Landing page saved');
    },
    onError: (err) => toast.error(err?.response?.data?.error || 'Save failed'),
  });

  // Insert formatting around selected text or at cursor
  const insertFormat = useCallback((before, after = '') => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const text = form.content || '';
    const selected = text.slice(start, end);
    const replacement = before + (selected || 'text') + after;
    const newText = text.slice(0, start) + replacement + text.slice(end);
    setForm(f => ({ ...f, content: newText }));

    // Restore cursor after React re-render
    requestAnimationFrame(() => {
      ta.focus();
      if (selected) {
        ta.selectionStart = start;
        ta.selectionEnd = start + replacement.length;
      } else {
        // Select the placeholder "text" so user can type over it
        ta.selectionStart = start + before.length;
        ta.selectionEnd = start + before.length + 4;
      }
    });
  }, [form?.content]);

  const insertLine = useCallback((prefix) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const text = form.content || '';
    // Find start of current line
    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    const before = text.slice(0, lineStart);
    const after = text.slice(lineStart);
    const newText = before + prefix + after;
    setForm(f => ({ ...f, content: newText }));
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = start + prefix.length;
    });
  }, [form?.content]);

  const insertAtCursor = useCallback((insertion) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const text = form.content || '';
    const newText = text.slice(0, start) + insertion + text.slice(start);
    setForm(f => ({ ...f, content: newText }));
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = start + insertion.length;
    });
  }, [form?.content]);

  if (isLoading) return <div className="h-40 bg-surface-50 rounded-xl animate-pulse" />;

  if (isError || !form) {
    return (
      <div className="bg-surface-50 border border-white/8 rounded-xl p-6 text-center space-y-2">
        <p className="text-sm text-gray-400">Could not load Landing Page settings.</p>
        <p className="text-xs text-gray-500">Make sure the backend is running and try refreshing the page.</p>
      </div>
    );
  }

  const TOOLBAR = [
    { icon: <Bold size={14} />,       title: 'Bold',           action: () => insertFormat('**', '**') },
    { icon: <Italic size={14} />,     title: 'Italic',         action: () => insertFormat('*', '*') },
    { icon: <Underline size={14} />,  title: 'Underline',      action: () => insertFormat('__', '__') },
    'sep',
    { icon: <Heading1 size={14} />,   title: 'Heading 1',      action: () => insertLine('# ') },
    { icon: <Heading2 size={14} />,   title: 'Heading 2',      action: () => insertLine('## ') },
    { icon: <Heading3 size={14} />,   title: 'Heading 3',      action: () => insertLine('### ') },
    'sep',
    { icon: <Link size={14} />,       title: 'Link',           action: () => insertFormat('[', '](https://example.com)') },
    { icon: <Image size={14} />,      title: 'Image',          action: () => insertAtCursor('\n![alt text](https://example.com/image.png)\n') },
    'sep',
    { icon: <List size={14} />,       title: 'Bullet List',    action: () => insertLine('- ') },
    { icon: <ListOrdered size={14} />,title: 'Numbered List',  action: () => insertLine('1. ') },
    { icon: <Quote size={14} />,      title: 'Quote',          action: () => insertLine('> ') },
    { icon: <Minus size={14} />,      title: 'Horizontal Rule',action: () => insertAtCursor('\n---\n') },
  ];

  return (
    <div className="space-y-6">
      {/* Toggle */}
      <div className="bg-surface-50 border border-white/8 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <FileText size={18} className="text-brand-400" />
          <h3 className="font-semibold text-white">Landing Page Settings</h3>
        </div>

        <label className="flex items-start justify-between gap-4 cursor-pointer">
          <div>
            <p className="text-sm text-white">Enable landing page</p>
            <p className="text-xs text-gray-500">Show a custom page before users can access the tracker</p>
          </div>
          <button
            role="switch"
            aria-checked={!!form.enabled}
            onClick={() => setForm(f => ({ ...f, enabled: !f.enabled }))}
            className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors ${form.enabled ? 'bg-brand-600' : 'bg-white/10'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${form.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </label>

        <label className="flex items-start justify-between gap-4 cursor-pointer">
          <div>
            <p className="text-sm text-white">Require login to proceed</p>
            <p className="text-xs text-gray-500">Users must connect their wallet before entering the tracker</p>
          </div>
          <button
            role="switch"
            aria-checked={!!form.requireLogin}
            onClick={() => setForm(f => ({ ...f, requireLogin: !f.requireLogin }))}
            className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors ${form.requireLogin ? 'bg-brand-600' : 'bg-white/10'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${form.requireLogin ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </label>
      </div>

      {/* Title */}
      <div className="bg-surface-50 border border-white/8 rounded-2xl p-6">
        <label className="block text-sm text-gray-300 mb-2">Page Title</label>
        <input
          value={form.title ?? ''}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          placeholder="Welcome"
          className="w-full px-3 py-2 bg-surface-100 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      {/* Content editor */}
      <div className="bg-surface-50 border border-white/8 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-3">
          <label className="block text-sm text-gray-300">Page Content</label>
          <button
            onClick={() => setPreview(!preview)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
              ${preview ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
          >
            <Eye size={13} /> {preview ? 'Edit' : 'Preview'}
          </button>
        </div>

        {preview ? (
          <div className="min-h-[200px] p-4 bg-surface-100 rounded-lg border border-white/10">
            {renderContent(form.content || '', 'preview')}
            {!form.content && <p className="text-gray-500 italic">Nothing to preview</p>}
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div className="flex items-center gap-0.5 flex-wrap mb-2 p-1 bg-surface-100 border border-white/10 rounded-lg">
              {TOOLBAR.map((item, i) =>
                item === 'sep' ? (
                  <div key={i} className="w-px h-5 bg-white/10 mx-1" />
                ) : (
                  <button
                    key={i}
                    title={item.title}
                    onClick={item.action}
                    className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    {item.icon}
                  </button>
                )
              )}
            </div>

            <textarea
              ref={textareaRef}
              value={form.content ?? ''}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              rows={15}
              placeholder="Start typing your landing page content..."
              className="w-full px-3 py-2 bg-surface-100 border border-white/10 rounded-lg text-sm text-white font-mono placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-y"
            />
          </>
        )}
      </div>

      <Button size="lg" loading={mut.isPending} onClick={() => mut.mutate(form)}>
        Save Landing Page
      </Button>
    </div>
  );
}
