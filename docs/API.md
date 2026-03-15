# API Reference

Base URL: `http://localhost:3000`
Authentication: `Authorization: Bearer <session_token>`

All addresses are Klever format: `klv1...` (bech32 Ed25519).

---

## Auth

### `GET /api/auth/nonce?wallet=klv1...`
Returns a one-time challenge message and nonce.

**Response:**
```json
{
  "nonce":   "a1b2c3d4e5f6",
  "message": "KleverTorrentHub sign-in\n\nAddress: klv1...\nNonce: a1b2c3d4e5f6\nDomain: localhost"
}
```

### `POST /api/auth/verify`
Verify a Klever Ed25519 signature and get a session token.

**Body:**
```json
{
  "wallet":    "klv1...",
  "nonce":     "a1b2c3d4e5f6",
  "signature": "hex-encoded-64-byte-ed25519-signature"
}
```

**Response:**
```json
{
  "token":     "uuid-session-id",
  "expiresAt": "2026-03-22T...",
  "user": { "id": "...", "wallet": "klv1...", "username": null }
}
```

**Frontend signing (Klever Extension):**
```javascript
const { message, nonce } = await fetchNonce(address);
const signature = await window.kleverWeb.signMessage(message);
await verifyAuth({ wallet: address, nonce, signature });
```

### `POST /api/auth/logout`
Invalidates the current session. Requires `Authorization` header.

---

## Torrents

### `GET /api/torrents`
Browse/search torrents.

**Query params:** `page`, `limit`, `category`, `q`, `sort`, `order`

### `GET /api/torrents/:id`
Get full torrent details including file list and comments.

### `POST /api/torrents` 🔒
Submit a new torrent. `multipart/form-data`.

### `PATCH /api/torrents/:id` 🔒
Update your torrent.

### `DELETE /api/torrents/:id` 🔒
Soft-delete your torrent.

### `POST /api/torrents/:id/comments` 🔒
Post a comment.

### `POST /api/torrents/:id/bookmark` 🔒
Toggle bookmark.

---

## Users

### `GET /api/users/me` 🔒
Full profile + torrents + bookmarks + reward history.

### `PATCH /api/users/me` 🔒
Update `username` and/or `bio`.

### `GET /api/users/:wallet`
Public profile by `klv1...` address.

---

## Rewards

### `GET /api/rewards/pending` 🔒
Pending (unclaimed) KTH amount.

**Response:**
```json
{ "amount": 10000000, "amountKth": "10.000000", "tokenId": "KTH-A1B2C3" }
```

### `POST /api/rewards/claim` 🔒
Backend mints KTH tokens directly to your `klv1...` wallet.
No frontend transaction needed.

**Response:**
```json
{ "id": "...", "amount": 10000000, "amountKth": "10.000000", "txHash": "abc123..." }
```

### `POST /api/rewards/register-peer` 🔒
Link your BitTorrent peer_id to your wallet for reward tracking.

**Body:** `{ "peerId": "...", "infoHash": "..." }`

### `GET /api/rewards/history` 🔒
Your claim history with Klever transaction hashes.

### `GET /api/rewards/balance` 🔒
Live on-chain KTH balance from Klever node API.

---

## Meta

### `GET /api/meta/categories`
### `GET /api/meta/stats`
### `GET /api/meta/rss?category=movies`

---

## BitTorrent Tracker

### `GET /announce`
Standard HTTP tracker announce.

### `GET /scrape`
Standard scrape endpoint.

**Tracker URL:**
```
http://your-domain.com/announce
```
