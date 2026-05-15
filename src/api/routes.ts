import { Router, Request, Response } from "express";
import { db } from "../db/pool";

export const router = Router();

// GET /api/leaderboard — top 20 players by total_wagered
router.get("/leaderboard", async (_req: Request, res: Response) => {
  try {
    const result = await db.query(
      `SELECT wallet_address, vip_level, total_wagered
       FROM players
       ORDER BY total_wagered DESC
       LIMIT 20`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "DB error" });
  }
});

// GET /api/players/:address — player stats
router.get("/players/:address", async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    const playerRes = await db.query(
      `SELECT id, wallet_address, vip_level, total_wagered, created_at
       FROM players WHERE wallet_address = $1`,
      [address]
    );
    if (!playerRes.rows.length) {
      res.status(404).json({ error: "Player not found" });
      return;
    }
    const player = playerRes.rows[0];

    const statsRes = await db.query(
      `SELECT
         COUNT(*) AS total_bets,
         COUNT(*) FILTER (WHERE won = true) AS wins,
         COUNT(*) FILTER (WHERE won = false) AS losses,
         COALESCE(SUM(payout), 0) AS total_payout
       FROM bets WHERE player_id = $1`,
      [player.id]
    );
    res.json({ ...player, stats: statsRes.rows[0] });
  } catch (err) {
    res.status(500).json({ error: "DB error" });
  }
});

// GET /api/bets?address=&game=&limit= — bet history
router.get("/bets", async (req: Request, res: Response) => {
  try {
    const { address, game, limit = "50" } = req.query as Record<string, string>;
    const params: unknown[] = [Math.min(parseInt(limit, 10), 200)];
    let where = "";

    if (address) {
      params.push(address);
      where += ` AND p.wallet_address = $${params.length}`;
    }
    if (game) {
      params.push(game);
      where += ` AND b.game = $${params.length}`;
    }

    const result = await db.query(
      `SELECT b.id, p.wallet_address, b.game, b.amount, b.prediction,
              b.result, b.payout, b.won, b.nonce, b.created_at
       FROM bets b JOIN players p ON p.id = b.player_id
       WHERE 1=1 ${where}
       ORDER BY b.created_at DESC
       LIMIT $1`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "DB error" });
  }
});

// GET /api/jackpots — recent jackpot history
router.get("/jackpots", async (_req: Request, res: Response) => {
  try {
    const result = await db.query(
      `SELECT j.id, j.pool_size, p.wallet_address AS winner, j.created_at
       FROM jackpots j LEFT JOIN players p ON p.id = j.winner_id
       ORDER BY j.created_at DESC LIMIT 10`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "DB error" });
  }
});
