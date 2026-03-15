# Setup Guide

## Environment Variables Reference

### `backend/.env`

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `3000` | HTTP server port |
| `NODE_ENV` | No | `development` | `development` or `production` |
| `CORS_ORIGINS` | Yes | `http://localhost:5173` | Comma-separated allowed origins |
| `DB_TYPE` | No | `sqlite` | `sqlite` or `postgres` |
| `SQLITE_PATH` | No | `./data/kth.db` | Path to SQLite file |
| `PG_HOST` | Postgres only | `localhost` | PostgreSQL host |
| `PG_PORT` | Postgres only | `5432` | PostgreSQL port |
| `PG_DATABASE` | Postgres only | `kth` | Database name |
| `PG_USER` | Postgres only | `kth_user` | Database user |
| `PG_PASSWORD` | Postgres only | — | Database password |
| `AUTH_DOMAIN` | Yes | `localhost` | Shown in the sign-in challenge message |
| `KLEVER_NETWORK` | No | `testnet` | `mainnet`, `testnet`, or `devnet` |
| `OWNER_WALLET` | No | — | `klv1…` address that gains admin dashboard access |
| `REWARD_ADMIN_MNEMONIC` | Yes (rewards) | — | 24-word mnemonic of the reward admin wallet |
| `REWARD_ADMIN_PRIVATE_KEY` | Yes (rewards) | — | Alternative to mnemonic — private key as hex |
| `KTH_TOKEN_ID` | Yes (rewards) | `KTH-000000` | Token to reward (e.g. `FLIPPY-3FQ0` or `KLV`) |
| `REWARD_TOKEN_PRECISION` | No | `6` | Decimal places the token was created with |
| `REWARD_RATE_PER_HOUR` | No | `10000000` | Tokens per seeding hour in minimal units |
| `PEER_TTL` | No | `1800` | Seconds before inactive peer is removed |
| `MAX_TORRENT_SIZE` | No | `5242880` | Max .torrent upload in bytes |

### `frontend/.env`

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | No | API base URL, default `/api` |
| `VITE_APP_URL` | No | Your public frontend URL |
| `VITE_OWNER_WALLET` | No | Same `klv1…` address as `OWNER_WALLET` — shows Admin link in the navbar |

---

## Klever Wallet (Frontend)

The frontend uses the **Klever Browser Extension** for wallet connection.

- Install: https://klever.io/extension
- The extension injects `window.kleverWeb` into all pages

No WalletConnect project ID or external API keys are needed.

---

## Reward Token Setup (One-Time)

### Option A — Use native KLV (simplest)

Set `KTH_TOKEN_ID=KLV` and `REWARD_TOKEN_PRECISION=6`. The admin wallet sends KLV directly from its balance. No token creation needed.

Make sure the admin wallet has enough KLV to cover both rewards and transaction fees (~0.002 KLV per claim).

### Option B — Create your own KDA token

1. Open the Klever Extension or go to [KleverScan](https://kleverscan.org)
2. Go to **Assets → Create Asset**
3. Type: **Fungible**, choose your Ticker and Precision
4. Properties: enable `CanMint` (so the admin wallet can mint)
5. Submit the `CreateAsset` transaction
6. Note the assigned token ID (e.g. `FLIPPY-3FQ0`)
7. Set in `backend/.env`:
   ```
   KTH_TOKEN_ID=FLIPPY-3FQ0
   REWARD_TOKEN_PRECISION=0   # match the precision you chose
   ```
8. The wallet that created the token automatically has Mint rights.
   If you want a separate admin wallet to send rewards, grant it the Mint role via an `AssetTrigger(AddRole)` transaction on KleverScan.

### Reward rate

`REWARD_RATE_PER_HOUR` is in **minimal units** — multiply the whole-token amount by `10^precision`:

| Precision | To reward 10 tokens/h | Set |
|---|---|---|
| 6 | 10 × 10⁶ | `REWARD_RATE_PER_HOUR=10000000` |
| 2 | 10 × 10² | `REWARD_RATE_PER_HOUR=1000` |
| 0 | 10 × 10⁰ | `REWARD_RATE_PER_HOUR=10` |

---

## Choosing a Klever Network

| Network | Node URL | Explorer |
|---|---|---|
| Mainnet | https://node.mainnet.klever.org | https://kleverscan.org |
| Testnet | https://node.testnet.klever.org | https://testnet.kleverscan.org |
| Devnet  | https://node.devnet.klever.org  | https://devnet.kleverscan.org |

---

## Production Deployment (without Docker)

The `deploy/` directory contains ready-to-use configs for a standard Linux server.

### systemd service

Creates a persistent background service that auto-starts on boot and restarts on crash.

```bash
# Create a dedicated non-root user
sudo useradd -r -s /bin/false ktorrent

# Give it ownership of the app directory
sudo chown -R ktorrent:ktorrent /var/www/ktorrent-hub/backend/data
sudo chown -R ktorrent:ktorrent /var/www/ktorrent-hub/backend/uploads

# Install and start the service
sudo cp deploy/ktorrent-hub.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now ktorrent-hub

# View live logs
journalctl -u ktorrent-hub -f
```

Edit the `WorkingDirectory`, `EnvironmentFile`, and `ExecStart` paths in the service file to match your installation before copying.

### Nginx

```bash
# Install Nginx
sudo apt install nginx

# Copy and edit the vhost (replace yourdomain.com and paths)
sudo cp deploy/nginx.conf /etc/nginx/sites-available/ktorrent-hub
sudo nano /etc/nginx/sites-available/ktorrent-hub

# Enable it
sudo ln -s /etc/nginx/sites-available/ktorrent-hub /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Free TLS certificate (Let's Encrypt)
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

### Apache

```bash
# Install Apache and required modules
sudo apt install apache2
sudo a2enmod proxy proxy_http rewrite headers ssl

# Copy and edit the vhost
sudo cp deploy/apache.conf /etc/apache2/sites-available/ktorrent-hub.conf
sudo nano /etc/apache2/sites-available/ktorrent-hub.conf

# Enable it
sudo a2ensite ktorrent-hub
sudo apache2ctl configtest && sudo systemctl reload apache2

# Free TLS certificate (Let's Encrypt)
sudo apt install certbot python3-certbot-apache
sudo certbot --apache -d yourdomain.com
```

### Build the frontend

The web server serves the frontend as static files. Build once (and rebuild after updates):

```bash
cd /var/www/ktorrent-hub/frontend
npm ci
VITE_API_URL=/api VITE_OWNER_WALLET=klv1your_address npm run build
# Output is in frontend/dist/ — pointed to by DocumentRoot / root in the vhost
```

---

## Running Without Rewards

Leave `REWARD_ADMIN_MNEMONIC` / `REWARD_ADMIN_PRIVATE_KEY` unset in `backend/.env`. The tracker and website work fully — the rewards panel is hidden automatically.

---

## Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Set `AUTH_DOMAIN` to your actual domain
- [ ] Set `CORS_ORIGINS` to your actual frontend URL
- [ ] Set `OWNER_WALLET` (backend) and `VITE_OWNER_WALLET` (frontend) to your admin wallet address
- [ ] Use a **dedicated wallet** for `REWARD_ADMIN_MNEMONIC` / `REWARD_ADMIN_PRIVATE_KEY` (not your personal wallet)
- [ ] Configure `KTH_TOKEN_ID`, `REWARD_TOKEN_PRECISION`, and `REWARD_RATE_PER_HOUR`
- [ ] Set `KLEVER_NETWORK=mainnet`
- [ ] Deploy with Nginx or Apache using the configs in `deploy/` and obtain a TLS certificate
- [ ] Install `deploy/ktorrent-hub.service` so the backend starts on boot
- [ ] Place behind HTTPS
- [ ] Set up SQLite backups (`cp data/kth.db data/kth.db.bak`)
