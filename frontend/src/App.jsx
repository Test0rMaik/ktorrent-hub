import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster }  from 'react-hot-toast';
import { useEffect } from 'react';

import { useThemeStore } from './store/themeStore';
import { Header }        from './components/layout/Header';
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

function AppInner() {
  const { initTheme } = useThemeStore();
  useEffect(() => initTheme(), []);

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <div className="min-h-screen bg-surface text-white transition-colors">
        <Header />
        <main>
          <Routes>
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
