import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, unlink } from "fs/promises";
import { join } from "path";
import { nanoid } from "nanoid";
import { env } from "~/env";
import type { Proposal, InscriptionPayload } from "~/types";
import { unisatService } from "./unisat";

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
      // Try UniSat first if API key is available
      if (this.unisatApiKey) {
        console.log("Attempting inscription with UniSat...");
        const result = await unisatService.inscribe(proposal, blockHeight);

        // For UniSat, we return the order information
        return {
          txid: result.orderId, // Store order ID as txid initially
          inscriptionId: result.inscriptionId,
          orderId: result.orderId,
          payAddress: result.payAddress,
          paymentAmount: result.paymentAmount,
        };
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
