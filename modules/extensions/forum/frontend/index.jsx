import ForumHome from './pages/ForumHome';
import ForumThread from './pages/ForumThread';
import ForumNewThread from './pages/ForumNewThread';
import ForumAdmin from './pages/ForumAdmin';

export default {
  id: 'forum',
  name: 'Forum',
  description: 'Community discussion forum with categories, threads, and posts',
  routes: [
    { path: '/forum',            element: <ForumHome /> },
    { path: '/forum/thread/:id', element: <ForumThread /> },
    { path: '/forum/new',        element: <ForumNewThread /> },
  ],
  navItems: [
    { to: '/forum', label: 'Forum' },
  ],
  adminPanel: ForumAdmin,
};
