import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, unlink } from "fs/promises";
import { join } from "path";
import { nanoid } from "nanoid";
import { env } from "~/env";
import type { Proposal, InscriptionPayload } from "~/types";
import { unisatService } from "./unisat";
import { bitcoinWallet } from "./bitcoin-wallet";

const execAsync = promisify(exec);

export class InscriptionService {
  private readonly network: string;
  private readonly feeRate: number;
  private readonly walletPath?: string;
  private readonly ordinalsApiKey?: string;
  private readonly unisatApiKey?: string;

  constructor() {
    this.network = env.BITCOIN_NETWORK;
    this.feeRate = parseInt(env.INSCRIPTION_FEE_RATE);
    this.walletPath = env.ORDINALS_WALLET_PATH;
    this.ordinalsApiKey = env.ORDINALSBOT_API_KEY;
    this.unisatApiKey = env.UNISAT_API;
  }

  /**
   * Generate inscription payload JSON
   */
  generateInscriptionPayload(
    proposal: Proposal,
    blockHeight: number,
  ): InscriptionPayload {
    return {
      project: "bitmemes",
      type: "meme-coin-inscription",
      block: blockHeight,
      coin: {
        name: proposal.name,
        ticker: proposal.ticker,
        description: proposal.description,
        votes: proposal.totalVotes,
        website: proposal.website,
        twitter: proposal.twitter,
        telegram: proposal.telegram,
      },
    };
  }

  /**
   * Inscribe using ord CLI
   */
  async inscribeWithOrd(
    payload: InscriptionPayload,
  ): Promise<{ txid: string; inscriptionId?: string }> {
    if (!this.walletPath) {
      throw new Error("Ordinals wallet path not configured");
    }

    const tempFileName = `inscription-${nanoid()}.json`;
    const tempFilePath = join(process.cwd(), "tmp", tempFileName);

    try {
      // Ensure tmp directory exists
      await this.ensureTmpDirectory();

      // Write payload to temporary file
      await writeFile(tempFilePath, JSON.stringify(payload, null, 2));

      // Build ord command
      const networkFlag = this.network === "testnet" ? "--testnet" : "";
      const command = `ord ${networkFlag} wallet inscribe ${tempFilePath} --fee-rate ${this.feeRate}`;

      console.log(`Executing ord command: ${command}`);

      // Execute ord command
      const { stdout, stderr } = await execAsync(command, {
        cwd: this.walletPath,
        timeout: 300000, // 5 minute timeout
      });

      if (stderr && !stderr.includes("warning")) {
        throw new Error(`Ord command failed: ${stderr}`);
      }

      // Parse output to extract txid and inscription ID
      const output = stdout.trim();
      console.log(`Ord output: ${output}`);

      // Extract txid from output (format varies by ord version)
      const txidRegex = /([a-f0-9]{64})/i;
      const txidMatch = txidRegex.exec(output);
      if (!txidMatch) {
        throw new Error("Failed to extract txid from ord output");
      }

      const txid = txidMatch[1]!;

      // Extract inscription ID if available
      const inscriptionIdRegex = /([a-f0-9]{64}i\d+)/i;
      const inscriptionIdMatch = inscriptionIdRegex.exec(output);
      const inscriptionId = inscriptionIdMatch?.[1];

      return { txid, inscriptionId };
    } finally {
      // Clean up temp file
      try {
        await unlink(tempFilePath);
      } catch (error) {
        console.error("Failed to clean up temp file:", error);
      }
    }
  }

  /**
   * Inscribe using OrdinalsBot API
   */
  async inscribeWithOrdinalsBot(
    payload: InscriptionPayload,
  ): Promise<{ txid: string; inscriptionId?: string }> {
    if (!this.ordinalsApiKey) {
      throw new Error("OrdinalsBot API key not configured");
    }

    const apiUrl =
      this.network === "testnet"
        ? "https://api.ordinalsbot.com/testnet"
        : "https://api.ordinalsbot.com";

    try {
      const response = await fetch(`${apiUrl}/inscribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.ordinalsApiKey}`,
        },
        body: JSON.stringify({
          files: [
            {
              name: `bitmemes-${payload.coin.ticker.toLowerCase()}-${payload.block}.json`,
              content: JSON.stringify(payload, null, 2),
              type: "application/json",
            },
          ],
          fee_rate: this.feeRate,
          project: "bitmemes",
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OrdinalsBot API error: ${error}`);
      }

      const result = (await response.json()) as {
        txid: string;
        inscription_id?: string;
      };

      return {
        txid: result.txid,
        inscriptionId: result.inscription_id,
      };
    } catch (error) {
      console.error("OrdinalsBot inscription failed:", error);
      throw error;
    }
  }

  /**
   * Main inscription method that tries UniSat first, then OrdinalsBot, then falls back to ord CLI
   */
  async inscribe(
    proposal: Proposal,
    blockHeight: number,
  ): Promise<{
    txid: string;
    inscriptionId?: string;
    orderId?: string;
    payAddress?: string;
    paymentAmount?: number;
  }> {
    const payload = this.generateInscriptionPayload(proposal, blockHeight);

    console.log(
      `Inscribing proposal ${proposal.id} (${proposal.ticker}) for block ${blockHeight}`,
    );

    try {
      // Try UniSat first if API key is available and platform wallet is configured
      if (this.unisatApiKey && env.PLATFORM_WALLET_ADDRESS) {
        console.log(
          "Attempting automatic inscription with UniSat platform wallet...",
        );

        // Use platform wallet address for automatic inscription
        const result = await unisatService.createInscriptionOrder(
          proposal,
          blockHeight,
          env.PLATFORM_WALLET_ADDRESS,
        );

        console.log(
          `Platform wallet inscription order created: ${result.orderId}`,
        );
        console.log(
          `Payment required: ${result.amount} sats to ${result.payAddress}`,
        );

        // AUTOMATIC PAYMENT: Use platform wallet to pay for inscription
        try {
          console.log("💳 Initiating automatic payment...");

          // Validate wallet configuration first
          const walletAddress = await bitcoinWallet.getAddress();
          console.log(`🏦 Platform wallet address: ${walletAddress}`);

          // Check wallet balance first
          const balance = await bitcoinWallet.getBalance();
          console.log(`💰 Platform wallet balance: ${balance} sats`);

          // Also check UTXOs to ensure we have spendable funds
          const utxos = await bitcoinWallet.getUTXOs();
          console.log(
            `📦 Available UTXOs: ${utxos.length} (total: ${utxos.reduce((sum, u) => sum + u.value, 0)} sats)`,
          );

          if (balance < result.amount) {
            const deficit = result.amount - balance;
            console.error(
              `❌ Insufficient balance for order ${result.orderId}`,
            );
            console.error(`   Required: ${result.amount} sats`);
            console.error(`   Available: ${balance} sats`);
            console.error(`   Deficit: ${deficit} sats`);

            // Instead of throwing, create order without payment for manual processing
            console.log(
              `⚠️ Creating order without automatic payment - manual payment required`,
            );

            return {
              txid: result.orderId, // Store order ID as txid initially
              inscriptionId: undefined, // Will be set when order completes
              orderId: result.orderId,
              payAddress: result.payAddress,
              paymentAmount: result.amount,
            };
          }

          if (utxos.length === 0) {
            throw new Error("No spendable UTXOs available in wallet");
          }

          // Send payment automatically
          console.log(
            `🚀 Sending payment: ${result.amount} sats to ${result.payAddress}`,
          );
          const paymentResult = await bitcoinWallet.sendPayment({
            toAddress: result.payAddress,
            amount: result.amount,
            feeRate: parseInt(env.INSCRIPTION_FEE_RATE),
          });

          console.log(`🎉 Automatic payment successful!`);
          console.log(`   Payment TXID: ${paymentResult.txid}`);
          console.log(`   Amount paid: ${result.amount} sats`);
          console.log(`   Fee: ${paymentResult.fee} sats`);
          console.log(`   Order ID: ${result.orderId}`);

          // Start monitoring payment confirmation in background
          bitcoinWallet
            .waitForConfirmation(paymentResult.txid)
            .then((confirmed) => {
              if (confirmed) {
                console.log(`✅ Payment confirmed for order ${result.orderId}`);
              } else {
                console.log(
                  `⚠️ Payment confirmation timeout for order ${result.orderId}`,
                );
              }
            })
            .catch((error) => {
              console.error(
                `❌ Payment monitoring error for order ${result.orderId}:`,
                error,
              );
            });

          // Return order info with payment txid for tracking
          return {
            txid: paymentResult.txid, // Store actual payment txid
            inscriptionId: undefined, // Will be set when order completes
            orderId: result.orderId,
            payAddress: result.payAddress,
            paymentAmount: result.amount,
          };
        } catch (paymentError) {
          console.error("❌ Automatic payment failed:", paymentError);
          console.error(`   Order ID: ${result.orderId}`);
          console.error(`   Payment address: ${result.payAddress}`);
          console.error(`   Amount: ${result.amount} sats`);

          // Don't throw error - create order for manual payment instead
          console.log(
            `⚠️ Falling back to manual payment mode for order ${result.orderId}`,
          );

          return {
            txid: result.orderId, // Store order ID as txid initially
            inscriptionId: undefined, // Will be set when order completes
            orderId: result.orderId,
            payAddress: result.payAddress,
            paymentAmount: result.amount,
          };
        }

        // This code block has been moved above to handle both payment success and fallback cases
      }

      // Fall back to OrdinalsBot if API key is available
      if (this.ordinalsApiKey) {
        console.log("Attempting inscription with OrdinalsBot...");
        return await this.inscribeWithOrdinalsBot(payload);
      }

      // Fall back to ord CLI
      console.log("Attempting inscription with ord CLI...");
      return await this.inscribeWithOrd(payload);
    } catch (error) {
      console.error("Inscription failed:", error);
      throw error;
    }
  }

  /**
   * Ensure temporary directory exists
   */
  private async ensureTmpDirectory(): Promise<void> {
    const tmpDir = join(process.cwd(), "tmp");
    try {
      await import("fs/promises").then((fs) =>
        fs.mkdir(tmpDir, { recursive: true }),
      );
    } catch {
      // Directory might already exist
    }
  }

  /**
   * Validate inscription payload
   */
  validatePayload(payload: InscriptionPayload): boolean {
    return !!(
      payload.project &&
      payload.type &&
      payload.block &&
      payload.coin?.name &&
      payload.coin?.ticker &&
      payload.coin?.description
    );
  }

  /**
   * Estimate inscription cost
   */
  async estimateInscriptionCost(payload: InscriptionPayload): Promise<number> {
    const payloadSize = JSON.stringify(payload).length;
    const baseCost = 546; // Dust limit
    const byteCost = Math.ceil(payloadSize / 4) * this.feeRate; // Rough estimate
    return baseCost + byteCost;
  }
}

// Export singleton instance
export const inscriptionService = new InscriptionService();
