import cron from "node-cron";
import { db } from "../db";
import { proposals, inscriptions, blockTracker } from "../db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { esploraService } from "../btc/esplora";
import { inscriptionService } from "../services/inscription";
import { pumpFunService } from "../services/pumpfun";
import { env } from "~/env";
import type { Proposal } from "~/types";

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
    console.log(`📋 Block ${blockHeight} hash: ${block.id}`);

    await this.expireOldProposals(blockHeight);
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

    const currentWinner = topProposal[0]!;

    await this.handleLeadershipChanges(currentWinner, blockHeight);
    const existingInscription = await db
      .select()
      .from(inscriptions)
      .where(eq(inscriptions.proposalId, currentWinner.id))
      .limit(1);

    if (existingInscription.length > 0) {
      console.log(
        `🔄 Proposal ${currentWinner.ticker} already has inscription in progress`,
      );
      return;
    }

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
          leaderboardMinBlocks: 2,
          expirationBlock: blockHeight + 5,
          updatedAt: new Date(),
        })
        .where(eq(proposals.id, currentWinner.id));

      console.log(
        `⏰ ${currentWinner.ticker} must maintain #1 position for 2 blocks to earn inscription (expires in 5 blocks if dethroned)`,
      );
      return;
    }

    const blocksAsLeader = await this.getBlocksAsLeader(
      { leaderStartBlock: currentWinner.leaderStartBlock },
      blockHeight,
    );

    if (blocksAsLeader < 2) {
      console.log(
        `⏳ ${currentWinner.ticker} defending leadership: ${blocksAsLeader}/2 blocks completed`,
      );
      return;
    }

    console.log(
      `🎉 INSCRIPTION READY! ${currentWinner.ticker} has successfully maintained #1 position for ${blocksAsLeader} blocks!`,
    );

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

      const inscriptionResult = await inscriptionService.inscribe(
        proposalForInscription,
        blockHeight,
      );

      console.log(
        `✅ Inscription initiated for ${currentWinner.ticker}: ${inscriptionResult.orderId}`,
      );

      await db.insert(inscriptions).values({
        proposalId: currentWinner.id,
        blockHeight,
        blockHash: block.id,
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
            name: currentWinner.name,
            ticker: currentWinner.ticker,
            description: currentWinner.description,
            votes: currentWinner.totalVotes,
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
          const blocksTheyLed =
            blockHeight - (dethronedLeader.leaderStartBlock || blockHeight);

          console.log(
            `❌ ${dethronedLeader.ticker} DETHRONED! Lost leadership after ${blocksTheyLed} blocks (needed 2 to survive)`,
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

  async getBlocksAsLeader(
    proposal: { leaderStartBlock: number | null },
    currentBlockHeight: number,
  ): Promise<number> {
    if (!proposal.leaderStartBlock) {
      return 0;
    }

    return Math.max(0, currentBlockHeight - proposal.leaderStartBlock + 1);
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
            lastProcessedHash: block.id,
            lastChecked: new Date(),
          })
          .where(eq(blockTracker.id, existing[0]!.id));
      } else {
        await db.insert(blockTracker).values({
          lastProcessedBlock: blockHeight,
          lastProcessedHash: block.id,
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

    console.log("🔧 Manually triggering competitive inscription engine...");
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

      return {
        totalActive: activeProposals.length,
        currentLeaders: leaderProposals.length,
        currentlyInscribing: inscribingProposals.length,
        totalExpired: expiredProposals.length,
        totalInscribed: inscribedProposals.length,
        topProposal: activeProposals[0]
          ? {
              ticker: activeProposals[0].ticker,
              votes: activeProposals[0].totalVotes,
              status: activeProposals[0].status,
              blocksAsLeader: activeProposals[0].leaderStartBlock
                ? Math.max(
                    0,
                    (await esploraService.getCurrentBlockHeight()) -
                      activeProposals[0].leaderStartBlock +
                      1,
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
}

declare global {
  var inscriptionEngineInstance: InscriptionEngine;
}

function getInscriptionEngineInstance(): InscriptionEngine {
  if (!global.inscriptionEngineInstance) {
    console.log("🛠️ Creating new InscriptionEngine instance");
    global.inscriptionEngineInstance = new InscriptionEngine();
  }
  return global.inscriptionEngineInstance;
}

export const inscriptionEngine = getInscriptionEngineInstance();
