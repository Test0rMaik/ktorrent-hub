import { Link } from 'react-router-dom';
import { Users, Download, Clock, Magnet } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { formatBytes } from '../../lib/api';
import { shortenKlvAddress } from '../../lib/klever';

const CATEGORY_ICONS = {
  movies: '🎬', tv: '📺', music: '🎵', games: '🎮',
  software: '💾', books: '📚', comics: '🗒️', anime: '⛩️',
  adult: '🔞', other: '📦',
};

export function TorrentCard({ torrent }) {
  const seedHealth = torrent.seeders > 5 ? 'green' : torrent.seeders > 0 ? 'amber' : 'red';

  return (
    <Link
      to={`/torrent/${torrent.id}`}
      className="group block bg-surface-50 border border-white/8 rounded-xl p-4 hover:border-brand-500/40 hover:bg-surface-100 transition-all duration-200 hover:shadow-lg hover:shadow-brand-900/20"
    >
      <div className="flex gap-3">
        {/* Category icon */}
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-surface-200 flex items-center justify-center text-xl">
          {CATEGORY_ICONS[torrent.category] || '📦'}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-medium text-white text-sm line-clamp-1 group-hover:text-brand-300 transition-colors">
              {torrent.name}
            </h3>
            <div className="flex items-center gap-1 flex-shrink-0">
              {torrent.isFreeleech && <Badge color="green">FL</Badge>}
              {torrent.isFeatured  && <Badge color="purple">★</Badge>}
            </div>
          </div>

          {torrent.description && (
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{torrent.description}</p>
          )}

          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full bg-${seedHealth === 'green' ? 'emerald' : seedHealth === 'amber' ? 'amber' : 'red'}-400`} />
              <span className="text-emerald-400 font-medium">{torrent.seeders}S</span>
              <span>·</span>
              <span className="text-red-400">{torrent.leechers}L</span>
            </span>
            <span className="flex items-center gap-1">
              <Download size={11} />
              {torrent.completed}
            </span>
            <span>{formatBytes(torrent.size)}</span>
            <span className="ml-auto truncate">
              {torrent.uploader_username || shortenKlvAddress(torrent.uploader_wallet)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
