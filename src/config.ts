import "dotenv/config";

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

export const config = {
  network: (process.env.STELLAR_NETWORK ?? "testnet") as "testnet" | "mainnet",
  rpcUrl: process.env.SOROBAN_RPC_URL ?? "https://soroban-testnet.stellar.org",
  networkPassphrase:
    process.env.NETWORK_PASSPHRASE ?? "Test SDF Network ; September 2015",
  adminSecretKey: process.env.ADMIN_SECRET_KEY ?? "",
  contracts: {
    treasury: process.env.TREASURY_CONTRACT_ID ?? "",
    rng: process.env.RNG_CONTRACT_ID ?? "",
    coinflip: process.env.COINFLIP_CONTRACT_ID ?? "",
    dice: process.env.DICE_CONTRACT_ID ?? "",
  },
  databaseUrl: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/casino",
  port: parseInt(process.env.PORT ?? "3001", 10),
  wsPort: parseInt(process.env.WS_PORT ?? "3002", 10),
};
