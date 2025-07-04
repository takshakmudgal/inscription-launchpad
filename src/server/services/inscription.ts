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

  generateInscriptionPayload(
    proposal: Proposal,
    _blockHeight: number,
  ): InscriptionPayload {
    return {
      project: "bitmemes",
      type: "meme-coin-inscription",
      coin: {
        name: proposal.name,
        ticker: proposal.ticker,
        description: proposal.description,
        votes: proposal.totalVotes,
        website: `https://bitpill.fun/proposals/${proposal.id}`,
        twitter: proposal.twitter,
        telegram: proposal.telegram,
      },
    };
  }

  async inscribeWithOrd(
    payload: InscriptionPayload,
  ): Promise<{ txid: string; inscriptionId?: string }> {
    if (!this.walletPath) {
      throw new Error("Ordinals wallet path not configured");
    }

    const tempFileName = `inscription-${nanoid()}.json`;
    const tempFilePath = join(process.cwd(), "tmp", tempFileName);

    try {
      await this.ensureTmpDirectory();
      await writeFile(tempFilePath, JSON.stringify(payload, null, 2));
      const networkFlag = this.network === "testnet" ? "--testnet" : "";
      const command = `ord ${networkFlag} wallet inscribe ${tempFilePath} --fee-rate ${this.feeRate}`;

      console.log(`Executing ord command: ${command}`);

      const { stdout, stderr } = await execAsync(command, {
        cwd: this.walletPath,
        timeout: 300000,
      });

      if (stderr && !stderr.includes("warning")) {
        throw new Error(`Ord command failed: ${stderr}`);
      }

      const output = stdout.trim();
      console.log(`Ord output: ${output}`);
      const txidRegex = /([a-f0-9]{64})/i;
      const txidMatch = txidRegex.exec(output);
      if (!txidMatch) {
        throw new Error("Failed to extract txid from ord output");
      }

      const txid = txidMatch[1]!;

      const inscriptionIdRegex = /([a-f0-9]{64}i\d+)/i;
      const inscriptionIdMatch = inscriptionIdRegex.exec(output);
      const inscriptionId = inscriptionIdMatch?.[1];

      return { txid, inscriptionId };
    } finally {
      try {
        await unlink(tempFilePath);
      } catch (error) {
        console.error("Failed to clean up temp file:", error);
      }
    }
  }

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
              name: `bitmemes-${payload.coin.ticker.toLowerCase()}-inscription.json`,
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
      if (this.unisatApiKey && env.PLATFORM_WALLET_ADDRESS) {
        console.log(
          "Attempting automatic inscription with UniSat platform wallet...",
        );

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

        try {
          console.log("💳 Initiating automatic payment...");

          const walletAddress = await bitcoinWallet.getAddress();
          console.log(`🏦 Platform wallet address: ${walletAddress}`);

          const balance = await bitcoinWallet.getBalance();
          console.log(`💰 Platform wallet balance: ${balance} sats`);

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

            console.log(
              `⚠️ Creating order without automatic payment - manual payment required`,
            );

            return {
              txid: result.orderId,
              inscriptionId: undefined,
              orderId: result.orderId,
              payAddress: result.payAddress,
              paymentAmount: result.amount,
            };
          }

          if (utxos.length === 0) {
            throw new Error("No spendable UTXOs available in wallet");
          }

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

          return {
            txid: paymentResult.txid,
            inscriptionId: undefined,
            orderId: result.orderId,
            payAddress: result.payAddress,
            paymentAmount: result.amount,
          };
        } catch (paymentError) {
          console.error("❌ Automatic payment failed:", paymentError);
          console.error(`   Order ID: ${result.orderId}`);
          console.error(`   Payment address: ${result.payAddress}`);
          console.error(`   Amount: ${result.amount} sats`);

          console.log(
            `⚠️ Falling back to manual payment mode for order ${result.orderId}`,
          );

          return {
            txid: result.orderId,
            inscriptionId: undefined,
            orderId: result.orderId,
            payAddress: result.payAddress,
            paymentAmount: result.amount,
          };
        }
      }

      if (this.ordinalsApiKey) {
        console.log("Attempting inscription with OrdinalsBot...");
        return await this.inscribeWithOrdinalsBot(payload);
      }

      console.log("Attempting inscription with ord CLI...");
      return await this.inscribeWithOrd(payload);
    } catch (error) {
      console.error("Inscription failed:", error);
      throw error;
    }
  }

  private async ensureTmpDirectory(): Promise<void> {
    const tmpDir = join(process.cwd(), "tmp");
    try {
      await import("fs/promises").then((fs) =>
        fs.mkdir(tmpDir, { recursive: true }),
      );
    } catch {}
  }

  validatePayload(payload: InscriptionPayload): boolean {
    return !!(
      payload.project &&
      payload.type &&
      payload.coin?.name &&
      payload.coin?.ticker &&
      payload.coin?.description
    );
  }

  async estimateInscriptionCost(payload: InscriptionPayload): Promise<number> {
    const payloadSize = JSON.stringify(payload).length;
    const baseCost = 546;
    const byteCost = Math.ceil(payloadSize / 4) * this.feeRate;
    return baseCost + byteCost;
  }
}

export const inscriptionService = new InscriptionService();
