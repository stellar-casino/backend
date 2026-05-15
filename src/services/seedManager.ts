import { createHash, randomBytes } from "crypto";
import { xdr } from "@stellar/stellar-sdk";
import { callContract } from "../stellar/rpc";
import { config } from "../config";

export class SeedManager {
  private serverSeed: string | null = null;

  /** Generate a new server seed and commit its SHA-256 hash to the RNG contract. */
  async commitSeed(): Promise<string> {
    this.serverSeed = randomBytes(32).toString("hex");
    const hash = createHash("sha256").update(this.serverSeed).digest();

    await callContract(config.contracts.rng, "commit_seed", [
      xdr.ScVal.scvBytes(hash),
    ]);

    console.log(`[SeedManager] Committed seed hash for seed: ${this.serverSeed.slice(0, 8)}...`);
    return this.serverSeed;
  }

  /** Reveal the server seed post-round so anyone can verify the outcome. */
  async revealSeed(): Promise<boolean> {
    if (!this.serverSeed) throw new Error("No active server seed to reveal");

    const result = await callContract(config.contracts.rng, "reveal_seed", [
      xdr.ScVal.scvBytes(Buffer.from(this.serverSeed, "hex")),
    ]);

    this.serverSeed = null;
    return result.switch().name === "scvBool" && result.b();
  }

  /** Compute the expected RNG result locally (for logging/verification). */
  static computeResult(serverSeed: string, clientSeed: string, nonce: bigint, range: number): number {
    const data = Buffer.concat([
      Buffer.from(serverSeed, "hex"),
      Buffer.from(clientSeed, "utf8"),
      Buffer.from(nonce.toString()),
    ]);
    const hash = createHash("sha256").update(data).digest();
    const value = hash.readBigUInt64BE(0);
    return Number(value % BigInt(range));
  }
}
