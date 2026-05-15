import { getEvents, getLatestLedger, scValToNative } from "../stellar/rpc";
import { config } from "../config";
import { db } from "../db/pool";
import { broadcast } from "../ws/server";

const POLL_INTERVAL_MS = 5000;
const CONTRACT_IDS = [
  config.contracts.treasury,
  config.contracts.rng,
  config.contracts.coinflip,
  config.contracts.dice,
].filter(Boolean);

async function getLastLedger(): Promise<number> {
  const res = await db.query("SELECT last_ledger FROM indexer_state WHERE id = 1");
  return res.rows[0]?.last_ledger ?? 0;
}

async function setLastLedger(ledger: number) {
  await db.query("UPDATE indexer_state SET last_ledger = $1 WHERE id = 1", [ledger]);
}

async function processEvent(event: any) {
  const topics = event.topic.map((t: any) => scValToNative(t));
  const value = scValToNative(event.value);
  const [contract, eventName] = topics;

  console.log(`[Indexer] ${contract}:${eventName}`, value);

  if (eventName === "bet_resolved") {
    const [player, won, roll] = Array.isArray(value) ? value : [value];
    broadcast({ type: "bet_resolved", contract, player, won, roll, ledger: event.ledger });

    // Update total_wagered for player
    await db.query(
      `UPDATE bets SET won = $1, result = $2
       WHERE player_id = (SELECT id FROM players WHERE wallet_address = $3)
         AND game = $4
       ORDER BY created_at DESC LIMIT 1`,
      [won, roll ?? null, player, contract]
    ).catch(() => {});
  }

  if (eventName === "jackpot_won") {
    const [winner, amount] = Array.isArray(value) ? value : [value];
    broadcast({ type: "jackpot_won", winner, amount, ledger: event.ledger });
  }
}

export async function startIndexer() {
  if (CONTRACT_IDS.length === 0) {
    console.warn("[Indexer] No contract IDs configured — skipping.");
    return;
  }

  console.log("[Indexer] Starting event indexer...");

  const poll = async () => {
    try {
      const lastLedger = await getLastLedger();
      const latestLedger = await getLatestLedger();
      const fromLedger = lastLedger > 0 ? lastLedger + 1 : latestLedger;

      if (fromLedger > latestLedger) return;

      const events = await getEvents(CONTRACT_IDS, fromLedger);
      for (const event of events) {
        await processEvent(event);
      }

      await setLastLedger(latestLedger);
    } catch (err) {
      console.error("[Indexer] Poll error:", err);
    }
  };

  await poll();
  setInterval(poll, POLL_INTERVAL_MS);
}
