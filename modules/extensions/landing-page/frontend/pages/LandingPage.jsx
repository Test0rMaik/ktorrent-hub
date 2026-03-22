import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { api } from '../../../../../frontend/src/lib/api';
import { Button } from '../../../../../frontend/src/components/ui/Button';
import { useAuthStore } from '../../../../../frontend/src/store/authStore';
import { renderContent } from '../renderContent';

const getContent = () => api.get('/ext/landing-page/content').then(r => r.data);

export default function LandingPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['landing-page-content'],
    queryFn: getContent,
    staleTime: 60_000,
  });
  const isAuthed = useAuthStore(s => s.isAuthed);

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20">
        <div className="h-8 w-48 bg-surface-50 rounded animate-pulse mb-6" />
        <div className="space-y-3">
          <div className="h-4 bg-surface-50 rounded animate-pulse" />
          <div className="h-4 bg-surface-50 rounded animate-pulse w-3/4" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      {/* Title */}
      <h1 className="text-4xl sm:text-5xl font-bold text-white mb-8">
        {data?.title || 'Welcome'}
      </h1>

      {/* Content */}
      <div className="prose-custom">
        {renderContent(data?.content)}
      </div>

      {/* CTA */}
      <div className="mt-12 pt-8 border-t border-white/10 flex items-center gap-4">
        {data?.requireLogin && !isAuthed ? (
          <div className="text-center w-full space-y-3">
            <p className="text-gray-400">Connect your wallet to continue to the tracker.</p>
            <div className="flex justify-center">
              <Button size="lg" variant="primary">
                <LogIn size={16} /> Connect Wallet to Enter
              </Button>
            </div>
          </div>
        ) : (
          <Link to="/browse">
            <Button size="lg" variant="primary">
              Enter the Tracker
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}
