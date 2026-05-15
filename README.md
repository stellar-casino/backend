# Stellar Casino — Backend

Off-chain coordination layer for the [Stellar Casino](https://github.com/stellar-casino) decentralized gambling platform. Core gameplay runs on Soroban smart contracts; this service handles privileged admin operations, event indexing, real-time updates, and analytics APIs.

---

## What This Service Does

| Responsibility | Details |
|---|---|
| **Seed management** | Generates server seeds, commits SHA-256 hashes to the RNG contract before each round, reveals seeds post-round for public verification |
| **Bet resolution** | Signs and submits `resolve_bet` transactions to CoinFlip and Dice contracts using the admin keypair |
| **Event indexing** | Polls Soroban contract events every 5 s, persists bets/jackpots to PostgreSQL |
| **WebSocket server** | Broadcasts `bet_resolved` and `jackpot_won` events to connected frontends in real time |
| **REST API** | Leaderboard, player stats, bet history, jackpot history |

---

## Architecture

```
Stellar Network (Soroban contracts)
        │  events + tx results
        ▼
  ┌─────────────────────────────────────┐
  │           Backend (this repo)       │
  │                                     │
  │  SeedManager   →  RNG contract      │
  │  BetResolver   →  Game contracts    │
  │  EventIndexer  →  PostgreSQL        │
  │  WS Server     →  Frontend clients  │
  │  REST API      →  Frontend / tools  │
  └─────────────────────────────────────┘
```

The backend holds the **admin keypair** — the only account authorised to call `commit_seed`, `resolve_bet`, and `release_payout` on the contracts.

---

## Project Structure

```
src/
├── index.ts                  # Entry point — wires HTTP, WS, indexer
├── config.ts                 # Env var loader
├── stellar/
│   └── rpc.ts                # Soroban RPC wrapper (build / sign / send / events)
├── services/
│   ├── seedManager.ts        # Commit-reveal RNG lifecycle
│   └── betResolver.ts        # Resolve coinflip + dice bets
├── indexer/
│   └── eventIndexer.ts       # Soroban event poller → DB + WS broadcast
├── ws/
│   └── server.ts             # WebSocket broadcast server
├── api/
│   └── routes.ts             # Express REST routes
└── db/
    ├── pool.ts               # PostgreSQL connection pool
    └── migrate.ts            # Schema migration script
```

---

## Prerequisites

- Node.js 20+
- PostgreSQL 14+
- A deployed set of Soroban contracts (Treasury, RNG, CoinFlip, Dice)
- An admin Stellar keypair with authority over those contracts

---

## Setup

**1. Install dependencies**
```bash
npm install
```

**2. Configure environment**
```bash
cp .env.example .env
```

Fill in `.env`:

```env
ADMIN_SECRET_KEY=S...          # Admin Stellar secret key
TREASURY_CONTRACT_ID=C...
RNG_CONTRACT_ID=C...
COINFLIP_CONTRACT_ID=C...
DICE_CONTRACT_ID=C...

SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
NETWORK_PASSPHRASE="Test SDF Network ; September 2015"

DATABASE_URL=postgresql://postgres:postgres@localhost:5432/casino
PORT=3001
WS_PORT=3002
```

**3. Run database migrations**
```bash
npm run migrate
```

**4. Start the server**
```bash
# Development (ts-node)
npm run dev

# Production
npm run build && npm start
```

---

## API Reference

Base URL: `http://localhost:3001/api`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/api/leaderboard` | Top 20 players by total wagered |
| `GET` | `/api/players/:address` | Player profile + win/loss stats |
| `GET` | `/api/bets` | Bet history — query params: `address`, `game`, `limit` |
| `GET` | `/api/jackpots` | Last 10 jackpot events |

**Example:**
```bash
curl http://localhost:3001/api/players/GABC...XYZ
curl "http://localhost:3001/api/bets?address=GABC...XYZ&game=dice&limit=20"
```

---

## WebSocket

Connect to `ws://localhost:3002`. The server pushes events as JSON:

```jsonc
// Bet resolved
{ "type": "bet_resolved", "contract": "dice", "player": "G...", "won": true, "roll": 42, "ledger": 12345 }

// Jackpot won
{ "type": "jackpot_won", "winner": "G...", "amount": "5000.0000000", "ledger": 12346 }
```

---

## Game Flow (Dice Example)

```
1. Backend calls  rng.commit_seed(SHA256(server_seed))
2. Player calls   dice.place_bet(player, token, amount, prediction)   ← signed by player wallet
3. Player sends   client_seed  to backend
4. Backend calls  dice.resolve_bet(player, client_seed)               ← signed by admin keypair
5. Contract computes  roll = SHA256(ledger_seq || client_seed) % 100 + 1
6. If roll < prediction → payout transferred on-chain
7. Backend calls  rng.reveal_seed(server_seed)                        ← anyone can verify
8. EventIndexer picks up  bet_resolved  event → DB + WS broadcast
```

---

## Database Schema

```sql
players       — wallet_address, vip_level, total_wagered
bets          — game, amount, prediction, result, payout, won, client_seed, nonce
jackpots      — pool_size, winner, winning_ticket
indexer_state — last indexed ledger (prevents re-processing)
```

---

## Security Notes

- The `ADMIN_SECRET_KEY` must never be committed or exposed. Use a secrets manager in production.
- The admin keypair should be a dedicated account with no excess XLM balance beyond operational needs.
- All contract upgrade and treasury admin operations require a separate multisig setup (out of scope for this service).
- This service is a trusted intermediary — a compromised admin key can resolve bets arbitrarily. A future upgrade path is to move resolution fully on-chain via the RNG oracle model.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Runtime | Node.js 20 + TypeScript |
| Blockchain SDK | `@stellar/stellar-sdk` v12 |
| HTTP | Express 4 |
| WebSocket | `ws` |
| Database | PostgreSQL + `pg` |
| Build | `tsc` |
