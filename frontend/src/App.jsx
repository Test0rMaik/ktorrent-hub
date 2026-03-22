import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { Toaster }  from 'react-hot-toast';
import { useEffect } from 'react';

import { useThemeStore } from './store/themeStore';
import { useAuthStore }  from './store/authStore';
import { Header }        from './components/layout/Header';
import { getEnabledExtensions } from './lib/extensions';
import { getSiteSettings, api } from './lib/api';
import './lib/themes';   // side-effect: imports theme CSS

import Home              from './pages/Home';
import Browse            from './pages/Browse';
import TorrentDetail     from './pages/TorrentDetail';
import Dashboard         from './pages/Dashboard';
import Submit            from './pages/Submit';
import Admin             from './pages/Admin';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry:               1,
      staleTime:           30_000,
      refetchOnWindowFocus: false,
    },
  },
});

const getLandingPageContent = () => api.get('/ext/landing-page/content').then(r => r.data);

function AppInner() {
  const { initTheme, setColorTheme } = useThemeStore();
  const isAuthed = useAuthStore(s => s.isAuthed);
  const { data: site } = useQuery({ queryKey: ['site'], queryFn: getSiteSettings, staleTime: 5 * 60_000 });

  useEffect(() => initTheme(), []);

  // Apply server-side theme selection
  useEffect(() => {
    if (site?.activeTheme) setColorTheme(site.activeTheme);
  }, [site?.activeTheme]);

  const enabledExtensions = getEnabledExtensions(site?.enabledExtensions || []);
  const landingPageEnabled = enabledExtensions.some(e => e.id === 'landing-page');

  // Fetch landing page settings to check if gating is active
  const { data: landingData } = useQuery({
    queryKey: ['landing-page-content'],
    queryFn: getLandingPageContent,
    staleTime: 5 * 60_000,
    enabled: landingPageEnabled,
  });

  // Landing page gates access when: extension enabled + landing page enabled + requireLogin + not authed
  const shouldGate = landingPageEnabled && landingData?.enabled && landingData?.requireLogin && !isAuthed;

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <div className="min-h-screen bg-surface text-white transition-colors">
        <Header enabledExtensions={enabledExtensions} />
        <main>
          <Routes>
            {/* Extension routes — always mounted so /welcome is available */}
            {enabledExtensions.flatMap(ext =>
              ext.routes.map(r => (
                <Route key={`${ext.id}-${r.path}`} path={r.path} element={r.element} />
              ))
            )}

            {shouldGate ? (
              /* All non-admin routes redirect to the landing page */
              <>
                <Route path="/admin" element={<Admin />} />
                <Route path="*" element={<Navigate to="/welcome" replace />} />
              </>
            ) : (
              /* Normal routes */
              <>
                <Route path="/"            element={<Home />}          />
                <Route path="/browse"      element={<Browse />}        />
                <Route path="/torrent/:id" element={<TorrentDetail />} />
                <Route path="/dashboard"   element={<Dashboard />}     />
                <Route path="/submit"      element={<Submit />}        />
                <Route path="/admin"       element={<Admin />}         />
                <Route path="*" element={
                  <div className="text-center py-32">
                    <p className="text-6xl mb-4">404</p>
                    <p className="text-gray-400">Page not found</p>
                  </div>
                } />
              </>
            )}
          </Routes>
        </main>
      </div>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: { background: '#1e1e28', color: '#f1f5f9', border: '1px solid rgba(255,255,255,0.1)' },
        }}
      />
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppInner />
    </QueryClientProvider>
  );
}
