import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Upload, Info, Lock, Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { createTorrent, getCategories, getSiteSettings, getMyPasskey } from '../lib/api';
import { Button } from '../components/ui/Button';
import { Input, Textarea, Select } from '../components/ui/Input';
import { useAuth } from '../hooks/useAuth';
import { useAdmin } from '../hooks/useAdmin';

export default function Submit() {
  const navigate = useNavigate();
  const { isAuthed } = useAuth();
  const { isAdmin } = useAdmin();
  const fileRef = useRef(null);

  const { data: siteData } = useQuery({ queryKey: ['siteSettings'], queryFn: getSiteSettings });
  const { data: pkData }   = useQuery({ queryKey: ['passkey'], queryFn: getMyPasskey, enabled: isAuthed, staleTime: Infinity });

  const [form, setForm] = useState({
    name: '', description: '', category: '', tags: '',
    magnet: '', infoHash: '', posterUrl: '',
  });
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [copied, setCopied] = useState(false);

  const passkey    = pkData?.passkey || '';
  const trackerUrl = passkey
    ? `${window.location.origin}/announce?passkey=${passkey}`
    : `${window.location.origin}/announce`;
  const copyTracker = useCallback(() => {
    navigator.clipboard.writeText(trackerUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [trackerUrl]);

  const { data: catsData } = useQuery({ queryKey: ['categories'], queryFn: getCategories });
  const cats = catsData?.categories || [];

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));

  const mutation = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v); });
      if (file) fd.append('torrentFile', file);
      return createTorrent(fd);
    },
    onSuccess: data => {
      toast.success('Torrent submitted!');
      navigate(`/torrent/${data.id}`);
    },
    onError: err => {
      const msg = err?.response?.data?.error || 'Submission failed';
      toast.error(msg);
    },
  });

  const validate = () => {
    const e = {};
    if (!form.name.trim())     e.name     = 'Name is required';
    if (!form.category)         e.category = 'Select a category';
    if (!file && !form.magnet && !form.infoHash) {
      e.file = 'Provide a .torrent file, magnet link, or info hash';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = e => {
    e.preventDefault();
    if (validate()) mutation.mutate();
  };

  if (!isAuthed) return (
    <div className="max-w-xl mx-auto px-4 py-20 text-center">
      <div className="text-5xl mb-4">🔒</div>
      <h1 className="text-2xl font-bold text-white mb-2">Sign in required</h1>
      <p className="text-gray-400">Connect your wallet to submit a torrent.</p>
    </div>
  );

  if (siteData?.adminOnlyUploads && !isAdmin) return (
    <div className="max-w-xl mx-auto px-4 py-20 text-center">
      <Lock size={48} className="mx-auto mb-4 text-gray-500" />
      <h1 className="text-2xl font-bold text-white mb-2">Uploads restricted</h1>
      <p className="text-gray-400">
        The tracker admin has restricted torrent uploads to themselves only.
        {siteData?.rewardsEnabled !== false
          ? ` You can still seed existing torrents and earn ${(siteData?.tokenId || 'KTH-000000').split('-')[0]} rewards.`
          : ' You can still browse and seed existing torrents.'
        }
      </p>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="text-2xl font-bold text-white mb-6">Submit Torrent</h1>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* .torrent file or magnet */}
        <div className="bg-surface-50 border border-dashed border-white/20 rounded-xl p-6">
          <p className="text-sm font-medium text-gray-300 mb-3">Torrent Source</p>

          {/* Drag & drop zone */}
          <div
            className={`relative flex flex-col items-center justify-center gap-2 py-8 rounded-lg border-2 border-dashed transition-colors cursor-pointer ${file ? 'border-green-500/40 bg-green-500/5' : 'border-white/10 hover:border-brand-500/40 hover:bg-brand-500/5'}`}
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={24} className={file ? 'text-green-400' : 'text-gray-500'} />
            <p className="text-sm text-gray-400">
              {file ? <span className="text-green-400 font-medium">{file.name}</span> : 'Click to upload .torrent file'}
            </p>
            <p className="text-xs text-gray-600">Max 5 MB</p>
            <input
              ref={fileRef}
              type="file"
              accept=".torrent,application/x-bittorrent"
              className="hidden"
              onChange={e => setFile(e.target.files[0] || null)}
            />
          </div>

          <div className="flex items-center gap-3 my-3">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-xs text-gray-500">or</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <Input
            placeholder="magnet:?xt=urn:btih:…"
            value={form.magnet}
            onChange={e => set('magnet', e.target.value)}
            error={!file && !form.infoHash ? errors.file : undefined}
          />

          <p className="text-xs text-gray-600 mt-2 flex items-center gap-1">
            <Info size={11} /> Providing a magnet link is enough — the info hash will be extracted automatically.
          </p>
        </div>

        <Input
          label="Torrent Name *"
          placeholder="The title shown on the site"
          value={form.name}
          onChange={e => set('name', e.target.value)}
          error={errors.name}
        />

        <Select
          label="Category *"
          value={form.category}
          onChange={e => set('category', e.target.value)}
          error={errors.category}
        >
          <option value="">Select a category…</option>
          {cats.map(c => (
            <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
          ))}
        </Select>

        <Textarea
          label="Description"
          placeholder="Optional — briefly describe the content"
          rows={4}
          value={form.description}
          onChange={e => set('description', e.target.value)}
        />

        <Input
          label="Tags"
          placeholder="Comma-separated: action, 1080p, x265"
          value={form.tags}
          onChange={e => set('tags', e.target.value)}
        />

        <Input
          label="Poster / Cover Image URL"
          placeholder="https://…"
          value={form.posterUrl}
          onChange={e => set('posterUrl', e.target.value)}
        />

        {/* Tracker URL */}
        <div className="p-4 bg-surface-50 border border-white/10 rounded-xl text-sm space-y-2">
          <p className="font-medium text-white flex items-center gap-1.5">
            <Info size={14} className="text-gray-400" /> Add this tracker to your torrent
          </p>
          <p className="text-xs text-gray-500">When creating your torrent file in your BitTorrent client, add this tracker URL so peers can find each other through this site.</p>
          <div className="flex items-center gap-2 mt-1">
            <code className="flex-1 px-3 py-1.5 bg-surface-100 border border-white/10 rounded-lg text-xs text-brand-300 font-mono truncate">
              {trackerUrl}
            </code>
            <button
              type="button"
              onClick={copyTracker}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-xs text-gray-300 hover:text-white hover:border-white/30 transition-colors"
            >
              {copied ? <><Check size={12} className="text-green-400" /> Copied</> : <><Copy size={12} /> Copy</>}
            </button>
          </div>
        </div>

        {siteData?.rewardsEnabled !== false && (
          <div className="p-4 bg-brand-500/5 border border-brand-500/20 rounded-xl text-sm text-gray-400">
            <p className="font-medium text-brand-300 mb-1">Earn {(siteData?.tokenId || 'KTH-000000').split('-')[0]} tokens for seeding</p>
            <p>After uploading, register your BitTorrent client's peer ID in the dashboard to start earning tokens for every hour you seed this torrent.</p>
          </div>
        )}

        <Button type="submit" size="lg" className="w-full" loading={mutation.isPending}>
          <Upload size={16} /> Submit Torrent
        </Button>
      </form>
    </div>
  );
}
