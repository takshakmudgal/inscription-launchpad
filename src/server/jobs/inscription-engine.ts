import { db } from "../db";
import { proposals, inscriptions, blockTracker } from "../db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { esploraService } from "../btc/esplora";
import { inscriptionService } from "../services/inscription";
import { pumpFunService } from "../services/pumpfun";
import { env } from "~/env";
import type { Proposal } from "~/types";

const POLLING_INTERVAL = 10000; // 10 seconds

class InscriptionEngine {
  private isRunning = false;
  private timeout: NodeJS.Timeout | null = null;

  constructor() {
    console.log("🚀 Inscription Engine initialized");
    this.start();
  }

  start() {
    if (this.isRunning) {
      console.log("Engine is already running.");
      return;
    }
    console.log("✅ Inscription Engine started");
    this.isRunning = true;
    void this.tick();
  }

  stop() {
    if (!this.isRunning) {
      console.log("Engine is not running.");
      return;
    }
    console.log("⏹️ Inscription Engine stopped");
    this.isRunning = false;
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
  }

  private async tick() {
    try {
      await this.processLatestBlock();
    } catch (error) {
      console.error("❌ Error during tick:", error);
    }

    if (this.isRunning) {
      this.timeout = setTimeout(() => this.tick(), POLLING_INTERVAL);
    }
  }

  async processLatestBlock() {
    console.log("🔍 Checking for new block...");

    try {
      const currentBlockHeight = await esploraService.getCurrentBlockHeight();
      const lastProcessed = await db
        .select()
        .from(blockTracker)
        .orderBy(desc(blockTracker.lastProcessedBlock))
        .limit(1);

      let lastProcessedHeight = 0;
      if (lastProcessed.length > 0 && lastProcessed[0]) {
        lastProcessedHeight = lastProcessed[0].lastProcessedBlock;
      }

      if (lastProcessedHeight === 0) {
        // First time running, initialize with current block height
        console.log(
          `🌱 First run. Initializing block tracker to current height: ${currentBlockHeight}`,
        );
        await this.updateBlockTracker(currentBlockHeight);
        lastProcessedHeight = currentBlockHeight;
      }

      console.log(
        `📊 Current block: ${currentBlockHeight}, Last processed: ${lastProcessedHeight}`,
      );

      if (currentBlockHeight > lastProcessedHeight) {
        const nextBlockToProcess = lastProcessedHeight + 1;
        console.log(`🧱 Processing block ${nextBlockToProcess}...`);
        try {
          await this.processBlock(nextBlockToProcess);
          await this.updateBlockTracker(nextBlockToProcess);
          console.log(`✅ Block ${nextBlockToProcess} processed successfully`);
        } catch (error) {
          console.error(
            `❌ Error processing block ${nextBlockToProcess}:`,
            error,
          );
        }
      } else {
        console.log("⛓️ No new blocks to process.");
      }
    } catch (error) {
      console.error("❌ Error in processLatestBlock:", error);
    }
  }

  async processBlock(blockHeight: number) {
    const block = await esploraService.getBlockByHeight(blockHeight);
    console.log(`📋 Block ${blockHeight} hash: ${block.id}`);

    // let launchOccurred = false;

    // Check for competition reset before processing proposals
    const blockTrackerData = await this.getOrCreateBlockTracker();
    const consecutiveBlocks =
      blockTrackerData.consecutiveBlocksWithoutLaunches + 1;

    if (consecutiveBlocks >= 5) {
      console.log(
        `🔄 COMPETITION RESET: 5 consecutive blocks without a launch`,
      );
      await this.resetCompetition(
        "5 consecutive blocks without a successful launch",
      );
      await this.updateBlockTracker(blockHeight, 0, blockHeight);
      return; // Stop processing this block after reset
    }

    await this.expireOldProposals(blockHeight);
    const topProposal = await db
      .select()
      .from(proposals)
      .where(sql`${proposals.status} IN ('active', 'leader')`)
      .orderBy(desc(proposals.totalVotes))
      .limit(1);

    if (topProposal.length === 0) {
      console.log("📝 No active or leader proposals found");
      // If no proposals, just update the block tracker with incremented counter
      await this.updateBlockTracker(blockHeight, consecutiveBlocks);
      return;
    }

    const currentWinner = topProposal[0]!;

    await this.handleLeadershipChanges(currentWinner, blockHeight);
    // const existingInscription = await db
    //   .select()
    //   .from(inscriptions)
    //   .where(eq(inscriptions.proposalId, currentWinner.id))
    //   .limit(1);

    // if (existingInscription.length > 0) {
    //   console.log(
    //     `🔄 Proposal ${currentWinner.ticker} already has inscription in progress`,
    //   );
    //   return;
    // }

    const minVotes = 1;
    if (currentWinner.totalVotes < minVotes) {
      console.log(
        `📊 Proposal ${currentWinner.ticker} has insufficient votes (${currentWinner.totalVotes}/${minVotes})`,
      );
      return;
    }

    console.log(
      `🏆 Current leader: ${currentWinner.name} (${currentWinner.ticker}) with ${currentWinner.totalVotes} votes`,
    );

    // First time becoming leader - start the waiting period
    if (!currentWinner.firstTimeAsLeader) {
      console.log(
        `🎯 New champion detected! ${currentWinner.ticker} takes the crown!`,
      );

      await db
        .update(proposals)
        .set({
          status: "leader",
          firstTimeAsLeader: new Date(),
          leaderStartBlock: blockHeight,
          leaderboardMinBlocks: 1,
          expirationBlock: blockHeight + 5,
          updatedAt: new Date(),
        })
        .where(eq(proposals.id, currentWinner.id));

      console.log(
        `⏰ ${currentWinner.ticker} must maintain #1 position for 1 block to earn inscription (started at block ${blockHeight})`,
      );
      return;
    }

    // Calculate blocks defended (not including the block they became leader)
    const blocksDefended = await this.getBlocksDefended(
      { leaderStartBlock: currentWinner.leaderStartBlock },
      blockHeight,
    );

    if (blocksDefended < 1) {
      console.log(
        `⏳ ${currentWinner.ticker} defending leadership: ${blocksDefended}/1 block defended (leader since block ${currentWinner.leaderStartBlock})`,
      );
      // No launch, so update tracker with incremented counter
      await this.updateBlockTracker(blockHeight, consecutiveBlocks);
      return;
    }

    console.log(
      `🎉 INSCRIPTION READY! ${currentWinner.ticker} has successfully defended #1 position for ${blocksDefended} blocks!`,
    );

    // Reset consecutive blocks counter since we're launching something
    await this.updateBlockTracker(blockHeight, 0, blockHeight);
    // launchOccurred = true;

    try {
      const proposalForPumpFun: Proposal = {
        ...currentWinner,
        website: currentWinner.website ?? undefined,
        twitter: currentWinner.twitter ?? undefined,
        telegram: currentWinner.telegram ?? undefined,
        bannerUrl: currentWinner.bannerUrl ?? undefined,
        submittedBy: currentWinner.submittedBy ?? undefined,
        firstTimeAsLeader: currentWinner.firstTimeAsLeader?.toISOString(),
        leaderStartBlock: currentWinner.leaderStartBlock ?? undefined,
        expirationBlock: currentWinner.expirationBlock ?? undefined,
        createdAt: currentWinner.createdAt.toISOString(),
        updatedAt: currentWinner.updatedAt.toISOString(),
      };
      void pumpFunService.createToken(proposalForPumpFun);

      const proposalForInscription = {
        ...currentWinner,
        website: currentWinner.website ?? undefined,
        twitter: currentWinner.twitter ?? undefined,
        telegram: currentWinner.telegram ?? undefined,
        bannerUrl: currentWinner.bannerUrl ?? undefined,
        submittedBy: currentWinner.submittedBy ?? undefined,
        firstTimeAsLeader: currentWinner.firstTimeAsLeader?.toISOString(),
        leaderStartBlock: currentWinner.leaderStartBlock ?? undefined,
        leaderboardMinBlocks: currentWinner.leaderboardMinBlocks,
        expirationBlock: currentWinner.expirationBlock ?? undefined,
        createdAt: currentWinner.createdAt.toISOString(),
        updatedAt: currentWinner.updatedAt.toISOString(),
      };

      await db
        .update(proposals)
        .set({
          status: "inscribing",
          updatedAt: new Date(),
        })
        .where(eq(proposals.id, currentWinner.id));

      console.log(
        `🎯 Starting Bitcoin inscription for champion: ${currentWinner.ticker}...`,
      );

      const inscriptionBlockHeight = blockHeight;

      const inscriptionResult = await inscriptionService.inscribe(
        proposalForInscription,
        inscriptionBlockHeight,
      );

      console.log(
        `✅ Inscription initiated for ${currentWinner.ticker}: ${inscriptionResult.orderId}`,
      );

      await db.insert(inscriptions).values({
        proposalId: currentWinner.id,
        blockHeight: inscriptionBlockHeight,
        blockHash: block.id,
        txid: inscriptionResult.txid || "pending",
        inscriptionId: inscriptionResult.inscriptionId,
        feeRate: env.INSCRIPTION_FEE_RATE
          ? parseInt(env.INSCRIPTION_FEE_RATE)
          : 15,
        metadata: JSON.stringify({
          project: "bitmemes",
          type: "meme-coin-inscription",
          coin: {
            name: currentWinner.name,
            ticker: currentWinner.ticker,
            description: currentWinner.description,
            votes: currentWinner.totalVotes,
            website: `https://bitpill.fun/proposals/${currentWinner.id}`,
          },
        }),
        unisatOrderId: inscriptionResult.orderId,
        orderStatus: "pending",
        paymentAddress: inscriptionResult.payAddress,
        paymentAmount: inscriptionResult.paymentAmount,
      });

      console.log(
        `📝 Inscription record created for champion proposal ${currentWinner.id}`,
      );
      await this.assignNextLeader(blockHeight);
    } catch (error) {
      console.error(
        `❌ Error inscribing proposal ${currentWinner.ticker}:`,
        error,
      );

      await db
        .update(proposals)
        .set({
          status: "active",
          updatedAt: new Date(),
        })
        .where(eq(proposals.id, currentWinner.id));

      console.log(
        `🔄 Reset proposal ${currentWinner.ticker} status to active due to inscription error`,
      );
    }
  }

  async handleLeadershipChanges(currentWinner: any, blockHeight: number) {
    try {
      const currentLeaders = await db
        .select()
        .from(proposals)
        .where(eq(proposals.status, "leader"));

      const dethronedLeaders = currentLeaders.filter(
        (leader) => leader.id !== currentWinner.id,
      );

      if (dethronedLeaders.length > 0) {
        console.log(
          `👑 LEADERSHIP CHANGE DETECTED! Dethroning ${dethronedLeaders.length} former leaders...`,
        );

        for (const dethronedLeader of dethronedLeaders) {
          const blocksDefended = dethronedLeader.leaderStartBlock
            ? Math.max(0, blockHeight - dethronedLeader.leaderStartBlock)
            : 0;

          console.log(
            `❌ ${dethronedLeader.ticker} DETHRONED! Defended for ${blocksDefended} blocks (needed 1 to survive)`,
          );

          await db
            .update(proposals)
            .set({
              status: "expired",
              updatedAt: new Date(),
            })
            .where(eq(proposals.id, dethronedLeader.id));

          console.log(
            `🗑️ ${dethronedLeader.ticker} eliminated from competition - failed to maintain #1 position`,
          );
        }

        console.log(
          `🏆 ${currentWinner.ticker} is now the sole leader with ${currentWinner.totalVotes} votes!`,
        );
      }
    } catch (error) {
      console.error("❌ Error handling leadership changes:", error);
    }
  }

  async expireOldProposals(currentBlockHeight: number) {
    try {
      const fiveBlocksAgo = currentBlockHeight - 5;
      const expiredProposals = await db
        .select()
        .from(proposals)
        .where(
          sql`${proposals.status} = 'active' AND ${
            proposals.creationBlock
          } IS NOT NULL AND ${proposals.creationBlock} <= ${fiveBlocksAgo}`,
        );

      if (expiredProposals.length > 0) {
        console.log(
          `⏰ Found ${expiredProposals.length} active proposals that are older than 5 blocks`,
        );

        for (const proposal of expiredProposals) {
          console.log(
            `⏰ TIME'S UP! ${proposal.ticker} has been active for more than 5 blocks without becoming a leader.`,
          );

          await db
            .update(proposals)
            .set({
              status: "expired",
              updatedAt: new Date(),
            })
            .where(eq(proposals.id, proposal.id));

          console.log(
            `❌ ${proposal.ticker} eliminated due to inactivity - competition window closed`,
          );
        }
      }
    } catch (error) {
      console.error("❌ Error expiring old proposals:", error);
    }
  }

  async getBlocksDefended(
    proposal: { leaderStartBlock: number | null },
    currentBlockHeight: number,
  ): Promise<number> {
    if (!proposal.leaderStartBlock) {
      return 0;
    }

    // The number of blocks defended is the number of blocks processed since leadership was achieved.
    // For example, if leadership is gained at block 100, when processing block 101,
    // they have defended 1 block (101 - 100 = 1).
    return Math.max(0, currentBlockHeight - proposal.leaderStartBlock);
  }

  async getBlocksAsLeader(
    proposal: { leaderStartBlock: number | null },
    currentBlockHeight: number,
  ): Promise<number> {
    return this.getBlocksDefended(proposal, currentBlockHeight);
  }

  async getOrCreateBlockTracker() {
    const existing = await db.select().from(blockTracker).limit(1);

    if (existing.length > 0) {
      return existing[0]!;
    }

    // If no tracker exists yet, start tracking from the CURRENT block height so we don't replay the entire Bitcoin history
    const currentHeight = await esploraService.getCurrentBlockHeight();

    // Create initial tracker
    const [newTracker] = await db
      .insert(blockTracker)
      .values({
        lastProcessedBlock: currentHeight,
        lastProcessedHash: "", // will be populated when the first real block is processed
        consecutiveBlocksWithoutLaunches: 0,
        lastLaunchBlock: null,
        lastChecked: new Date(),
      })
      .returning();

    return newTracker!;
  }

  async updateBlockTracker(
    blockHeight: number,
    consecutiveBlocksWithoutLaunches?: number,
    lastLaunchBlock?: number,
  ) {
    try {
      const block = await esploraService.getBlockByHeight(blockHeight);
      const existing = await db.select().from(blockTracker).limit(1);

      const updateData: any = {
        lastProcessedBlock: blockHeight,
        lastProcessedHash: block.id,
        lastChecked: new Date(),
      };

      if (consecutiveBlocksWithoutLaunches !== undefined) {
        updateData.consecutiveBlocksWithoutLaunches =
          consecutiveBlocksWithoutLaunches;
      }

      if (lastLaunchBlock !== undefined) {
        updateData.lastLaunchBlock = lastLaunchBlock;
      }

      if (existing.length > 0) {
        await db
          .update(blockTracker)
          .set(updateData)
          .where(eq(blockTracker.id, existing[0]!.id));
      } else {
        await db.insert(blockTracker).values({
          lastProcessedBlock: blockHeight,
          lastProcessedHash: block.id,
          consecutiveBlocksWithoutLaunches:
            consecutiveBlocksWithoutLaunches ?? 0,
          lastLaunchBlock: lastLaunchBlock ?? null,
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
    console.log("⚙️ Triggering manual run...");
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
    await this.tick();
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

      // Get current competition stats
      const competitionStats = await this.getCompetitionStats();

      return {
        isRunning: this.isRunning,
        currentBlock: currentBlockHeight,
        lastProcessedBlock,
        lastProcessedHash,
        lastChecked,
        blocksBehind: Math.max(0, currentBlockHeight - lastProcessedBlock),
        competition: competitionStats,
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

  async getCompetitionStats() {
    try {
      const activeProposals = await db
        .select()
        .from(proposals)
        .where(sql`${proposals.status} IN ('active', 'leader')`)
        .orderBy(desc(proposals.totalVotes));

      const leaderProposals = await db
        .select()
        .from(proposals)
        .where(eq(proposals.status, "leader"));

      const inscribingProposals = await db
        .select()
        .from(proposals)
        .where(eq(proposals.status, "inscribing"));

      const expiredProposals = await db
        .select()
        .from(proposals)
        .where(eq(proposals.status, "expired"));

      const inscribedProposals = await db
        .select()
        .from(proposals)
        .where(eq(proposals.status, "inscribed"));

      const blockTrackerData = await this.getOrCreateBlockTracker();

      return {
        totalActive: activeProposals.length,
        currentLeaders: leaderProposals.length,
        currentlyInscribing: inscribingProposals.length,
        totalExpired: expiredProposals.length,
        totalInscribed: inscribedProposals.length,
        consecutiveBlocksWithoutLaunches:
          blockTrackerData.consecutiveBlocksWithoutLaunches,
        topProposal: activeProposals[0]
          ? {
              ticker: activeProposals[0].ticker,
              votes: activeProposals[0].totalVotes,
              status: activeProposals[0].status,
              blocksDefended: activeProposals[0].leaderStartBlock
                ? Math.max(
                    0,
                    (await esploraService.getCurrentBlockHeight()) -
                      activeProposals[0].leaderStartBlock,
                  )
                : 0,
            }
          : null,
      };
    } catch (error) {
      console.error("Error getting competition stats:", error);
      return {
        totalActive: 0,
        currentLeaders: 0,
        currentlyInscribing: 0,
        totalExpired: 0,
        totalInscribed: 0,
        consecutiveBlocksWithoutLaunches: 0,
        topProposal: null,
      };
    }
  }

  async forceExpireProposal(proposalId: number, reason = "Manual elimination") {
    try {
      const proposal = await db
        .select()
        .from(proposals)
        .where(eq(proposals.id, proposalId))
        .limit(1);

      if (proposal.length === 0) {
        throw new Error(`Proposal ${proposalId} not found`);
      }

      const proposalData = proposal[0]!;

      await db
        .update(proposals)
        .set({
          status: "expired",
          updatedAt: new Date(),
        })
        .where(eq(proposals.id, proposalId));

      console.log(
        `🔨 MANUAL ELIMINATION: ${proposalData.ticker} force-expired. Reason: ${reason}`,
      );

      return {
        success: true,
        message: `Proposal ${proposalData.ticker} has been eliminated`,
      };
    } catch (error) {
      console.error(`Error force expiring proposal ${proposalId}:`, error);
      throw error;
    }
  }

  async resetCompetition(reason = "Competition reset") {
    try {
      await db
        .update(proposals)
        .set({
          status: "active",
          firstTimeAsLeader: null,
          leaderStartBlock: null,
          expirationBlock: null,
          updatedAt: new Date(),
        })
        .where(sql`${proposals.status} IN ('leader', 'expired')`);

      console.log(
        `🔄 COMPETITION RESET: All proposals reset to active. Reason: ${reason}`,
      );

      return {
        success: true,
        message: "Competition has been reset - all proposals are now active",
      };
    } catch (error) {
      console.error("Error resetting competition:", error);
      throw error;
    }
  }

  private async assignNextLeader(blockHeight: number) {
    try {
      const nextTop = await db
        .select()
        .from(proposals)
        .where(eq(proposals.status, "active"))
        .orderBy(desc(proposals.totalVotes))
        .limit(1);

      if (nextTop.length === 0) {
        console.log("📝 No active proposals available to promote to leader");
        return;
      }

      const newLeader = nextTop[0]!;

      await db
        .update(proposals)
        .set({
          status: "leader",
          firstTimeAsLeader: new Date(),
          leaderStartBlock: blockHeight,
          leaderboardMinBlocks: 1,
          expirationBlock: blockHeight + 5,
          updatedAt: new Date(),
        })
        .where(eq(proposals.id, newLeader.id));

      await this.handleLeadershipChanges(newLeader, blockHeight);

      console.log(
        `🎯 New leader selected for next block: ${newLeader.ticker} (${newLeader.totalVotes} votes)`,
      );
    } catch (error) {
      console.error("❌ Error assigning next leader:", error);
    }
  }
}

let inscriptionEngineInstance: InscriptionEngine | null = null;

export function getInscriptionEngineInstance(): InscriptionEngine {
  if (!inscriptionEngineInstance) {
    inscriptionEngineInstance = new InscriptionEngine();
  }
  return inscriptionEngineInstance;
}
