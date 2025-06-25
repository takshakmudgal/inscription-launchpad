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

  /**
   * Start the cron job - runs every 2 minutes to check for new blocks
   */
  start() {
    // Run every 2 minutes to check for new blocks and process inscriptions
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

  /**
   * Process new blocks and inscribe winning memes every 2 blocks
   */
  async processNewBlocks() {
    console.log("🔍 Checking for new blocks...");

    try {
      // Get current block height
      const currentBlockHeight = await esploraService.getCurrentBlockHeight();

      // Get last processed block
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

      // Process each new block
      for (
        let height = lastProcessedHeight + 1;
        height <= currentBlockHeight;
        height++
      ) {
        console.log(`🧱 Processing block ${height}...`);

        try {
          await this.processBlock(height);

          // Update block tracker
          await this.updateBlockTracker(height);

          console.log(`✅ Block ${height} processed successfully`);
        } catch (error) {
          console.error(`❌ Error processing block ${height}:`, error);
          // Don't break the loop, continue with next block
        }
      }
    } catch (error) {
      console.error("❌ Error in processNewBlocks:", error);
    }
  }

  /**
   * Process a single block - inscribe every 2 blocks, expire after 5 blocks
   */
  async processBlock(blockHeight: number) {
    // Get block information
    const block = await esploraService.getBlockByHeight(blockHeight);
    console.log(`📋 Block ${blockHeight} hash: ${block.hash}`);

    // First, expire and remove old proposals (older than 5 blocks without being launched)
    await this.expireAndRemoveOldProposals(blockHeight);

    // Get top voted active or leader proposal
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

    // Check if this proposal has already been inscribed
    const existingInscription = await db
      .select()
      .from(inscriptions)
      .where(eq(inscriptions.proposalId, winner.id))
      .limit(1);

    if (existingInscription.length > 0) {
      console.log(`🔄 Proposal ${winner.ticker} already inscribed`);
      return;
    }

    // Check if proposal has minimum votes (configurable threshold)
    const minVotes = 1; // Minimum votes required
    if (winner.totalVotes < minVotes) {
      console.log(
        `📊 Proposal ${winner.ticker} has insufficient votes (${winner.totalVotes}/${minVotes})`,
      );
      return;
    }

    console.log(
      `🏆 Current leader: ${winner.name} (${winner.ticker}) with ${winner.totalVotes} votes`,
    );

    // Check if this is the first time this proposal is at #1
    if (!winner.firstTimeAsLeader) {
      console.log(
        `🎯 New leader detected! Setting leadership timestamp for ${winner.ticker}`,
      );

      // Set the first time as leader and expiration block (5 blocks from now)
      await db
        .update(proposals)
        .set({
          status: "leader", // Mark as leader status
          firstTimeAsLeader: new Date(),
          leaderStartBlock: blockHeight, // Track the actual block height when became leader
          leaderboardMinBlocks: 2, // Minimum 2 blocks as leader before inscription
          expirationBlock: blockHeight + 5, // Expires in 5 blocks if not inscribed
          updatedAt: new Date(),
        })
        .where(eq(proposals.id, winner.id));

      console.log(
        `⏰ Proposal ${winner.ticker} will be eligible for inscription after 2 blocks (expires in 5 blocks)`,
      );
      return; // Don't inscribe yet, needs to wait 2 blocks
    }

    // Check if enough blocks have passed since becoming leader (minimum 2 blocks)
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
      // Transform database result to match Proposal type
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

      // Mark proposal as inscribing before starting the process
      await db
        .update(proposals)
        .set({
          status: "inscribing",
          updatedAt: new Date(),
        })
        .where(eq(proposals.id, winner.id));

      console.log(`🎯 Starting inscription for ${winner.ticker}...`);

      // Use the inscription service to create the inscription
      const inscriptionResult = await inscriptionService.inscribe(
        proposalForInscription,
        blockHeight,
      );

      console.log(
        `✅ Inscription initiated for ${winner.ticker}: ${inscriptionResult.orderId}`,
      );

      // Create inscription record
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

      // Reset proposal status on error
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

  /**
   * Expire and remove old proposals that haven't been launched after 5 blocks
   */
  async expireAndRemoveOldProposals(currentBlockHeight: number) {
    try {
      // Find proposals that are leaders but have exceeded their expiration block
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

          // Remove expired proposals from leaderboard by marking as expired
          // This removes them from active consideration
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

  /**
   * Calculate how many blocks a proposal has been the leader
   */
  async getBlocksAsLeader(
    proposal: { leaderStartBlock: number | null },
    currentBlockHeight: number,
  ): Promise<number> {
    if (!proposal.leaderStartBlock) {
      return 0;
    }

    return Math.max(0, currentBlockHeight - proposal.leaderStartBlock);
  }

  /**
   * Update the block tracker with the latest processed block
   */
  async updateBlockTracker(blockHeight: number) {
    try {
      const block = await esploraService.getBlockByHeight(blockHeight);

      // Check if we have any existing tracker entries
      const existing = await db.select().from(blockTracker).limit(1);

      if (existing.length > 0) {
        // Update existing
        await db
          .update(blockTracker)
          .set({
            lastProcessedBlock: blockHeight,
            lastProcessedHash: block.hash,
            lastChecked: new Date(),
          })
          .where(eq(blockTracker.id, existing[0]!.id));
      } else {
        // Create new
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

  /**
   * Manual trigger for testing
   */
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

  /**
   * Get engine status
   */
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

// Initialize UniSat monitor for tracking orders
import "./unisat-monitor";

// If running as standalone script
if (require.main === module) {
  console.log("🚀 Starting Inscription Engine...");
  // Keep the process alive
  process.on("SIGINT", () => {
    console.log("👋 Inscription Engine shutting down...");
    process.exit(0);
  });
}
