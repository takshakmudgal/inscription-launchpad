import { sql } from "drizzle-orm";
import { index, pgTableCreator } from "drizzle-orm/pg-core";

export const createTable = pgTableCreator((name) => `bitmemes_${name}`);

export const users = createTable(
  "user",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    wallet_address: d.varchar({ length: 44 }),
    createdAt: d
      .timestamp({ withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  }),
  (t) => [index("address_idx").on(t.wallet_address)],
);

export const proposals = createTable(
  "proposal",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    coin_name: d.varchar({ length: 20 }).notNull(),
    ticker: d.varchar({ length: 4 }).notNull(),
    description: d.varchar({ length: 160 }).notNull(),
    website: d.text(),
    x: d.text(),
    telegra: d.text(),
    coin_image: d.text().notNull(),
    coin_banner: d.text(),
  }),
  (t) => [index("coin_idx").on(t.coin_name)],
);
