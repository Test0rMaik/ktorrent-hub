import InviteAdmin from './pages/InviteAdmin';
import MyInvites from './pages/MyInvites';

export default {
  id: 'invite-system',
  name: 'Invite System',
  description: 'Require invite codes for new user registration',
  routes: [
    { path: '/invites', element: <MyInvites /> },
  ],
  navItems: [],
  adminPanel: InviteAdmin,
};
