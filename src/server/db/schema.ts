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
  serial,
} from "drizzle-orm/pg-core";

export const createTable = pgTableCreator((name) => `bitmemes_${name}`);

export const voteTypeEnum = pgEnum("vote_type", ["up", "down"]);
export const proposalStatusEnum = pgEnum("proposal_status", [
  "active",
  "leader",
  "inscribing",
  "inscribed",
  "rejected",
  "expired",
]);

export const users = createTable(
  "user",
  {
    id: integer().primaryKey().generatedByDefaultAsIdentity(),
    walletAddress: varchar("wallet_address", { length: 62 }),
    twitterId: varchar("twitter_id", { length: 50 }),
    username: varchar("username", { length: 50 }),
    email: varchar("email", { length: 255 }),
    twitter: varchar("twitter", { length: 50 }),
    telegram: varchar("telegram", { length: 50 }),
    bio: text("bio"),
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
    index("user_username_idx").on(t.username),
    index("user_email_idx").on(t.email),
  ],
);

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
    firstTimeAsLeader: timestamp("first_time_as_leader", {
      withTimezone: true,
    }),
    leaderStartBlock: integer("leader_start_block"),
    leaderboardMinBlocks: integer("leaderboard_min_blocks")
      .default(2)
      .notNull(),
    expirationBlock: integer("expiration_block"),
    creationBlock: integer("creation_block"),
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
    index("proposal_leader_time_idx").on(t.firstTimeAsLeader),
    index("proposal_expiration_idx").on(t.expirationBlock),
  ],
);

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
    metadata: text("metadata"),
    unisatOrderId: varchar("unisat_order_id", { length: 100 }),
    orderStatus: varchar("order_status", { length: 50 }),
    paymentAddress: text("payment_address"),
    paymentAmount: bigint("payment_amount", { mode: "number" }),
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

export const pumpFunTokens = createTable(
  "pump_fun_tokens",
  {
    id: serial("id").primaryKey(),
    proposalId: integer("proposal_id")
      .notNull()
      .references(() => proposals.id),
    mintAddress: text("mint_address").notNull().unique(),
    transactionSignature: text("transaction_signature").notNull().unique(),
    metadataUri: text("metadata_uri").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("pump_fun_tokens_proposal_idx").on(t.proposalId),
    index("pump_fun_tokens_mint_address_idx").on(t.mintAddress),
    index("pump_fun_tokens_transaction_signature_idx").on(
      t.transactionSignature,
    ),
  ],
);

export const blockTracker = createTable(
  "block_tracker",
  {
    id: integer().primaryKey().generatedByDefaultAsIdentity(),
    lastProcessedBlock: integer("last_processed_block").notNull(),
    lastProcessedHash: varchar("last_processed_hash", { length: 64 }),
    consecutiveBlocksWithoutLaunches: integer(
      "consecutive_blocks_without_launches",
    )
      .default(0)
      .notNull(),
    lastLaunchBlock: integer("last_launch_block"),
    lastChecked: timestamp("last_checked", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (t) => [
    index("block_tracker_block_idx").on(t.lastProcessedBlock),
    index("block_tracker_checked_idx").on(t.lastChecked),
  ],
);
