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

  /**
   * Start the cron job to monitor UniSat orders
   */
  start() {
    // Run every 2 minutes to check UniSat order statuses
    cron.schedule("*/2 * * * *", () => {
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

    console.log("⏰ UniSat monitor cron job started (every 2 minutes)");
  }

  /**
   * Check all pending UniSat orders automatically
   */
  async checkAllPendingOrders() {
    console.log("🔍 Checking pending UniSat orders...");

    try {
      // Get all inscriptions with pending UniSat orders
      const pendingInscriptions = await db
        .select()
        .from(inscriptions)
        .where(
          sql`${inscriptions.unisatOrderId} IS NOT NULL 
              AND (${inscriptions.orderStatus} IS NULL 
                   OR ${inscriptions.orderStatus} NOT IN ('sent', 'minted', 'confirmed', 'completed'))`,
        );

      if (pendingInscriptions.length === 0) {
        console.log("✅ No pending UniSat orders found");
        return;
      }

      console.log(
        `📋 Found ${pendingInscriptions.length} pending orders to check`,
      );

      // Check each order with a small delay to avoid rate limiting
      for (const inscription of pendingInscriptions) {
        try {
          await this.updateOrderStatus(inscription);
          // Small delay to avoid overwhelming UniSat API
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (error) {
          console.error(
            `❌ Error checking order ${inscription.unisatOrderId}:`,
            error,
          );
          // Continue with other orders
        }
      }
    } catch (error) {
      console.error("❌ Error in checkAllPendingOrders:", error);
    }
  }

  /**
   * Update the status of a specific order with automatic recovery
   */
  async updateOrderStatus(inscription: InscriptionRecord) {
    if (!inscription.unisatOrderId) {
      return;
    }

    console.log(`🔄 Checking order status: ${inscription.unisatOrderId}`);

    try {
      const orderStatus = await unisatService.getOrderStatus(
        inscription.unisatOrderId,
      );

      // Update database with new status
      const updateData: Partial<InscriptionRecord> = {
        orderStatus: orderStatus.status,
      };

      console.log(
        `📊 Order ${inscription.unisatOrderId} status: ${orderStatus.status}`,
      );

      // Handle completed orders - comprehensive status checking
      if (
        orderStatus.status === "sent" ||
        orderStatus.status === "minted" ||
        orderStatus.status === "confirmed"
      ) {
        const file = orderStatus.files[0];

        // For "minted" status, update proposal even if inscription details aren't fully populated yet
        if (orderStatus.status === "minted") {
          console.log(
            `✅ Order minted, updating proposal ${inscription.proposalId} to inscribed status`,
          );

          // Update proposal status to inscribed
          await db
            .update(proposals)
            .set({ status: "inscribed" })
            .where(eq(proposals.id, inscription.proposalId));

          console.log(
            `📝 Updated proposal ${inscription.proposalId} status to inscribed`,
          );

          // Update inscription details if available
          if (file?.inscriptionId) {
            updateData.inscriptionId = file.inscriptionId;
            console.log(`📝 Added inscription ID: ${file.inscriptionId}`);
          }
          if (file?.txid) {
            updateData.txid = file.txid;
            console.log(`📝 Added transaction ID: ${file.txid}`);
          }
        }
        // For "sent" and "confirmed" statuses, require both txid and inscriptionId
        else if (file?.txid && file?.inscriptionId) {
          updateData.inscriptionId = file.inscriptionId;
          updateData.txid = file.txid;

          console.log(
            `✅ Inscription completed: ${file.inscriptionId} in tx ${file.txid}`,
          );

          // Update proposal status to inscribed
          await db
            .update(proposals)
            .set({ status: "inscribed" })
            .where(eq(proposals.id, inscription.proposalId));

          console.log(
            `📝 Updated proposal ${inscription.proposalId} status to inscribed`,
          );
        }
      }

      // Handle problematic payment_withinscription status with automatic recovery
      else if (orderStatus.status === "payment_withinscription") {
        console.warn(
          `⚠️  Order ${inscription.unisatOrderId} has problematic payment status: payment_withinscription`,
        );
        console.warn(
          `💰 Amount paid: ${orderStatus.paidAmount}/${orderStatus.amount} sats`,
        );
        console.warn(
          `📁 Files pending: ${orderStatus.pendingCount}, confirmed: ${orderStatus.confirmedCount}`,
        );

        // Check if any files have inscription IDs despite the problematic status
        const completedFile = orderStatus.files.find(
          (file) => file.inscriptionId && file.txid,
        );
        if (completedFile) {
          console.log(
            `🎯 Found completed inscription despite payment_withinscription status: ${completedFile.inscriptionId}`,
          );

          // Automatically mark as completed
          updateData.inscriptionId = completedFile.inscriptionId;
          updateData.txid = completedFile.txid;
          updateData.orderStatus = "completed_despite_payment_issue";

          // Update proposal to inscribed
          await db
            .update(proposals)
            .set({ status: "inscribed" })
            .where(eq(proposals.id, inscription.proposalId));

          console.log(
            `✅ Automatically recovered inscription ${completedFile.inscriptionId} for proposal ${inscription.proposalId}`,
          );
        }
        // If payment is complete but files are still pending after reasonable time
        else if (
          orderStatus.paidAmount >= orderStatus.amount &&
          orderStatus.pendingCount > 0
        ) {
          // Check how long it's been since creation
          const createdTime = new Date(inscription.createdAt).getTime();
          const now = Date.now();
          const hoursElapsed = (now - createdTime) / (1000 * 60 * 60);

          // If it's been more than 6 hours and still pending, likely stuck
          if (hoursElapsed > 6) {
            console.warn(
              `🚨 Order ${inscription.unisatOrderId} stuck for ${hoursElapsed.toFixed(1)} hours - automatically resetting`,
            );

            // Mark this order as stuck and reset proposal for retry
            updateData.orderStatus = "stuck_payment_withinscription_auto_reset";

            // Reset proposal to active for automatic retry
            await db
              .update(proposals)
              .set({ status: "active" })
              .where(eq(proposals.id, inscription.proposalId));

            console.log(
              `🔄 Automatically reset proposal ${inscription.proposalId} to active for retry after ${hoursElapsed.toFixed(1)} hours`,
            );
          }
        }
      }

      // Handle intermediate processing statuses automatically
      else if (
        orderStatus.status === "processing" ||
        orderStatus.status === "inscribing" ||
        orderStatus.status === "payment_received" ||
        orderStatus.status === "paid"
      ) {
        console.log(`⏳ Order ${inscription.unisatOrderId} is processing...`);

        // Ensure proposal stays in inscribing status
        await db
          .update(proposals)
          .set({ status: "inscribing" })
          .where(eq(proposals.id, inscription.proposalId));
      }

      // Handle canceled or failed orders automatically
      else if (
        orderStatus.status === "canceled" ||
        orderStatus.status === "failed" ||
        orderStatus.status === "timeout" ||
        orderStatus.status === "refunded"
      ) {
        console.error(
          `❌ Order ${inscription.unisatOrderId} failed with status: ${orderStatus.status}`,
        );

        // Automatically reset proposal to active for retry
        await db
          .update(proposals)
          .set({ status: "active" })
          .where(eq(proposals.id, inscription.proposalId));

        console.log(
          `🔄 Automatically reset proposal ${inscription.proposalId} status to active for retry`,
        );
      }

      // Update inscription record
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

      // If we get API errors, don't fail completely - just log and continue
      // This prevents temporary API issues from breaking the entire monitor
      if (error instanceof Error && error.message.includes("API error")) {
        console.warn(
          `🔄 Temporary API error for ${inscription.unisatOrderId}, will retry on next cycle`,
        );
      }
    }
  }

  /**
   * Get monitor status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastChecked: this.lastChecked.toISOString(),
    };
  }

  /**
   * Manual trigger for testing (keeps existing functionality)
   */
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

export const unisatMonitor = new UnisatMonitor();
