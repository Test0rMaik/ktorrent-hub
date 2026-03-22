import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Copy, UserPlus, Clock, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../../../../frontend/src/lib/api';
import { Button } from '../../../../../frontend/src/components/ui/Button';
import { Badge } from '../../../../../frontend/src/components/ui/Badge';
import { useAuthStore } from '../../../../../frontend/src/store/authStore';

const getMyInvites = () => api.get('/ext/invite-system/my-invites').then(r => r.data);
const requestMore  = () => api.post('/ext/invite-system/request').then(r => r.data);

export default function MyInvites() {
  const qc = useQueryClient();
  const isAuthed = useAuthStore(s => s.isAuthed);

  const { data, isLoading } = useQuery({
    queryKey: ['my-invites'],
    queryFn: getMyInvites,
    staleTime: 30_000,
    enabled: isAuthed,
  });

  const requestMut = useMutation({
    mutationFn: requestMore,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-invites'] });
      toast.success('Request submitted — waiting for admin approval');
    },
    onError: (err) => toast.error(err?.response?.data?.error || 'Request failed'),
  });

  const copyCode = code => {
    navigator.clipboard.writeText(code);
    toast.success('Copied to clipboard');
  };

  if (!isAuthed) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <p className="text-gray-400">Connect your wallet to view your invite codes.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <div className="h-8 w-48 bg-surface-50 rounded animate-pulse mb-6" />
        <div className="h-40 bg-surface-50 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!data?.enabled) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <UserPlus size={32} className="mx-auto mb-3 text-gray-600" />
        <p className="text-gray-400">Invite codes are not currently available.</p>
      </div>
    );
  }

  const allUsed = data.available === 0 && data.total > 0;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <UserPlus size={22} className="text-brand-400" /> My Invites
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Share these codes with friends to invite them to the tracker.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-surface-50 border border-white/8 rounded-xl p-4">
          <div className="text-2xl font-bold text-white">{data.total}</div>
          <div className="text-xs text-gray-500">Total</div>
        </div>
        <div className="bg-surface-50 border border-white/8 rounded-xl p-4">
          <div className="text-2xl font-bold text-green-400">{data.available}</div>
          <div className="text-xs text-gray-500">Available</div>
        </div>
        <div className="bg-surface-50 border border-white/8 rounded-xl p-4">
          <div className="text-2xl font-bold text-gray-400">{data.used}</div>
          <div className="text-xs text-gray-500">Used</div>
        </div>
      </div>

      {/* Invite codes */}
      <div className="bg-surface-50 border border-white/8 rounded-xl divide-y divide-white/5">
        {data.invites?.map(inv => (
          <div key={inv.code} className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3 min-w-0">
              {inv.used_by_wallet ? (
                <CheckCircle size={14} className="text-gray-600 flex-shrink-0" />
              ) : (
                <div className="w-3.5 h-3.5 rounded-full bg-green-500/20 border border-green-500/40 flex-shrink-0" />
              )}
              <span className={`font-mono text-sm ${inv.used_by_wallet ? 'text-gray-600 line-through' : 'text-white'}`}>
                {inv.code}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {inv.used_by_wallet ? (
                <span className="text-xs text-gray-600">
                  Used by {inv.used_by_username || (inv.used_by_wallet?.slice(0, 8) + '...')}
                </span>
              ) : (
                <button
                  onClick={() => copyCode(inv.code)}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs text-gray-400 hover:text-brand-400 hover:bg-brand-500/10 transition-colors"
                >
                  <Copy size={12} /> Copy
                </button>
              )}
            </div>
          </div>
        ))}
        {!data.invites?.length && (
          <p className="text-center py-8 text-gray-500 text-sm">No invite codes assigned yet.</p>
        )}
      </div>

      {/* Request more */}
      {allUsed && (
        <div className="bg-surface-50 border border-white/8 rounded-2xl p-6 text-center space-y-3">
          <Clock size={24} className="mx-auto text-gray-500" />
          <p className="text-sm text-gray-400">
            All your invite codes have been used. You can request more from the admin.
          </p>
          <Button
            size="sm"
            loading={requestMut.isPending}
            onClick={() => requestMut.mutate()}
          >
            Request More Invites
          </Button>
        </div>
      )}
    </div>
  );
}
