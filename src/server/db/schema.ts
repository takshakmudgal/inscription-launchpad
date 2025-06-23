import { sql } from "drizzle-orm";
import {
  index,
  pgTableCreator,
  integer,
  varchar,
  text,
  timestamp,
  pgEnum,
  bigint,
} from "drizzle-orm/pg-core";

export const createTable = pgTableCreator((name) => `bitmemes_${name}`);

// Enums
export const voteTypeEnum = pgEnum("vote_type", ["up", "down"]);
export const proposalStatusEnum = pgEnum("proposal_status", [
  "active",
  "inscribed",
  "rejected",
]);

// Users table
export const users = createTable(
  "user",
  {
    id: integer().primaryKey().generatedByDefaultAsIdentity(),
    walletAddress: varchar("wallet_address", { length: 62 }), // Bitcoin addresses can be up to 62 chars
    twitterId: varchar("twitter_id", { length: 50 }),
    username: varchar("username", { length: 50 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (t) => [
    index("user_wallet_idx").on(t.walletAddress),
    index("user_twitter_idx").on(t.twitterId),
  ],
);

// Proposals table
export const proposals = createTable(
  "proposal",
  {
    id: integer().primaryKey().generatedByDefaultAsIdentity(),
    name: varchar("name", { length: 50 }).notNull(),
    ticker: varchar("ticker", { length: 10 }).notNull(),
    description: varchar("description", { length: 280 }).notNull(),
    website: text("website"),
    twitter: text("twitter"),
    telegram: text("telegram"),
    imageUrl: text("image_url").notNull(),
    bannerUrl: text("banner_url"),
    submittedBy: integer("submitted_by").references(() => users.id),
    votesUp: integer("votes_up").default(0).notNull(),
    votesDown: integer("votes_down").default(0).notNull(),
    totalVotes: integer("total_votes").default(0).notNull(),
    status: proposalStatusEnum("status").default("active").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (t) => [
    index("proposal_ticker_idx").on(t.ticker),
    index("proposal_status_idx").on(t.status),
    index("proposal_votes_idx").on(t.totalVotes),
    index("proposal_created_idx").on(t.createdAt),
  ],
);

// Votes table
export const votes = createTable(
  "vote",
  {
    id: integer().primaryKey().generatedByDefaultAsIdentity(),
    userId: integer("user_id")
      .references(() => users.id)
      .notNull(),
    proposalId: integer("proposal_id")
      .references(() => proposals.id)
      .notNull(),
    voteType: voteTypeEnum("vote_type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (t) => [
    index("vote_user_idx").on(t.userId),
    index("vote_proposal_idx").on(t.proposalId),
    index("vote_user_proposal_idx").on(t.userId, t.proposalId),
  ],
);

// Inscriptions table
export const inscriptions = createTable(
  "inscription",
  {
    id: integer().primaryKey().generatedByDefaultAsIdentity(),
    proposalId: integer("proposal_id")
      .references(() => proposals.id)
      .notNull(),
    blockHeight: integer("block_height").notNull(),
    blockHash: varchar("block_hash", { length: 64 }).notNull(),
    txid: varchar("txid", { length: 64 }).notNull(),
    inscriptionId: varchar("inscription_id", { length: 100 }),
    inscriptionUrl: text("inscription_url"),
    feeRate: integer("fee_rate"),
    totalFees: bigint("total_fees", { mode: "number" }),
    metadata: text("metadata"), // JSON string of the inscribed data
    // UniSat specific fields
    unisatOrderId: varchar("unisat_order_id", { length: 100 }), // UniSat order ID
    orderStatus: varchar("order_status", { length: 20 }), // pending, minted, sent, canceled
    paymentAddress: text("payment_address"), // UniSat payment address
    paymentAmount: bigint("payment_amount", { mode: "number" }), // Amount to pay in satoshis - using bigint for large values
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (t) => [
    index("inscription_block_idx").on(t.blockHeight),
    index("inscription_proposal_idx").on(t.proposalId),
    index("inscription_txid_idx").on(t.txid),
    index("inscription_unisat_order_idx").on(t.unisatOrderId),
  ],
);

// Block tracking table
export const blockTracker = createTable("block_tracker", {
  id: integer().primaryKey().generatedByDefaultAsIdentity(),
  lastProcessedBlock: integer("last_processed_block").notNull(),
  lastProcessedHash: varchar("last_processed_hash", { length: 64 }).notNull(),
  lastChecked: timestamp("last_checked", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});
