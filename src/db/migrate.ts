import { db } from "./pool";

const SQL = `
CREATE TABLE IF NOT EXISTS players (
  id            SERIAL PRIMARY KEY,
  wallet_address VARCHAR(64) UNIQUE NOT NULL,
  vip_level     INT NOT NULL DEFAULT 0,
  total_wagered NUMERIC(20,7) NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bets (
  id            SERIAL PRIMARY KEY,
  player_id     INT NOT NULL REFERENCES players(id),
  game          VARCHAR(16) NOT NULL,
  amount        NUMERIC(20,7) NOT NULL,
  prediction    INT,
  result        INT,
  payout        NUMERIC(20,7),
  client_seed   VARCHAR(128),
  nonce         BIGINT,
  won           BOOLEAN,
  tx_hash       VARCHAR(128),
  ledger        INT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS jackpots (
  id             SERIAL PRIMARY KEY,
  pool_size      NUMERIC(20,7) NOT NULL DEFAULT 0,
  winner_id      INT REFERENCES players(id),
  winning_ticket VARCHAR(128),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS indexer_state (
  id            INT PRIMARY KEY DEFAULT 1,
  last_ledger   INT NOT NULL DEFAULT 0
);

INSERT INTO indexer_state (id, last_ledger) VALUES (1, 0)
  ON CONFLICT (id) DO NOTHING;
`;

async function migrate() {
  console.log("Running migrations...");
  await db.query(SQL);
  console.log("Migrations complete.");
  await db.end();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
