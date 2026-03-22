import LandingPage from './pages/LandingPage';
import LandingPageAdmin from './pages/LandingPageAdmin';

export default {
  id: 'landing-page',
  name: 'Landing Page',
  description: 'Show a customisable landing page before users can access the tracker',
  routes: [
    { path: '/welcome', element: <LandingPage /> },
  ],
  navItems: [],  // no nav item — the landing page gates access, not a menu link
  adminPanel: LandingPageAdmin,
};
