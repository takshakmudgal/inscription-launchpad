import cron from "node-cron";
import { db } from "../db";
import { inscriptions, proposals } from "../db/schema";
import { eq } from "drizzle-orm";
import { unisatService } from "../services/unisat";

interface InscriptionRecord {
  id: number;
  proposalId: number;
  blockHeight: number;
  blockHash: string;
  txid: string;
  inscriptionId: string | null;
  inscriptionUrl: string | null;
  feeRate: number | null;
  totalFees: number | null;
  metadata: string | null;
  unisatOrderId: string | null;
  orderStatus: string | null;
  paymentAddress: string | null;
  paymentAmount: number | null;
  createdAt: Date;
}

class UnisatMonitor {
  private isRunning = false;

  constructor() {
    console.log("🔍 UniSat Monitor initialized");
    this.start();
  }

  /**
   * Start the cron job to monitor UniSat orders
   */
  start() {
    // Check every minute for order updates
    cron.schedule("* * * * *", () => {
      void (async () => {
        if (this.isRunning) {
          console.log("⏳ UniSat monitor already running, skipping...");
          return;
        }

        this.isRunning = true;
        try {
          await this.checkPendingOrders();
        } catch (error) {
          console.error("❌ Error in UniSat monitor:", error);
        } finally {
          this.isRunning = false;
        }
      })();
    });

    console.log("⏰ UniSat monitor cron job started (every minute)");
  }

  /**
   * Check all pending UniSat orders and update their status
   */
  async checkPendingOrders() {
    console.log("🔍 Checking pending UniSat orders...");

    try {
      // Get all inscriptions with pending UniSat orders
      const pendingInscriptions = await db
        .select()
        .from(inscriptions)
        .where(eq(inscriptions.orderStatus, "pending"));

      if (pendingInscriptions.length === 0) {
        console.log("📝 No pending UniSat orders found");
        return;
      }

      console.log(`📊 Found ${pendingInscriptions.length} pending orders`);

      // Check each order
      for (const inscription of pendingInscriptions) {
        if (!inscription.unisatOrderId) {
          continue;
        }

        try {
          await this.updateOrderStatus(inscription);
        } catch (error) {
          console.error(
            `❌ Error updating order ${inscription.unisatOrderId}:`,
            error,
          );
          // Continue with other orders
        }
      }
    } catch (error) {
      console.error("❌ Error in checkPendingOrders:", error);
    }
  }

  /**
   * Update the status of a specific order
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

      // If completed, update with transaction details
      if (orderStatus.status === "sent" || orderStatus.status === "minted") {
        const file = orderStatus.files[0];
        if (file?.txid) {
          updateData.txid = file.txid;
          updateData.inscriptionId = file.inscriptionId;
          updateData.inscriptionUrl = file.inscriptionId
            ? `https://ordinals.com/inscription/${file.inscriptionId}`
            : undefined;

          console.log(
            `✅ Order ${inscription.unisatOrderId} completed! TXID: ${file.txid}`,
          );

          // Also update the proposal status to inscribed
          try {
            await db
              .update(proposals)
              .set({
                status: "inscribed",
                updatedAt: new Date(),
              })
              .where(eq(proposals.id, inscription.proposalId));

            console.log(
              `📝 Proposal ${inscription.proposalId} marked as inscribed`,
            );
          } catch (error) {
            console.error(
              `Error updating proposal ${inscription.proposalId} status:`,
              error,
            );
          }
        }
      }

      if (orderStatus.status === "canceled") {
        console.log(`❌ Order ${inscription.unisatOrderId} was canceled`);
      }

      // Update the database
      await db
        .update(inscriptions)
        .set(updateData)
        .where(eq(inscriptions.id, inscription.id));

      console.log(
        `📝 Updated order ${inscription.unisatOrderId} status to: ${orderStatus.status}`,
      );
    } catch (error) {
      console.error(
        `Error checking order status for ${inscription.unisatOrderId}:`,
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
      lastChecked: new Date().toISOString(),
    };
  }
}

export const unisatMonitor = new UnisatMonitor();
