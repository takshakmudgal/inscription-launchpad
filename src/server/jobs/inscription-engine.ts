import cron from "node-cron";
import { db } from "../db";
import { proposals, inscriptions, blockTracker } from "../db/schema";
import { eq, desc } from "drizzle-orm";
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
   * Start the cron job
   */
  start() {
    // Run every 10 minutes
    cron.schedule("*/10 * * * *", () => {
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

    console.log("⏰ Inscription engine cron job started (every 10 minutes)");
  }

  /**
   * Process new blocks and inscribe winning memes
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
   * Process a single block
   */
  async processBlock(blockHeight: number) {
    // Get block information
    const block = await esploraService.getBlockByHeight(blockHeight);
    console.log(`📋 Block ${blockHeight} hash: ${block.hash}`);

    // Get top voted active proposal
    const topProposal = await db
      .select()
      .from(proposals)
      .where(eq(proposals.status, "active"))
      .orderBy(desc(proposals.totalVotes))
      .limit(1);

    if (topProposal.length === 0) {
      console.log("📝 No active proposals found");
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
    const minVotes = 5; // Could be made configurable
    if (winner.totalVotes < minVotes) {
      console.log(
        `📊 Proposal ${winner.ticker} has insufficient votes (${winner.totalVotes}/${minVotes})`,
      );
      return;
    }

    console.log(
      `🏆 Winner: ${winner.name} (${winner.ticker}) with ${winner.totalVotes} votes`,
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
        createdAt: winner.createdAt.toISOString(),
        updatedAt: winner.updatedAt.toISOString(),
      };

      // Inscribe the proposal
      const inscriptionResult = await inscriptionService.inscribe(
        proposalForInscription,
        blockHeight,
      );

      console.log(`🎯 Inscription initiated! Result:`, inscriptionResult);

      // Store inscription record with UniSat order information
      await db.insert(inscriptions).values({
        proposalId: winner.id,
        blockHeight: blockHeight,
        blockHash: block.hash,
        txid: inscriptionResult.txid,
        inscriptionId: inscriptionResult.inscriptionId,
        inscriptionUrl: inscriptionResult.inscriptionId
          ? `https://ordinals.com/inscription/${inscriptionResult.inscriptionId}`
          : undefined,
        feeRate: parseInt(env.INSCRIPTION_FEE_RATE),
        // UniSat specific fields if available
        unisatOrderId: inscriptionResult.orderId ?? undefined,
        orderStatus: inscriptionResult.orderId ? "pending" : undefined,
        paymentAddress: inscriptionResult.payAddress ?? undefined,
        paymentAmount: inscriptionResult.paymentAmount ?? undefined,
        metadata: JSON.stringify(
          inscriptionService.generateInscriptionPayload(
            proposalForInscription,
            blockHeight,
          ),
        ),
      });

      // Update proposal status to inscribed
      await db
        .update(proposals)
        .set({
          status: "inscribed",
          updatedAt: new Date(),
        })
        .where(eq(proposals.id, winner.id));

      console.log(`✅ Proposal ${winner.ticker} marked as inscribed`);
    } catch (error) {
      console.error(`❌ Failed to inscribe proposal ${winner.ticker}:`, error);
      // Don't throw, continue with block processing
    }
  }

  /**
   * Update block tracker
   */
  async updateBlockTracker(blockHeight: number) {
    const block = await esploraService.getBlockByHeight(blockHeight);

    // Insert or update block tracker
    const existing = await db.select().from(blockTracker).limit(1);

    if (existing.length === 0) {
      await db.insert(blockTracker).values({
        lastProcessedBlock: blockHeight,
        lastProcessedHash: block.hash,
      });
    } else {
      await db
        .update(blockTracker)
        .set({
          lastProcessedBlock: blockHeight,
          lastProcessedHash: block.hash,
          lastChecked: new Date(),
        })
        .where(eq(blockTracker.id, existing[0]!.id));
    }
  }

  /**
   * Manual trigger for testing
   */
  async triggerManually() {
    console.log("🔧 Manual trigger initiated...");
    await this.processNewBlocks();
  }

  /**
   * Get status information
   */
  async getStatus() {
    const lastProcessed = await db
      .select()
      .from(blockTracker)
      .orderBy(desc(blockTracker.lastProcessedBlock))
      .limit(1);

    const currentBlock = await esploraService.getCurrentBlockHeight();

    return {
      isRunning: this.isRunning,
      currentBlock,
      lastProcessedBlock: lastProcessed[0]?.lastProcessedBlock ?? 0,
      lastProcessedHash: lastProcessed[0]?.lastProcessedHash,
      lastChecked: lastProcessed[0]?.lastChecked?.toISOString(),
      blocksBehind: currentBlock - (lastProcessed[0]?.lastProcessedBlock ?? 0),
    };
  }
}

// Create and export singleton instance
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
