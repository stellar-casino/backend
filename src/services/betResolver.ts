import { Address, xdr, nativeToScVal } from "@stellar/stellar-sdk";
import { callContract, scValToNative } from "../stellar/rpc";
import { config } from "../config";
import { db } from "../db/pool";

export class BetResolver {
  /** Resolve a coinflip bet. Returns true if player won. */
  async resolveCoinflip(playerAddress: string, clientSeed: string): Promise<boolean> {
    const result = await callContract(config.contracts.coinflip, "resolve_bet", [
      new Address(playerAddress).toScVal(),
      xdr.ScVal.scvBytes(Buffer.from(clientSeed, "utf8")),
    ]);
    const won = scValToNative(result) as boolean;
    await this.persistResult(playerAddress, "coinflip", won);
    return won;
  }

  /** Resolve a dice bet. Returns the roll value (1–100). */
  async resolveDice(playerAddress: string, clientSeed: string): Promise<number> {
    const result = await callContract(config.contracts.dice, "resolve_bet", [
      new Address(playerAddress).toScVal(),
      xdr.ScVal.scvBytes(Buffer.from(clientSeed, "utf8")),
    ]);
    const roll = scValToNative(result) as number;
    await this.persistResult(playerAddress, "dice", undefined, roll);
    return roll;
  }

  private async persistResult(
    walletAddress: string,
    game: string,
    won?: boolean,
    roll?: number
  ) {
    try {
      const playerRes = await db.query(
        `INSERT INTO players (wallet_address) VALUES ($1)
         ON CONFLICT (wallet_address) DO UPDATE SET wallet_address = EXCLUDED.wallet_address
         RETURNING id`,
        [walletAddress]
      );
      const playerId = playerRes.rows[0].id;

      await db.query(
        `INSERT INTO bets (player_id, game, amount, result, won)
         VALUES ($1, $2, 0, $3, $4)`,
        [playerId, game, roll ?? null, won ?? null]
      );
    } catch (err) {
      console.error("[BetResolver] DB persist error:", err);
    }
  }
}
