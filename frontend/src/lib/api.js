import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({ baseURL: BASE_URL });

// Attach session token to every request
api.interceptors.request.use(cfg => {
  const token = useAuthStore.getState().token;
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// Auto-logout on 401
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) useAuthStore.getState().logout();
    return Promise.reject(err);
  },
);

// ── Auth ────────────────────────────────────────────────────
export const fetchNonce  = wallet  => api.get('/auth/nonce', { params: { wallet } }).then(r => r.data);
export const verifyAuth  = payload => api.post('/auth/verify', payload).then(r => r.data);
export const logout      = ()      => api.post('/auth/logout');

// ── Torrents ────────────────────────────────────────────────
export const getTorrents    = params      => api.get('/torrents', { params }).then(r => r.data);
export const getTorrent     = id          => api.get(`/torrents/${id}`).then(r => r.data);
export const createTorrent  = formData    => api.post('/torrents', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data);
export const updateTorrent  = (id, data)  => api.patch(`/torrents/${id}`, data).then(r => r.data);
export const deleteTorrent  = id          => api.delete(`/torrents/${id}`).then(r => r.data);
export const addComment     = (id, body)  => api.post(`/torrents/${id}/comments`, { body }).then(r => r.data);
export const toggleBookmark = id          => api.post(`/torrents/${id}/bookmark`).then(r => r.data);

// ── Users ───────────────────────────────────────────────────
export const getMe           = ()      => api.get('/users/me').then(r => r.data);
export const getMyPasskey    = ()      => api.get('/users/me/passkey').then(r => r.data);
export const updateMe        = data    => api.patch('/users/me', data).then(r => r.data);
export const getUserByWallet = wallet  => api.get(`/users/${wallet}`).then(r => r.data);

// ── Rewards ─────────────────────────────────────────────────
export const getPendingRewards = ()                 => api.get('/rewards/pending').then(r => r.data);
export const claimRewards      = ()                 => api.post('/rewards/claim').then(r => r.data);
export const registerPeer      = (peerId, infoHash) => api.post('/rewards/register-peer', { peerId, infoHash }).then(r => r.data);
export const getRewardHistory  = ()                 => api.get('/rewards/history').then(r => r.data);
export const getOnChainBalance = ()                 => api.get('/rewards/balance').then(r => r.data);

// ── Meta ────────────────────────────────────────────────────
export const getCategories = () => api.get('/meta/categories').then(r => r.data);
export const getStats      = () => api.get('/meta/stats').then(r => r.data);
export const getSiteSettings = () => api.get('/meta/site').then(r => r.data);

// ── Admin ───────────────────────────────────────────────────
export const adminGetSettings      = ()           => api.get('/admin/settings').then(r => r.data);
export const adminPatchSettings    = data         => api.patch('/admin/settings', data).then(r => r.data);
export const adminUploadLogo       = formData     => api.post('/admin/logo', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data);
export const adminDeleteLogo       = ()           => api.delete('/admin/logo').then(r => r.data);
export const adminGetStats         = ()           => api.get('/admin/stats').then(r => r.data);
export const adminGetRewardWallet  = ()           => api.get('/admin/reward-wallet').then(r => r.data);
export const adminGetTorrents      = params       => api.get('/admin/torrents', { params }).then(r => r.data);
export const adminPatchTorrent     = (id, data)   => api.patch(`/admin/torrents/${id}`, data).then(r => r.data);
export const adminGetUsers         = params       => api.get('/admin/users', { params }).then(r => r.data);
export const adminBanUser          = (wallet, reason) => api.post(`/admin/users/${wallet}/ban`, { reason }).then(r => r.data);
export const adminUnbanUser        = wallet       => api.delete(`/admin/users/${wallet}/ban`).then(r => r.data);
export const adminGetBans          = ()           => api.get('/admin/bans').then(r => r.data);

// ── Extensions (generic) ─────────────────────────────────────
// Extension-specific API calls live inside each extension's frontend.
// This is a convenience for the admin panel to manage extension state.

// ── Helpers ─────────────────────────────────────────────────
export function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k     = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i     = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
