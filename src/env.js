import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    BITCOIN_NETWORK: z.enum(["mainnet", "testnet"]).default("testnet"),
    ESPLORA_API_URL: z
      .string()
      .url()
      .default("https://blockstream.info/testnet/api"),
    ORDINALS_WALLET_PATH: z.string().optional(),
    INSCRIPTION_FEE_RATE: z.string().default("3"),
    ORDINALSBOT_API_KEY: z.string().optional(),
    CRON_SECRET: z.string().optional(),
    UNISAT_API: z.string().optional(),
    UNISAT_RECEIVE_ADDRESS: z.string().optional(),
    PLATFORM_WALLET_PRIVATE_KEY_WIF: z.string().optional(),
    PLATFORM_WALLET_PRIVATE_KEY_HEX: z.string().optional(),
    PLATFORM_WALLET_ADDRESS: z.string().optional(),
    ESPLORA_CLIENT_ID: z.string().optional(),
    ESPLORA_CLIENT_SECRET: z.string().optional(),
    HELIUS_RPC_URL: z.string().url(),
    SOLANA_PLATFORM_WALLET_PRIVATE_KEY: z.string(),
  },

  client: {
    NEXT_PUBLIC_BITCOIN_NETWORK: z
      .enum(["mainnet", "testnet"])
      .default("testnet"),
    NEXT_PUBLIC_ESPLORA_API_URL: z
      .string()
      .url()
      .default("https://blockstream.info/testnet/api"),
  },

  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    BITCOIN_NETWORK: process.env.BITCOIN_NETWORK,
    ESPLORA_API_URL: process.env.ESPLORA_API_URL,
    ORDINALS_WALLET_PATH: process.env.ORDINALS_WALLET_PATH,
    INSCRIPTION_FEE_RATE: process.env.INSCRIPTION_FEE_RATE,
    ORDINALSBOT_API_KEY: process.env.ORDINALSBOT_API_KEY,
    CRON_SECRET: process.env.CRON_SECRET,
    NEXT_PUBLIC_BITCOIN_NETWORK: process.env.NEXT_PUBLIC_BITCOIN_NETWORK,
    NEXT_PUBLIC_ESPLORA_API_URL: process.env.NEXT_PUBLIC_ESPLORA_API_URL,
    UNISAT_API: process.env.UNISAT_API,
    UNISAT_RECEIVE_ADDRESS: process.env.UNISAT_RECEIVE_ADDRESS,
    PLATFORM_WALLET_PRIVATE_KEY_WIF:
      process.env.PLATFORM_WALLET_PRIVATE_KEY_WIF,
    PLATFORM_WALLET_PRIVATE_KEY_HEX:
      process.env.PLATFORM_WALLET_PRIVATE_KEY_HEX,
    PLATFORM_WALLET_ADDRESS: process.env.PLATFORM_WALLET_ADDRESS,
    ESPLORA_CLIENT_ID: process.env.ESPLORA_CLIENT_ID,
    ESPLORA_CLIENT_SECRET: process.env.ESPLORA_CLIENT_SECRET,
    HELIUS_RPC_URL: process.env.HELIUS_RPC_URL,
    SOLANA_PLATFORM_WALLET_PRIVATE_KEY:
      process.env.SOLANA_PLATFORM_WALLET_PRIVATE_KEY,
  },

  skipValidation: !!process.env.SKIP_ENV_VALIDATION,

  emptyStringAsUndefined: true,
});
