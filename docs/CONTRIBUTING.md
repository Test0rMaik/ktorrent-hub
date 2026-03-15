# Contributing to KleverTorrentHub

Thank you for your interest! All contributions are welcome.

## Getting Started

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Make your changes
4. Run tests (see below)
5. Open a pull request

## Development Setup

See the [Setup Guide](SETUP.md) for full environment setup.

## Code Style

- **Backend**: ES modules (`type: "module"`), async/await, no TypeScript (keep it approachable)
- **Frontend**: Functional React components, hooks, no class components
- **Contracts**: Rust with klever-sc 0.45.0, doc comments on all public endpoints

## Running Tests

```bash
# Contract tests (Rust)
cd contracts && cargo test

# Backend — no test runner yet; PRs adding Jest/Vitest welcome!
```

## Feature Ideas

Open issues or PRs for:

- 🌍 **i18n** — multi-language support
- 📱 **Mobile app** — React Native client
- 🔌 **WebTorrent** — in-browser seeding/leeching
- 🏆 **Leaderboard** — top seeders by KTH earned
- 🗳️ **DAO governance** — token holders vote on categories and rules
- 🎴 **NFT badges** — proof-of-seed milestone NFTs
- 🔔 **Notifications** — new torrent in subscribed category

## Security Reports

Please report security vulnerabilities privately via GitHub's security advisory feature, **not** as public issues.
