import 'dotenv/config';

/**
 * Central configuration object loaded from environment variables.
 * All config values live here — never read process.env directly in app code.
 */
export const config = {
  port:    parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev:   (process.env.NODE_ENV || 'development') === 'development',

  cors: {
    origins: (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',').map(s => s.trim()),
  },

  db: {
    type: process.env.DB_TYPE || 'sqlite',
    sqlite: {
      path: process.env.SQLITE_PATH || './data/kth.db',
    },
    postgres: {
      host:     process.env.PG_HOST     || 'localhost',
      port:     parseInt(process.env.PG_PORT || '5432', 10),
      database: process.env.PG_DATABASE || 'kth',
      user:     process.env.PG_USER     || 'kth_user',
      password: process.env.PG_PASSWORD || '',
    },
  },

  auth: {
    domain: process.env.AUTH_DOMAIN || 'localhost',
  },

  // Owner wallet address (klv1...) — grants access to the admin dashboard.
  // Set this to YOUR Klever wallet address. Keep it secret-free: it's just
  // an address, not a key. Anyone who knows it still needs to sign in with
  // the matching wallet to gain admin access.
  ownerWallet: (process.env.OWNER_WALLET || '').toLowerCase(),

  klever: {
    network: process.env.KLEVER_NETWORK || 'testnet',
    // Node: used for broadcasting transactions
    nodeUrl: {
      mainnet: 'https://node.mainnet.klever.org',
      testnet: 'https://node.testnet.klever.org',
      devnet:  'https://node.devnet.klever.org',
    }[process.env.KLEVER_NETWORK || 'testnet'],
    // API: used for account/balance queries
    apiUrl: {
      mainnet: 'https://api.mainnet.klever.org',
      testnet: 'https://api.testnet.klever.org',
      devnet:  'https://api.devnet.klever.org',
    }[process.env.KLEVER_NETWORK || 'testnet'],
  },

  rewards: {
    // Accept either a 24-word mnemonic or a private key hex — SDK handles both
    adminMnemonic: process.env.REWARD_ADMIN_MNEMONIC || process.env.REWARD_ADMIN_PRIVATE_KEY || '',
    tokenId:        process.env.KTH_TOKEN_ID            || 'KTH-000000',
    // Number of decimal places the token was created with (0 = no decimals, 6 = like KLV).
    tokenPrecision: parseInt(process.env.REWARD_TOKEN_PRECISION || '6', 10),
    // Set to true if the admin wallet owns the KDA token and should mint new supply.
    // false (default) = Transfer from admin wallet balance (works for any token incl. KLV).
    useMint:        process.env.REWARD_USE_MINT === 'true',
    // Reward tokens per seeding hour, in minimal units (10^precision per whole token).
    ratePerHour:    parseInt(process.env.REWARD_RATE_PER_HOUR || '10000000', 10),
  },

  tracker: {
    peerCleanupInterval: parseInt(process.env.PEER_CLEANUP_INTERVAL || '60000', 10),
    peerTtl:             parseInt(process.env.PEER_TTL || '1800', 10),
  },

  upload: {
    maxSize: parseInt(process.env.MAX_TORRENT_SIZE || '5242880', 10),
    dir:     process.env.UPLOAD_DIR || './uploads',
  },

};

/**
 * Master list of all possible categories.
 * The admin dashboard controls which subset is *enabled*.
 * This list never changes without a code update — only visibility is toggled.
 */
export const ALL_CATEGORIES = [
  { id: 'movies',   label: 'Movies',   icon: '🎬' },
  { id: 'tv',       label: 'TV Shows', icon: '📺' },
  { id: 'music',    label: 'Music',    icon: '🎵' },
  { id: 'games',    label: 'Games',    icon: '🎮' },
  { id: 'software', label: 'Software', icon: '💾' },
  { id: 'books',    label: 'Books',    icon: '📚' },
  { id: 'comics',   label: 'Comics',   icon: '🗒️' },
  { id: 'anime',    label: 'Anime',    icon: '⛩️' },
  { id: 'other',    label: 'Other',    icon: '📦' },
  { id: 'adult',    label: 'Adult',    icon: '🔞' },
];

// Default enabled categories (used before DB is loaded / on first run).
// Adult is off by default — admin must explicitly enable it.
export const DEFAULT_ENABLED_CATEGORIES = [
  'movies', 'tv', 'music', 'games', 'software', 'books', 'comics', 'anime', 'other',
];
