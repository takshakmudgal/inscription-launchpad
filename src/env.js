import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
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
    INSCRIPTION_FEE_RATE: z.string().default("15"),
    ORDINALSBOT_API_KEY: z.string().optional(),
    CRON_SECRET: z.string().optional(),
    UNISAT_API: z.string().optional(),
    UNISAT_RECEIVE_ADDRESS: z.string().optional(),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    NEXT_PUBLIC_BITCOIN_NETWORK: z
      .enum(["mainnet", "testnet"])
      .default("testnet"),
    NEXT_PUBLIC_ESPLORA_API_URL: z
      .string()
      .url()
      .default("https://blockstream.info/testnet/api"),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
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
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});
