import cron from "node-cron";
import { db } from "../db";
import { inscriptions, proposals } from "../db/schema";
import { eq, sql } from "drizzle-orm";
import { unisatService } from "../services/unisat";
import type { InscriptionRecord } from "~/types";

class UnisatMonitor {
  private isRunning = false;
  private lastChecked = new Date();

  constructor() {
    console.log("🚀 UniSat Monitor initialized");
    this.start();
  }

  start() {
    cron.schedule("*/30 * * * * *", () => {
      void (async () => {
        if (this.isRunning) {
          console.log("⏳ UniSat monitor already running, skipping...");
          return;
        }

        this.isRunning = true;
        try {
          await this.checkAllPendingOrders();
          this.lastChecked = new Date();
        } catch (error) {
          console.error("❌ Error in UniSat monitor:", error);
        } finally {
          this.isRunning = false;
        }
      })();
    });

    console.log(
      "⏰ UniSat monitor cron job started (every 30 seconds for faster inscription detection)",
    );
  }

  async checkAllPendingOrders() {
    console.log("🔍 Checking pending UniSat orders...");

    try {
      // Monitor all inscriptions that have not yet resulted in an "inscribed" proposal, including
      // those already in terminal UniSat states (sent/minted/confirmed/completed) so we can persist
      // the inscriptionId/txid and flip the proposal status.
      const pendingInscriptions = await db
        .select()
        .from(inscriptions)
        .where(
          sql`${inscriptions.unisatOrderId} IS NOT NULL
              AND (${inscriptions.orderStatus} IS NULL
                   OR ${inscriptions.orderStatus} NOT IN ('canceled', 'failed', 'timeout', 'refunded', 'stuck_timeout_auto_reset', 'stuck_auto_reset'))`,
        );

      if (pendingInscriptions.length === 0) {
        console.log("✅ No pending UniSat orders found");
        return;
      }

      console.log(
        `📋 Found ${pendingInscriptions.length} pending orders to check`,
      );

      for (const inscription of pendingInscriptions) {
        try {
          // Skip if we've already completed this inscription
          if (inscription.orderStatus === "completed") {
            continue;
          }

          await this.updateOrderStatus(inscription);
          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (error) {
          console.error(
            `❌ Error checking order ${inscription.unisatOrderId}:`,
            error,
          );

          await this.handleStuckOrder(inscription);
        }
      }
    } catch (error) {
      console.error("❌ Error in checkAllPendingOrders:", error);
    }
  }

  async updateOrderStatus(inscription: InscriptionRecord) {
    try {
      // Check if we have a valid order ID
      if (!inscription.unisatOrderId) {
        console.warn(
          `⚠️  Inscription ${inscription.id} has no UniSat order ID`,
        );
        return;
      }

      const orderStatus = await unisatService.getOrderStatus(
        inscription.unisatOrderId,
      );

      if (!orderStatus) {
        console.log(
          `⚠️  Could not fetch status for order ${inscription.unisatOrderId}`,
        );
        return;
      }

      console.log(
        `🔄 Checking order status: ${inscription.unisatOrderId} - ${orderStatus.status}`,
      );

      const updateData: Partial<InscriptionRecord> = {};
      const file = orderStatus.files?.[0];

      const isTerminalSuccess =
        orderStatus.status === "payment_withinscription" ||
        orderStatus.status === "minted" ||
        orderStatus.status === "confirmed" ||
        orderStatus.status === "sent" ||
        orderStatus.status === "completed";

      const isFailed =
        orderStatus.status === "canceled" ||
        orderStatus.status === "failed" ||
        orderStatus.status === "timeout" ||
        orderStatus.status === "refunded";

      if (isTerminalSuccess && file?.inscriptionId) {
        // SUCCESS CASE: We have a final status and an inscription ID.
        console.log(
          `✅ Order ${inscription.unisatOrderId} has inscription ID, status: ${orderStatus.status}. Marking as inscribed.`,
        );

        const currentProposal = await db
          .select({ status: proposals.status })
          .from(proposals)
          .where(eq(proposals.id, inscription.proposalId))
          .limit(1);

        if (currentProposal[0]?.status !== "inscribed") {
          await db
            .update(proposals)
            .set({ status: "inscribed", updatedAt: new Date() })
            .where(eq(proposals.id, inscription.proposalId));
          console.log(
            `✅ Proposal ${inscription.proposalId} status updated to inscribed.`,
          );
        }

        updateData.inscriptionId = file.inscriptionId;
        updateData.inscriptionUrl = `https://ordinals.com/inscription/${file.inscriptionId}`;
        if (file.txid) {
          updateData.txid = file.txid;
        }
        updateData.orderStatus = "completed"; // Mark as done
      } else if (isTerminalSuccess && !file?.inscriptionId) {
        // WAITING CASE: Final status, but inscription data not yet populated by UniSat.
        console.log(
          `⏳ Order ${inscription.unisatOrderId} status: ${orderStatus.status}, waiting for inscription data from UniSat.`,
        );
        updateData.orderStatus = orderStatus.status; // Persist the current status
      } else if (isFailed) {
        // FAILURE CASE: Order failed. Reset proposal.
        console.error(
          `❌ Order ${inscription.unisatOrderId} failed with status: ${orderStatus.status}`,
        );

        await db
          .update(proposals)
          .set({
            status: "active",
            firstTimeAsLeader: null,
            leaderStartBlock: null,
            expirationBlock: null,
            updatedAt: new Date(),
          })
          .where(eq(proposals.id, inscription.proposalId));

        updateData.orderStatus = orderStatus.status;
        console.log(
          `🔄 Automatically reset proposal ${inscription.proposalId} status to active for retry`,
        );
      } else {
        // PROCESSING CASE: Still in progress (paid, processing, etc.)
        console.log(
          `⏳ Order ${inscription.unisatOrderId} is processing with status: ${orderStatus.status}...`,
        );
        updateData.orderStatus = orderStatus.status; // Persist current status
      }

      // Finally, update the inscription record in the DB
      if (Object.keys(updateData).length > 0) {
        await db
          .update(inscriptions)
          .set(updateData)
          .where(eq(inscriptions.id, inscription.id));

        console.log(
          `📝 Updated inscription ${inscription.id} with data: ${JSON.stringify(
            updateData,
          )}`,
        );
      }
    } catch (error) {
      console.error(
        `❌ Error updating order status for ${inscription.unisatOrderId}:`,
        error,
      );
    }
  }

  async retryApiCall<T>(
    apiCall: () => Promise<T>,
    maxRetries: number = 3,
  ): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await apiCall();
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }

        const delay = Math.pow(2, attempt) * 1000;
        console.warn(
          `⚠️  API call failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    throw new Error("Max retries exceeded");
  }

  async handleStuckOrder(inscription: InscriptionRecord) {
    try {
      const createdTime = new Date(inscription.createdAt).getTime();
      const now = Date.now();
      const hoursElapsed = (now - createdTime) / (1000 * 60 * 60);
      if (hoursElapsed > 24) {
        console.warn(
          `🚨 Order ${inscription.unisatOrderId} stuck for ${hoursElapsed.toFixed(1)} hours - automatic reset`,
        );

        await db
          .update(proposals)
          .set({ status: "active" })
          .where(eq(proposals.id, inscription.proposalId));
        await db
          .update(inscriptions)
          .set({ orderStatus: "stuck_auto_reset" })
          .where(eq(inscriptions.id, inscription.id));

        console.log(
          `🔄 Automatically reset stuck proposal ${inscription.proposalId} after ${hoursElapsed.toFixed(1)} hours`,
        );
      } else if (hoursElapsed > 6) {
        console.warn(
          `⚠️  Order ${inscription.unisatOrderId} has been pending for ${hoursElapsed.toFixed(1)} hours`,
        );
      }
    } catch (error) {
      console.error(
        `Error handling stuck order ${inscription.unisatOrderId}:`,
        error,
      );
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      lastChecked: this.lastChecked.toISOString(),
    };
  }

  async triggerManually() {
    if (this.isRunning) {
      console.log("⏳ Monitor already running");
      return;
    }

    console.log("🔧 Manually triggering UniSat monitor...");
    this.isRunning = true;
    try {
      await this.checkAllPendingOrders();
      this.lastChecked = new Date();
    } finally {
      this.isRunning = false;
    }
  }
}

declare global {
  var unisatMonitorInstance: UnisatMonitor;
}

function getUnisatMonitorInstance(): UnisatMonitor {
  if (!global.unisatMonitorInstance) {
    console.log("🛠️ Creating new UnisatMonitor instance");
    global.unisatMonitorInstance = new UnisatMonitor();
  }
  return global.unisatMonitorInstance;
}

export const unisatMonitor = getUnisatMonitorInstance();
