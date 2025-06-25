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
    // Run every 30 seconds for faster inscription detection
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

  /**
   * Check all pending UniSat orders automatically
   */
  async checkAllPendingOrders() {
    console.log("🔍 Checking pending UniSat orders...");

    try {
      // Get all inscriptions with pending UniSat orders - expanded criteria for automatic processing
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

      // Check each order with automatic retry and recovery
      for (const inscription of pendingInscriptions) {
        try {
          await this.updateOrderStatus(inscription);
          // Small delay to avoid overwhelming UniSat API
          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (error) {
          console.error(
            `❌ Error checking order ${inscription.unisatOrderId}:`,
            error,
          );

          // Automatic recovery for stuck orders
          await this.handleStuckOrder(inscription);

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
      // Check for null unisatOrderId
      if (!inscription.unisatOrderId) {
        console.warn(
          `⚠️  Inscription ${inscription.id} has no UniSat order ID`,
        );
        return;
      }

      // Retry API calls with exponential backoff for automatic recovery
      const orderStatus = await this.retryApiCall(
        () => unisatService.getOrderStatus(inscription.unisatOrderId!),
        3,
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
            updateData.inscriptionUrl = `https://ordinals.com/inscription/${file.inscriptionId}`;
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
          updateData.inscriptionUrl = `https://ordinals.com/inscription/${file.inscriptionId}`;

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

      // Handle payment_withinscription status - this is normal when payment is confirmed but inscription is still processing
      else if (orderStatus.status === "payment_withinscription") {
        console.log(
          `💰 Order ${inscription.unisatOrderId} payment confirmed, inscription processing...`,
        );
        console.log(
          `💰 Amount paid: ${orderStatus.paidAmount}/${orderStatus.amount} sats`,
        );
        console.log(
          `📁 Files pending: ${orderStatus.pendingCount}, confirmed: ${orderStatus.confirmedCount}`,
        );

        // Check if any files have inscription IDs (inscription completed)
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

          // Mark as completed
          updateData.inscriptionId = completedFile.inscriptionId;
          updateData.txid = completedFile.txid;
          updateData.orderStatus = "minted"; // Use standard status
          updateData.inscriptionUrl = `https://ordinals.com/inscription/${completedFile.inscriptionId}`;

          // Update proposal to inscribed
          await db
            .update(proposals)
            .set({ status: "inscribed" })
            .where(eq(proposals.id, inscription.proposalId));

          console.log(
            `✅ Inscription completed: ${completedFile.inscriptionId} for proposal ${inscription.proposalId}`,
          );
        }
        // If payment is complete but files are still pending
        else if (
          orderStatus.paidAmount >= orderStatus.amount &&
          orderStatus.pendingCount > 0
        ) {
          // Check how long it's been since creation
          const createdTime = new Date(inscription.createdAt).getTime();
          const now = Date.now();
          const hoursElapsed = (now - createdTime) / (1000 * 60 * 60);

          // Be more patient - UniSat can take time to process inscriptions
          if (hoursElapsed < 2) {
            console.log(
              `⏳ Order ${inscription.unisatOrderId} payment confirmed ${hoursElapsed.toFixed(1)} hours ago, waiting for inscription processing...`,
            );
            // Keep proposal in inscribing status
            await db
              .update(proposals)
              .set({ status: "inscribing" })
              .where(eq(proposals.id, inscription.proposalId));
          }
          // If it's been 2-12 hours, warn but continue waiting
          else if (hoursElapsed < 12) {
            console.warn(
              `⚠️  Order ${inscription.unisatOrderId} inscription processing for ${hoursElapsed.toFixed(1)} hours - this may be normal during high network congestion`,
            );
            // Keep proposal in inscribing status
            await db
              .update(proposals)
              .set({ status: "inscribing" })
              .where(eq(proposals.id, inscription.proposalId));
          }
          // After 12 hours, consider it stuck and reset
          else {
            console.error(
              `🚨 Order ${inscription.unisatOrderId} stuck for ${hoursElapsed.toFixed(1)} hours - automatically resetting for retry`,
            );

            // Mark this order as stuck and reset proposal for retry
            updateData.orderStatus = "stuck_timeout_auto_reset";

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
        // Payment not complete yet
        else if (orderStatus.paidAmount < orderStatus.amount) {
          console.log(
            `⏳ Order ${inscription.unisatOrderId} awaiting payment: ${orderStatus.paidAmount}/${orderStatus.amount} sats`,
          );
          // Keep proposal in inscribing status
          await db
            .update(proposals)
            .set({ status: "inscribing" })
            .where(eq(proposals.id, inscription.proposalId));
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
   * Retry API calls with exponential backoff for automatic recovery
   */
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

        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
        console.warn(
          `⚠️  API call failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    throw new Error("Max retries exceeded");
  }

  /**
   * Handle stuck orders with automatic recovery
   */
  async handleStuckOrder(inscription: InscriptionRecord) {
    try {
      // Check how long the order has been in the system
      const createdTime = new Date(inscription.createdAt).getTime();
      const now = Date.now();
      const hoursElapsed = (now - createdTime) / (1000 * 60 * 60);

      // If order is older than 24 hours and still not completed, reset it
      if (hoursElapsed > 24) {
        console.warn(
          `🚨 Order ${inscription.unisatOrderId} stuck for ${hoursElapsed.toFixed(1)} hours - automatic reset`,
        );

        // Reset proposal to active for automatic retry
        await db
          .update(proposals)
          .set({ status: "active" })
          .where(eq(proposals.id, inscription.proposalId));

        // Mark inscription as stuck
        await db
          .update(inscriptions)
          .set({ orderStatus: "stuck_auto_reset" })
          .where(eq(inscriptions.id, inscription.id));

        console.log(
          `🔄 Automatically reset stuck proposal ${inscription.proposalId} after ${hoursElapsed.toFixed(1)} hours`,
        );
      }
      // If order is older than 6 hours but less than 24, just log warning
      else if (hoursElapsed > 6) {
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
