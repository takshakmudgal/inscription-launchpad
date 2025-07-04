import {
  pgTable,
  integer,
  varchar,
  timestamp,
  index,
  foreignKey,
  text,
  bigint,
  unique,
  serial,
  pgEnum,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const proposalStatus = pgEnum("proposal_status", [
  "active",
  "leader",
  "inscribing",
  "inscribed",
  "rejected",
  "expired",
]);
export const voteType = pgEnum("vote_type", ["up", "down"]);

export const bitmemesBlockTracker = pgTable("bitmemes_block_tracker", {
  id: integer().primaryKey().generatedByDefaultAsIdentity({
    name: "bitmemes_block_tracker_id_seq",
    startWith: 1,
    increment: 1,
    minValue: 1,
    maxValue: 2147483647,
    cache: 1,
  }),
  lastProcessedBlock: integer("last_processed_block").notNull(),
  lastProcessedHash: varchar("last_processed_hash", { length: 64 }).notNull(),
  lastChecked: timestamp("last_checked", { withTimezone: true, mode: "string" })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

export const bitmemesProposal = pgTable(
  "bitmemes_proposal",
  {
    id: integer().primaryKey().generatedByDefaultAsIdentity({
      name: "bitmemes_proposal_id_seq",
      startWith: 1,
      increment: 1,
      minValue: 1,
      maxValue: 2147483647,
      cache: 1,
    }),
    name: varchar({ length: 50 }).notNull(),
    ticker: varchar({ length: 10 }).notNull(),
    description: varchar({ length: 280 }).notNull(),
    website: text(),
    twitter: text(),
    telegram: text(),
    imageUrl: text("image_url").notNull(),
    bannerUrl: text("banner_url"),
    submittedBy: integer("submitted_by"),
    votesUp: integer("votes_up").default(0).notNull(),
    votesDown: integer("votes_down").default(0).notNull(),
    totalVotes: integer("total_votes").default(0).notNull(),
    status: proposalStatus().default("active").notNull(),
    firstTimeAsLeader: timestamp("first_time_as_leader", {
      withTimezone: true,
      mode: "string",
    }),
    leaderStartBlock: integer("leader_start_block"),
    leaderboardMinBlocks: integer("leaderboard_min_blocks")
      .default(1)
      .notNull(),
    expirationBlock: integer("expiration_block"),
    creationBlock: integer("creation_block"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("proposal_created_idx").using(
      "btree",
      table.createdAt.asc().nullsLast().op("timestamptz_ops"),
    ),
    index("proposal_expiration_idx").using(
      "btree",
      table.expirationBlock.asc().nullsLast().op("int4_ops"),
    ),
    index("proposal_leader_time_idx").using(
      "btree",
      table.firstTimeAsLeader.asc().nullsLast().op("timestamptz_ops"),
    ),
    index("proposal_status_idx").using(
      "btree",
      table.status.asc().nullsLast().op("enum_ops"),
    ),
    index("proposal_ticker_idx").using(
      "btree",
      table.ticker.asc().nullsLast().op("text_ops"),
    ),
    index("proposal_votes_idx").using(
      "btree",
      table.totalVotes.asc().nullsLast().op("int4_ops"),
    ),
    foreignKey({
      columns: [table.submittedBy],
      foreignColumns: [bitmemesUser.id],
      name: "bitmemes_proposal_submitted_by_bitmemes_user_id_fk",
    }),
  ],
);

export const bitmemesInscription = pgTable(
  "bitmemes_inscription",
  {
    id: integer().primaryKey().generatedByDefaultAsIdentity({
      name: "bitmemes_inscription_id_seq",
      startWith: 1,
      increment: 1,
      minValue: 1,
      maxValue: 2147483647,
      cache: 1,
    }),
    proposalId: integer("proposal_id").notNull(),
    blockHeight: integer("block_height").notNull(),
    blockHash: varchar("block_hash", { length: 64 }).notNull(),
    txid: varchar({ length: 64 }).notNull(),
    inscriptionId: varchar("inscription_id", { length: 100 }),
    inscriptionUrl: text("inscription_url"),
    feeRate: integer("fee_rate"),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    totalFees: bigint("total_fees", { mode: "number" }),
    metadata: text(),
    unisatOrderId: varchar("unisat_order_id", { length: 100 }),
    orderStatus: varchar("order_status", { length: 50 }),
    paymentAddress: text("payment_address"),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    paymentAmount: bigint("payment_amount", { mode: "number" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("inscription_block_idx").using(
      "btree",
      table.blockHeight.asc().nullsLast().op("int4_ops"),
    ),
    index("inscription_proposal_idx").using(
      "btree",
      table.proposalId.asc().nullsLast().op("int4_ops"),
    ),
    index("inscription_txid_idx").using(
      "btree",
      table.txid.asc().nullsLast().op("text_ops"),
    ),
    index("inscription_unisat_order_idx").using(
      "btree",
      table.unisatOrderId.asc().nullsLast().op("text_ops"),
    ),
    foreignKey({
      columns: [table.proposalId],
      foreignColumns: [bitmemesProposal.id],
      name: "bitmemes_inscription_proposal_id_bitmemes_proposal_id_fk",
    }),
  ],
);

export const bitmemesUser = pgTable(
  "bitmemes_user",
  {
    id: integer().primaryKey().generatedByDefaultAsIdentity({
      name: "bitmemes_user_id_seq",
      startWith: 1,
      increment: 1,
      minValue: 1,
      maxValue: 2147483647,
      cache: 1,
    }),
    walletAddress: varchar("wallet_address", { length: 62 }),
    twitterId: varchar("twitter_id", { length: 50 }),
    username: varchar({ length: 50 }),
    email: varchar({ length: 255 }),
    twitter: varchar({ length: 50 }),
    telegram: varchar({ length: 50 }),
    bio: text(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("user_email_idx").using(
      "btree",
      table.email.asc().nullsLast().op("text_ops"),
    ),
    index("user_twitter_idx").using(
      "btree",
      table.twitterId.asc().nullsLast().op("text_ops"),
    ),
    index("user_username_idx").using(
      "btree",
      table.username.asc().nullsLast().op("text_ops"),
    ),
    index("user_wallet_idx").using(
      "btree",
      table.walletAddress.asc().nullsLast().op("text_ops"),
    ),
  ],
);

export const bitmemesPumpFunTokens = pgTable(
  "bitmemes_pump_fun_tokens",
  {
    id: serial().primaryKey().notNull(),
    proposalId: integer("proposal_id").notNull(),
    mintAddress: text("mint_address").notNull(),
    transactionSignature: text("transaction_signature").notNull(),
    metadataUri: text("metadata_uri").notNull(),
    createdAt: timestamp("created_at", { mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("pump_fun_tokens_mint_address_idx").using(
      "btree",
      table.mintAddress.asc().nullsLast().op("text_ops"),
    ),
    index("pump_fun_tokens_proposal_idx").using(
      "btree",
      table.proposalId.asc().nullsLast().op("int4_ops"),
    ),
    index("pump_fun_tokens_transaction_signature_idx").using(
      "btree",
      table.transactionSignature.asc().nullsLast().op("text_ops"),
    ),
    foreignKey({
      columns: [table.proposalId],
      foreignColumns: [bitmemesProposal.id],
      name: "bitmemes_pump_fun_tokens_proposal_id_bitmemes_proposal_id_fk",
    }),
    unique("bitmemes_pump_fun_tokens_mint_address_unique").on(
      table.mintAddress,
    ),
    unique("bitmemes_pump_fun_tokens_transaction_signature_unique").on(
      table.transactionSignature,
    ),
  ],
);

export const bitmemesVote = pgTable(
  "bitmemes_vote",
  {
    id: integer().primaryKey().generatedByDefaultAsIdentity({
      name: "bitmemes_vote_id_seq",
      startWith: 1,
      increment: 1,
      minValue: 1,
      maxValue: 2147483647,
      cache: 1,
    }),
    userId: integer("user_id").notNull(),
    proposalId: integer("proposal_id").notNull(),
    voteType: voteType("vote_type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("vote_proposal_idx").using(
      "btree",
      table.proposalId.asc().nullsLast().op("int4_ops"),
    ),
    index("vote_user_idx").using(
      "btree",
      table.userId.asc().nullsLast().op("int4_ops"),
    ),
    index("vote_user_proposal_idx").using(
      "btree",
      table.userId.asc().nullsLast().op("int4_ops"),
      table.proposalId.asc().nullsLast().op("int4_ops"),
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [bitmemesUser.id],
      name: "bitmemes_vote_user_id_bitmemes_user_id_fk",
    }),
    foreignKey({
      columns: [table.proposalId],
      foreignColumns: [bitmemesProposal.id],
      name: "bitmemes_vote_proposal_id_bitmemes_proposal_id_fk",
    }),
  ],
);
