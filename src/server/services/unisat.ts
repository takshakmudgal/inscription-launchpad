import { env } from "~/env";
import type { Proposal, InscriptionPayload } from "~/types";

interface UnisatInscriptionRequest {
  receiveAddress: string;
  feeRate: number;
  outputValue: number;
  files: Array<{
    filename: string;
    dataURL: string;
  }>;
  devAddress?: string;
  devFee?: number;
}

interface UnisatInscriptionResponse {
  code: number;
  msg: string;
  data: {
    orderId: string;
    status: string;
    payAddress: string;
    receiveAddress: string;
    amount: number;
    paidAmount: number;
    outputValue: number;
    feeRate: number;
    minerFee: number;
    serviceFee: number;
    devFee: number;
    files: Array<{
      filename: string;
      inscriptionId: string;
      status: string;
    }>;
    count: number;
    pendingCount: number;
    unconfirmedCount: number;
    confirmedCount: number;
    createTime: number;
    refundTxid: string;
    refundAmount: number;
    refundFeeRate: number;
  };
}

interface UnisatOrderStatus {
  code: number;
  msg: string;
  data: {
    orderId: string;
    status: string;
    payAddress: string;
    receiveAddress: string;
    amount: number;
    paidAmount: number;
    outputValue: number;
    feeRate: number;
    minerFee: number;
    serviceFee: number;
    devFee: number;
    files: Array<{
      filename: string;
      inscriptionId?: string;
      status: string;
      txid?: string;
    }>;
    count: number;
    pendingCount: number;
    unconfirmedCount: number;
    confirmedCount: number;
    createTime: number;
    refundTxid: string;
    refundAmount: number;
    refundFeeRate: number;
  };
}

export class UnisatService {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly network: string;
  private readonly feeRate: number;
  private readonly orderStatusCache = new Map<
    string,
    { timestamp: number; data: UnisatOrderStatus["data"] }
  >();

  private cacheTTL = 60000; // 1 minute cache
  private maxRetries = 5;
  private retryDelay = 2000; // Start with 2 seconds

  constructor() {
    if (!env.UNISAT_API) {
      throw new Error("UNISAT_API key is required");
    }
    this.apiKey = env.UNISAT_API;

    this.network = env.BITCOIN_NETWORK;
    this.feeRate = parseInt(env.INSCRIPTION_FEE_RATE);
    this.baseUrl =
      this.network === "testnet"
        ? "https://open-api-testnet.unisat.io"
        : "https://open-api.unisat.io";
  }

  private getBackoffDelay(attempt: number): number {
    return this.retryDelay * Math.pow(2, attempt) + Math.random() * 1000;
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  generateInscriptionPayload(
    proposal: Proposal,
    blockHeight: number,
  ): InscriptionPayload {
    // Add unique identifiers to ensure each inscription is unique
    const timestamp = Date.now();
    const uniqueId = `${proposal.id}-${blockHeight}-${timestamp}`;

    return {
      project: "bitmemes",
      type: "meme-coin-inscription",
      inscriptionId: uniqueId, // Add unique identifier
      blockHeight: blockHeight, // Add block height
      timestamp: timestamp, // Add timestamp
      coin: {
        name: proposal.name,
        ticker: proposal.ticker,
        description: proposal.description,
        votes: proposal.totalVotes,
        website: `https://bitpill.fun/proposals/${proposal.id}`,
        twitter: proposal.twitter,
        telegram: proposal.telegram,
      },
      // Add metadata to make each inscription unique
      metadata: {
        proposalId: proposal.id,
        inscriptionBlock: blockHeight,
        inscriptionTime: new Date().toISOString(),
        competitionRound: uniqueId,
      },
    };
  }

  async createInscriptionOrder(
    proposal: Proposal,
    blockHeight: number,
    receiveAddress: string,
  ): Promise<{ orderId: string; payAddress: string; amount: number }> {
    const payload = this.generateInscriptionPayload(proposal, blockHeight);

    const jsonString = JSON.stringify(payload, null, 2);
    const dataURL = `data:application/json;base64,${Buffer.from(jsonString).toString("base64")}`;

    // Make filename unique to prevent conflicts
    const timestamp = Date.now();
    const filename = `bitmemes-${proposal.ticker.toLowerCase()}-${proposal.id}-block${blockHeight}-${timestamp}.json`;

    const requestBody: UnisatInscriptionRequest = {
      receiveAddress,
      feeRate: this.feeRate,
      outputValue: 546,
      files: [
        {
          filename,
          dataURL,
        },
      ],
    };

    try {
      console.log(
        `🎯 Creating inscription order for ${proposal.ticker} at block ${blockHeight}`,
      );
      console.log(`📝 Filename: ${filename}`);
      console.log(`📍 Receive address: ${receiveAddress}`);
      console.log(`💰 Fee rate: ${this.feeRate} sat/vB`);

      const response = await fetch(`${this.baseUrl}/v2/inscribe/order/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `❌ UniSat API error response: ${response.status} - ${errorText}`,
        );
        throw new Error(`UniSat API error: ${response.status} - ${errorText}`);
      }

      const result: UnisatInscriptionResponse =
        (await response.json()) as UnisatInscriptionResponse;

      if (result.code !== 0) {
        console.error(
          `❌ UniSat API error code: ${result.code} - ${result.msg}`,
        );
        throw new Error(`UniSat API error: ${result.msg}`);
      }

      console.log(
        `✅ NEW UniSat inscription order created: ${result.data.orderId}`,
      );
      console.log(`📦 Order details:`);
      console.log(`   Order ID: ${result.data.orderId}`);
      console.log(`   Pay Address: ${result.data.payAddress}`);
      console.log(`   Amount: ${result.data.amount} sats`);
      console.log(`   Status: ${result.data.status}`);

      return {
        orderId: result.data.orderId,
        payAddress: result.data.payAddress,
        amount: result.data.amount,
      };
    } catch (error) {
      console.error("❌ UniSat inscription order creation failed:", error);
      throw error;
    }
  }

  async getOrderStatus(orderId: string): Promise<UnisatOrderStatus["data"]> {
    const cached = this.orderStatusCache.get(orderId);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      console.log(`♻️ Returning cached status for order ${orderId}`);
      return cached.data;
    }

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const response = await fetch(
          `${this.baseUrl}/v2/inscribe/order/${orderId}`,
          {
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
            },
          },
        );

        if (response.status === 403 || response.status === 429) {
          const errorText = await response.text();
          console.warn(
            `Rate limit exceeded for order ${orderId}. Retrying... (Attempt ${
              attempt + 1
            })`,
            errorText,
          );
          if (attempt === this.maxRetries - 1) {
            throw new Error(
              `UniSat API error: ${response.status} - ${errorText}`,
            );
          }
          await this.sleep(this.getBackoffDelay(attempt));
          continue;
        }

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `UniSat API error: ${response.status} - ${errorText}`,
          );
        }

        const result: UnisatOrderStatus =
          (await response.json()) as UnisatOrderStatus;

        if (result.code !== 0) {
          throw new Error(`UniSat API error: ${result.msg}`);
        }

        this.orderStatusCache.set(orderId, {
          timestamp: Date.now(),
          data: result.data,
        });

        return result.data;
      } catch (error) {
        console.error(
          `Error getting UniSat order status for ${orderId}:`,
          error,
        );
        if (attempt === this.maxRetries - 1) {
          throw error;
        }
      }
    }
    // This should not be reachable if retries are configured
    throw new Error(`Failed to get order status for ${orderId} after retries.`);
  }

  async waitForInscriptionCompletion(
    orderId: string,
    maxWaitTime = 3600000,
  ): Promise<{ txid: string; inscriptionId?: string }> {
    const startTime = Date.now();
    const pollInterval = 30000;

    while (Date.now() - startTime < maxWaitTime) {
      try {
        const orderStatus = await this.getOrderStatus(orderId);

        if (orderStatus.status === "sent" || orderStatus.status === "minted") {
          const file = orderStatus.files[0];
          if (file?.txid) {
            return {
              txid: file.txid,
              inscriptionId: file.inscriptionId,
            };
          }
        }

        if (orderStatus.status === "canceled") {
          throw new Error("UniSat inscription order was canceled");
        }

        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      } catch (error) {
        console.error("Error checking inscription status:", error);
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      }
    }

    throw new Error("Inscription order timed out");
  }

  async inscribe(
    proposal: Proposal,
    blockHeight: number,
    receiveAddress?: string,
  ): Promise<{
    txid: string;
    inscriptionId?: string;
    orderId: string;
    payAddress: string;
    paymentAmount: number;
  }> {
    console.log(
      `🎯 Creating UniSat inscription for proposal ${proposal.id} (${proposal.ticker}) at block ${blockHeight}`,
    );

    const defaultReceiveAddress = receiveAddress ?? env.UNISAT_RECEIVE_ADDRESS;

    if (!defaultReceiveAddress) {
      throw new Error("No receive address provided for inscription");
    }

    try {
      const order = await this.createInscriptionOrder(
        proposal,
        blockHeight,
        defaultReceiveAddress,
      );

      console.log(
        `📦 NEW Order created: ${order.orderId}, Payment: ${order.amount} sats to ${order.payAddress}`,
      );

      console.log("⚠️  Manual payment required to complete inscription");
      console.log(`💰 Send ${order.amount} sats to ${order.payAddress}`);

      return {
        txid: "pending",
        inscriptionId: undefined,
        orderId: order.orderId,
        payAddress: order.payAddress,
        paymentAmount: order.amount,
      };
    } catch (error) {
      console.error("UniSat inscription failed:", error);
      throw error;
    }
  }
}

export const unisatService = new UnisatService();
