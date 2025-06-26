import cron from "node-cron";
import { db } from "../db";
import { proposals, inscriptions, blockTracker } from "../db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { esploraService } from "../btc/esplora";
import { inscriptionService } from "../services/inscription";
import { env } from "~/env";

class InscriptionEngine {
  private isRunning = false;

  constructor() {
    console.log("🚀 Inscription Engine initialized");
    this.start();
  }

  start() {
    cron.schedule("*/2 * * * *", () => {
      void (async () => {
        if (this.isRunning) {
          console.log("⏳ Inscription engine already running, skipping...");
          return;
        }

        this.isRunning = true;
        try {
          await this.processNewBlocks();
        } catch (error) {
          console.error("❌ Error in inscription engine:", error);
        } finally {
          this.isRunning = false;
        }
      })();
    });

    console.log(
      "⏰ Inscription engine cron job started (every 2 minutes for block processing)",
    );
  }

  async processNewBlocks() {
    console.log("🔍 Checking for new blocks...");

    try {
      const currentBlockHeight = await esploraService.getCurrentBlockHeight();
      const lastProcessed = await db
        .select()
        .from(blockTracker)
        .orderBy(desc(blockTracker.lastProcessedBlock))
        .limit(1);

      let lastProcessedHeight = 0;
      if (lastProcessed.length > 0) {
        lastProcessedHeight = lastProcessed[0]!.lastProcessedBlock;
      }

      console.log(
        `📊 Current block: ${currentBlockHeight}, Last processed: ${lastProcessedHeight}`,
      );

      for (
        let height = lastProcessedHeight + 1;
        height <= currentBlockHeight;
        height++
      ) {
        console.log(`🧱 Processing block ${height}...`);

        try {
          await this.processBlock(height);
          await this.updateBlockTracker(height);
          console.log(`✅ Block ${height} processed successfully`);
        } catch (error) {
          console.error(`❌ Error processing block ${height}:`, error);
        }
      }
    } catch (error) {
      console.error("❌ Error in processNewBlocks:", error);
    }
  }

  async processBlock(blockHeight: number) {
    const block = await esploraService.getBlockByHeight(blockHeight);
    console.log(`📋 Block ${blockHeight} hash: ${block.hash}`);
    await this.expireAndRemoveOldProposals(blockHeight);
    const topProposal = await db
      .select()
      .from(proposals)
      .where(sql`${proposals.status} IN ('active', 'leader')`)
      .orderBy(desc(proposals.totalVotes))
      .limit(1);

    if (topProposal.length === 0) {
      console.log("📝 No active or leader proposals found");
      return;
    }

    const winner = topProposal[0]!;
    const existingInscription = await db
      .select()
      .from(inscriptions)
      .where(eq(inscriptions.proposalId, winner.id))
      .limit(1);

    if (existingInscription.length > 0) {
      console.log(`🔄 Proposal ${winner.ticker} already inscribed`);
      return;
    }

    const minVotes = 1;
    if (winner.totalVotes < minVotes) {
      console.log(
        `📊 Proposal ${winner.ticker} has insufficient votes (${winner.totalVotes}/${minVotes})`,
      );
      return;
    }

    console.log(
      `🏆 Current leader: ${winner.name} (${winner.ticker}) with ${winner.totalVotes} votes`,
    );

    if (!winner.firstTimeAsLeader) {
      console.log(
        `🎯 New leader detected! Setting leadership timestamp for ${winner.ticker}`,
      );

      await db
        .update(proposals)
        .set({
          status: "leader",
          firstTimeAsLeader: new Date(),
          leaderStartBlock: blockHeight,
          leaderboardMinBlocks: 2,
          expirationBlock: blockHeight + 5,
          updatedAt: new Date(),
        })
        .where(eq(proposals.id, winner.id));

      console.log(
        `⏰ Proposal ${winner.ticker} will be eligible for inscription after 2 blocks (expires in 5 blocks)`,
      );
      return;
    }

    const blocksAsLeader = await this.getBlocksAsLeader(
      { leaderStartBlock: winner.leaderStartBlock },
      blockHeight,
    );

    if (blocksAsLeader < 2) {
      console.log(
        `⏳ Proposal ${winner.ticker} has been leader for ${blocksAsLeader}/2 blocks. Waiting...`,
      );
      return;
    }

    console.log(
      `🎉 Proposal ${winner.ticker} is ready for inscription! (${blocksAsLeader} blocks as leader)`,
    );

    try {
      const proposalForInscription = {
        ...winner,
        website: winner.website ?? undefined,
        twitter: winner.twitter ?? undefined,
        telegram: winner.telegram ?? undefined,
        bannerUrl: winner.bannerUrl ?? undefined,
        submittedBy: winner.submittedBy ?? undefined,
        firstTimeAsLeader: winner.firstTimeAsLeader?.toISOString(),
        leaderStartBlock: winner.leaderStartBlock ?? undefined,
        leaderboardMinBlocks: winner.leaderboardMinBlocks,
        expirationBlock: winner.expirationBlock ?? undefined,
        createdAt: winner.createdAt.toISOString(),
        updatedAt: winner.updatedAt.toISOString(),
      };

      await db
        .update(proposals)
        .set({
          status: "inscribing",
          updatedAt: new Date(),
        })
        .where(eq(proposals.id, winner.id));

      console.log(`🎯 Starting inscription for ${winner.ticker}...`);

      const inscriptionResult = await inscriptionService.inscribe(
        proposalForInscription,
        blockHeight,
      );

      console.log(
        `✅ Inscription initiated for ${winner.ticker}: ${inscriptionResult.orderId}`,
      );

      await db.insert(inscriptions).values({
        proposalId: winner.id,
        blockHeight,
        blockHash: block.hash,
        txid: inscriptionResult.txid || "pending",
        inscriptionId: inscriptionResult.inscriptionId,
        feeRate: env.INSCRIPTION_FEE_RATE
          ? parseInt(env.INSCRIPTION_FEE_RATE)
          : 15,
        metadata: JSON.stringify({
          project: "bitmemes",
          type: "meme-coin-inscription",
          block: blockHeight,
          coin: {
            name: winner.name,
            ticker: winner.ticker,
            description: winner.description,
            votes: winner.totalVotes,
          },
        }),
        unisatOrderId: inscriptionResult.orderId,
        orderStatus: "pending",
        paymentAddress: inscriptionResult.payAddress,
        paymentAmount: inscriptionResult.paymentAmount,
      });

      console.log(`📝 Inscription record created for proposal ${winner.id}`);
    } catch (error) {
      console.error(`❌ Error inscribing proposal ${winner.ticker}:`, error);

      await db
        .update(proposals)
        .set({
          status: "active",
          updatedAt: new Date(),
        })
        .where(eq(proposals.id, winner.id));

      console.log(
        `🔄 Reset proposal ${winner.ticker} status to active due to inscription error`,
      );
    }
  }

  async expireAndRemoveOldProposals(currentBlockHeight: number) {
    try {
      const expiredProposals = await db
        .select()
        .from(proposals)
        .where(
          sql`${proposals.status} = 'leader' 
              AND ${proposals.expirationBlock} IS NOT NULL 
              AND ${proposals.expirationBlock} <= ${currentBlockHeight}`,
        );

      if (expiredProposals.length > 0) {
        console.log(
          `⏰ Found ${expiredProposals.length} expired proposals to remove from leaderboard`,
        );

        for (const proposal of expiredProposals) {
          console.log(
            `🗑️  Removing expired proposal: ${proposal.ticker} (expired at block ${proposal.expirationBlock}, current: ${currentBlockHeight})`,
          );

          await db
            .update(proposals)
            .set({
              status: "expired",
              updatedAt: new Date(),
            })
            .where(eq(proposals.id, proposal.id));

          console.log(
            `❌ Proposal ${proposal.ticker} removed from leaderboard due to expiration`,
          );
        }
      }
    } catch (error) {
      console.error("❌ Error expiring old proposals:", error);
    }
  }

  async getBlocksAsLeader(
    proposal: { leaderStartBlock: number | null },
    currentBlockHeight: number,
  ): Promise<number> {
    if (!proposal.leaderStartBlock) {
      return 0;
    }

    return Math.max(0, currentBlockHeight - proposal.leaderStartBlock);
  }

  async updateBlockTracker(blockHeight: number) {
    try {
      const block = await esploraService.getBlockByHeight(blockHeight);

      const existing = await db.select().from(blockTracker).limit(1);

      if (existing.length > 0) {
        await db
          .update(blockTracker)
          .set({
            lastProcessedBlock: blockHeight,
            lastProcessedHash: block.hash,
            lastChecked: new Date(),
          })
          .where(eq(blockTracker.id, existing[0]!.id));
      } else {
        await db.insert(blockTracker).values({
          lastProcessedBlock: blockHeight,
          lastProcessedHash: block.hash,
          lastChecked: new Date(),
        });
      }
    } catch (error) {
      console.error(
        `❌ Error updating block tracker for ${blockHeight}:`,
        error,
      );
    }
  }

  async triggerManually() {
    if (this.isRunning) {
      console.log("⏳ Engine already running");
      return;
    }

    console.log("🔧 Manually triggering inscription engine...");
    this.isRunning = true;
    try {
      await this.processNewBlocks();
    } finally {
      this.isRunning = false;
    }
  }

  async getStatus() {
    try {
      const currentBlockHeight = await esploraService.getCurrentBlockHeight();
      const lastProcessed = await db
        .select()
        .from(blockTracker)
        .orderBy(desc(blockTracker.lastProcessedBlock))
        .limit(1);

      const lastProcessedBlock = lastProcessed[0]?.lastProcessedBlock ?? 0;
      const lastProcessedHash = lastProcessed[0]?.lastProcessedHash;
      const lastChecked = lastProcessed[0]?.lastChecked?.toISOString();

      return {
        isRunning: this.isRunning,
        currentBlock: currentBlockHeight,
        lastProcessedBlock,
        lastProcessedHash,
        lastChecked,
        blocksBehind: Math.max(0, currentBlockHeight - lastProcessedBlock),
      };
    } catch (error) {
      console.error("Error getting inscription engine status:", error);
      return {
        isRunning: this.isRunning,
        currentBlock: 0,
        lastProcessedBlock: 0,
        blocksBehind: 0,
        error: String(error),
      };
    }
  }
}

export const inscriptionEngine = new InscriptionEngine();

import "./unisat-monitor";

if (require.main === module) {
  console.log("🚀 Starting Inscription Engine...");
  process.on("SIGINT", () => {
    console.log("👋 Inscription Engine shutting down...");
    process.exit(0);
  });
}
