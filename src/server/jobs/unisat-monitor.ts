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
      const pendingInscriptions = await db
        .select()
        .from(inscriptions)
        .where(
          sql`${inscriptions.unisatOrderId} IS NOT NULL 
              AND (${inscriptions.orderStatus} IS NULL 
                   OR ${inscriptions.orderStatus} NOT IN ('sent', 'minted', 'confirmed', 'completed')
                   OR ${inscriptions.orderStatus} IN ('pending', 'processing', 'inscribing', 'payment_received', 'paid', 'payment_withinscription'))`,
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
    if (!inscription.unisatOrderId) {
      return;
    }

    console.log(`🔄 Checking order status: ${inscription.unisatOrderId}`);

    try {
      if (!inscription.unisatOrderId) {
        console.warn(
          `⚠️  Inscription ${inscription.id} has no UniSat order ID`,
        );
        return;
      }

      const orderStatus = await this.retryApiCall(
        () => unisatService.getOrderStatus(inscription.unisatOrderId!),
        3,
      );

      const updateData: Partial<InscriptionRecord> = {
        orderStatus: orderStatus.status,
      };

      console.log(
        `📊 Order ${inscription.unisatOrderId} status: ${orderStatus.status}`,
      );

      if (
        orderStatus.status === "sent" ||
        orderStatus.status === "minted" ||
        orderStatus.status === "confirmed"
      ) {
        const file = orderStatus.files[0];
        if (orderStatus.status === "minted") {
          console.log(
            `✅ Order minted, updating proposal ${inscription.proposalId} to inscribed status`,
          );

          await db
            .update(proposals)
            .set({ status: "inscribed" })
            .where(eq(proposals.id, inscription.proposalId));

          console.log(
            `📝 Updated proposal ${inscription.proposalId} status to inscribed`,
          );

          if (file?.inscriptionId) {
            updateData.inscriptionId = file.inscriptionId;
            updateData.inscriptionUrl = `https://ordinals.com/inscription/${file.inscriptionId}`;
            console.log(`📝 Added inscription ID: ${file.inscriptionId}`);
          }
          if (file?.txid) {
            updateData.txid = file.txid;
            console.log(`📝 Added transaction ID: ${file.txid}`);
          }
        } else if (file?.txid && file?.inscriptionId) {
          updateData.inscriptionId = file.inscriptionId;
          updateData.txid = file.txid;
          updateData.inscriptionUrl = `https://ordinals.com/inscription/${file.inscriptionId}`;

          console.log(
            `✅ Inscription completed: ${file.inscriptionId} in tx ${file.txid}`,
          );

          await db
            .update(proposals)
            .set({ status: "inscribed" })
            .where(eq(proposals.id, inscription.proposalId));

          console.log(
            `📝 Updated proposal ${inscription.proposalId} status to inscribed`,
          );
        }
      } else if (orderStatus.status === "payment_withinscription") {
        console.log(
          `💰 Order ${inscription.unisatOrderId} payment confirmed, inscription processing...`,
        );
        console.log(
          `💰 Amount paid: ${orderStatus.paidAmount}/${orderStatus.amount} sats`,
        );
        console.log(
          `📁 Files pending: ${orderStatus.pendingCount}, confirmed: ${orderStatus.confirmedCount}`,
        );

        const completedFile = orderStatus.files.find(
          (file: {
            filename: string;
            inscriptionId?: string;
            status: string;
            txid?: string;
          }) => file.inscriptionId && file.txid,
        );

        if (completedFile) {
          console.log(
            `🎯 Inscription completed! ID: ${completedFile.inscriptionId}`,
          );

          updateData.inscriptionId = completedFile.inscriptionId;
          updateData.txid = completedFile.txid;
          updateData.orderStatus = "minted";
          updateData.inscriptionUrl = `https://ordinals.com/inscription/${completedFile.inscriptionId}`;

          await db
            .update(proposals)
            .set({ status: "inscribed" })
            .where(eq(proposals.id, inscription.proposalId));

          console.log(
            `✅ Inscription completed: ${completedFile.inscriptionId} for proposal ${inscription.proposalId}`,
          );
        } else if (
          orderStatus.paidAmount >= orderStatus.amount &&
          orderStatus.pendingCount > 0
        ) {
          const createdTime = new Date(inscription.createdAt).getTime();
          const now = Date.now();
          const hoursElapsed = (now - createdTime) / (1000 * 60 * 60);

          if (hoursElapsed < 2) {
            console.log(
              `⏳ Order ${inscription.unisatOrderId} payment confirmed ${hoursElapsed.toFixed(1)} hours ago, waiting for inscription processing...`,
            );
            await db
              .update(proposals)
              .set({ status: "inscribing" })
              .where(eq(proposals.id, inscription.proposalId));
          } else if (hoursElapsed < 12) {
            console.warn(
              `⚠️  Order ${inscription.unisatOrderId} inscription processing for ${hoursElapsed.toFixed(1)} hours - this may be normal during high network congestion`,
            );
            await db
              .update(proposals)
              .set({ status: "inscribing" })
              .where(eq(proposals.id, inscription.proposalId));
          } else {
            console.error(
              `🚨 Order ${inscription.unisatOrderId} stuck for ${hoursElapsed.toFixed(1)} hours - automatically resetting for retry`,
            );

            updateData.orderStatus = "stuck_timeout_auto_reset";

            await db
              .update(proposals)
              .set({ status: "active" })
              .where(eq(proposals.id, inscription.proposalId));

            console.log(
              `🔄 Automatically reset proposal ${inscription.proposalId} to active for retry after ${hoursElapsed.toFixed(1)} hours`,
            );
          }
        } else if (orderStatus.paidAmount < orderStatus.amount) {
          console.log(
            `⏳ Order ${inscription.unisatOrderId} awaiting payment: ${orderStatus.paidAmount}/${orderStatus.amount} sats`,
          );
          await db
            .update(proposals)
            .set({ status: "inscribing" })
            .where(eq(proposals.id, inscription.proposalId));
        }
      } else if (
        orderStatus.status === "processing" ||
        orderStatus.status === "inscribing" ||
        orderStatus.status === "payment_received" ||
        orderStatus.status === "paid"
      ) {
        console.log(`⏳ Order ${inscription.unisatOrderId} is processing...`);

        await db
          .update(proposals)
          .set({ status: "inscribing" })
          .where(eq(proposals.id, inscription.proposalId));
      } else if (
        orderStatus.status === "canceled" ||
        orderStatus.status === "failed" ||
        orderStatus.status === "timeout" ||
        orderStatus.status === "refunded"
      ) {
        console.error(
          `❌ Order ${inscription.unisatOrderId} failed with status: ${orderStatus.status}`,
        );

        await db
          .update(proposals)
          .set({ status: "active" })
          .where(eq(proposals.id, inscription.proposalId));

        console.log(
          `🔄 Automatically reset proposal ${inscription.proposalId} status to active for retry`,
        );
      }

      await db
        .update(inscriptions)
        .set(updateData)
        .where(eq(inscriptions.id, inscription.id));

      console.log(
        `📝 Updated inscription ${inscription.id} with status: ${orderStatus.status}`,
      );
    } catch (error) {
      console.error(
        `Error updating status for order ${inscription.unisatOrderId}:`,
        error,
      );

      if (error instanceof Error && error.message.includes("API error")) {
        console.warn(
          `🔄 Temporary API error for ${inscription.unisatOrderId}, will retry on next cycle`,
        );
      }
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
