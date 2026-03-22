import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus, Copy, Trash2, Check, X, Inbox, Settings } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../../../../frontend/src/lib/api';
import { Button } from '../../../../../frontend/src/components/ui/Button';
import { Badge } from '../../../../../frontend/src/components/ui/Badge';

const getInvites  = () => api.get('/ext/invite-system/invites').then(r => r.data);
const getStats    = () => api.get('/ext/invite-system/stats').then(r => r.data);
const getSettings = () => api.get('/ext/invite-system/settings').then(r => r.data);
const getRequests = () => api.get('/ext/invite-system/requests').then(r => r.data);
const createInvites  = count => api.post('/ext/invite-system/invites', { count }).then(r => r.data);
const revokeInvite   = code  => api.delete(`/ext/invite-system/invites/${code}`).then(r => r.data);
const patchSettings  = data  => api.patch('/ext/invite-system/settings', data).then(r => r.data);
const approveRequest = id    => api.post(`/ext/invite-system/requests/${id}/approve`).then(r => r.data);
const denyRequest    = id    => api.post(`/ext/invite-system/requests/${id}/deny`).then(r => r.data);

function shortenWallet(w) {
  if (!w) return '?';
  return w.length > 16 ? w.slice(0, 8) + '...' + w.slice(-4) : w;
}

export default function InviteAdmin() {
  const qc = useQueryClient();
  const [count, setCount] = useState(1);
  const [tab, setTab] = useState('codes'); // 'codes' | 'requests'

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['invite-list'] });
    qc.invalidateQueries({ queryKey: ['invite-stats'] });
    qc.invalidateQueries({ queryKey: ['invite-requests'] });
    qc.invalidateQueries({ queryKey: ['invite-settings'] });
  };

  const { data: stats, isError: statsError } = useQuery({ queryKey: ['invite-stats'], queryFn: getStats, staleTime: 30_000, retry: false });
  const { data, isLoading, isError } = useQuery({ queryKey: ['invite-list'], queryFn: getInvites, staleTime: 15_000, retry: false });
  const { data: settingsData } = useQuery({ queryKey: ['invite-settings'], queryFn: getSettings, staleTime: 30_000, retry: false });
  const { data: requestsData } = useQuery({ queryKey: ['invite-requests'], queryFn: getRequests, staleTime: 15_000, retry: false });

  const [settingsForm, setSettingsForm] = useState(null);
  if (settingsData && !settingsForm) setSettingsForm(settingsData);

  if (isError || statsError) {
    return (
      <div className="bg-surface-50 border border-white/8 rounded-xl p-6 text-center space-y-2">
        <p className="text-sm text-gray-400">Could not load Invite System settings.</p>
        <p className="text-xs text-gray-500">Make sure the backend is running and try refreshing the page.</p>
      </div>
    );
  }

  const createMut = useMutation({
    mutationFn: () => createInvites(count),
    onSuccess: (res) => { invalidateAll(); toast.success(`Generated ${res.codes.length} invite code(s)`); },
    onError: () => toast.error('Failed to generate invites'),
  });

  const revokeMut = useMutation({
    mutationFn: revokeInvite,
    onSuccess: () => { invalidateAll(); toast.success('Invite revoked'); },
    onError: (err) => toast.error(err?.response?.data?.error || 'Revoke failed'),
  });

  const settingsMut = useMutation({
    mutationFn: patchSettings,
    onSuccess: (res) => { setSettingsForm(res); invalidateAll(); toast.success('Settings saved'); },
    onError: (err) => toast.error(err?.response?.data?.error || 'Save failed'),
  });

  const approveMut = useMutation({
    mutationFn: approveRequest,
    onSuccess: (res) => { invalidateAll(); toast.success(`Approved — ${res.count} invites granted`); },
    onError: (err) => toast.error(err?.response?.data?.error || 'Failed'),
  });

  const denyMut = useMutation({
    mutationFn: denyRequest,
    onSuccess: () => { invalidateAll(); toast.success('Request denied'); },
  });

  const copyCode = code => {
    navigator.clipboard.writeText(code);
    toast.success('Copied to clipboard');
  };

  const pendingCount = stats?.pendingRequests ?? 0;

  return (
    <div className="space-y-6">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Invites', value: stats.total },
            { label: 'Used', value: stats.used },
            { label: 'Available', value: stats.available },
            { label: 'Pending Requests', value: pendingCount },
          ].map(s => (
            <div key={s.label} className="bg-surface-50 border border-white/8 rounded-xl p-4">
              <div className="text-2xl font-bold text-white">{s.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* User Invite Settings */}
      {settingsForm && (
        <div className="bg-surface-50 border border-white/8 rounded-2xl p-6 space-y-4">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <Settings size={16} className="text-brand-400" /> User Invite Settings
          </h3>

          <label className="flex items-start justify-between gap-4 cursor-pointer">
            <div>
              <p className="text-sm text-white">Give each user invite codes</p>
              <p className="text-xs text-gray-500">
                Every registered user receives invite codes they can share. When all codes are used, users can request more (requires admin approval).
              </p>
            </div>
            <button
              role="switch"
              aria-checked={!!settingsForm.user_invites_enabled}
              onClick={() => setSettingsForm(f => ({ ...f, user_invites_enabled: !f.user_invites_enabled }))}
              className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors ${settingsForm.user_invites_enabled ? 'bg-brand-600' : 'bg-white/10'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${settingsForm.user_invites_enabled ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </label>

          {settingsForm.user_invites_enabled && (
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-400">Invites per user</label>
              <input
                type="number"
                min="1"
                max="100"
                value={settingsForm.user_invites_count ?? 3}
                onChange={e => setSettingsForm(f => ({ ...f, user_invites_count: parseInt(e.target.value, 10) || 1 }))}
                className="w-20 px-3 py-1.5 bg-surface-100 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          )}

          <Button size="sm" loading={settingsMut.isPending} onClick={() => settingsMut.mutate(settingsForm)}>
            Save Settings
          </Button>
        </div>
      )}

      {/* Tab toggle: Codes | Requests */}
      <div className="flex gap-1 bg-surface-50 border border-white/8 rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab('codes')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors
            ${tab === 'codes' ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-white'}`}
        >
          Invite Codes
        </button>
        <button
          onClick={() => setTab('requests')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5
            ${tab === 'requests' ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-white'}`}
        >
          Requests
          {pendingCount > 0 && (
            <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">{pendingCount}</span>
          )}
        </button>
      </div>

      {tab === 'codes' && (
        <>
          {/* Generate (admin codes) */}
          <div className="bg-surface-50 border border-white/8 rounded-2xl p-6">
            <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
              <UserPlus size={16} className="text-brand-400" /> Generate Admin Invite Codes
            </h3>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="1"
                max="20"
                value={count}
                onChange={e => setCount(Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1)))}
                className="w-24 px-3 py-2 bg-surface-100 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <Button size="sm" loading={createMut.isPending} onClick={() => createMut.mutate()}>
                Generate
              </Button>
            </div>
          </div>

          {/* All codes list */}
          <div className="bg-surface-50 border border-white/8 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs text-gray-500">
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3 hidden sm:table-cell">Created By</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data?.invites?.map(inv => (
                  <tr key={inv.code} className="hover:bg-white/3 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-white">{inv.code}</td>
                    <td className="px-4 py-3 hidden sm:table-cell text-gray-400 text-xs">
                      {inv.created_by_username || shortenWallet(inv.created_by_wallet)}
                    </td>
                    <td className="px-4 py-3">
                      {inv.used_by_wallet
                        ? <Badge color="gray">Used by {inv.used_by_username || shortenWallet(inv.used_by_wallet)}</Badge>
                        : <Badge color="green">Available</Badge>
                      }
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button
                          onClick={() => copyCode(inv.code)}
                          className="p-1.5 rounded text-gray-500 hover:text-brand-400 hover:bg-brand-500/10 transition-colors"
                          title="Copy code"
                        >
                          <Copy size={13} />
                        </button>
                        {!inv.used_by_wallet && (
                          <button
                            onClick={() => revokeMut.mutate(inv.code)}
                            className="p-1.5 rounded text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Revoke"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {isLoading && <div className="h-20 animate-pulse" />}
            {!isLoading && !data?.invites?.length && (
              <p className="text-center py-8 text-gray-500 text-sm">No invite codes yet</p>
            )}
          </div>
        </>
      )}

      {tab === 'requests' && (
        <div className="bg-surface-50 border border-white/8 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs text-gray-500">
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3 hidden sm:table-cell">Invites (used / total)</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {requestsData?.requests?.map(r => (
                <tr key={r.id} className="hover:bg-white/3 transition-colors">
                  <td className="px-4 py-3">
                    <span className="text-white text-xs">{r.username || shortenWallet(r.wallet)}</span>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-gray-400 text-xs">
                    {r.used_invites} / {r.total_invites}
                  </td>
                  <td className="px-4 py-3">
                    {r.status === 'pending'  && <Badge color="amber">Pending</Badge>}
                    {r.status === 'approved' && <Badge color="green">Approved</Badge>}
                    {r.status === 'denied'   && <Badge color="red">Denied</Badge>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {new Date(r.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {r.status === 'pending' ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() => approveMut.mutate(r.id)}
                          className="p-1.5 rounded text-gray-500 hover:text-green-400 hover:bg-green-500/10 transition-colors"
                          title="Approve — grant new invites"
                        >
                          <Check size={13} />
                        </button>
                        <button
                          onClick={() => denyMut.mutate(r.id)}
                          className="p-1.5 rounded text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Deny request"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-600">
                        {r.resolved_at ? new Date(r.resolved_at).toLocaleDateString() : ''}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!requestsData?.requests?.length && (
            <div className="text-center py-12 text-gray-500">
              <Inbox size={28} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No invite requests yet</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
