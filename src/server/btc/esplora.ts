import axios from "axios";
import { env } from "~/env";
import type { BlockInfo, BitcoinTransaction } from "~/types";

interface EsploraBlock {
  id: string;
  height: number;
  version: number;
  timestamp: number;
  tx_count: number;
  size: number;
  weight: number;
  merkle_root: string;
  previousblockhash: string;
  mediantime: number;
  nonce: number;
  bits: number;
  difficulty: number;
  extras?: {
    total_fees: number;
    median_fee: number;
    fee_range: [number, number];
    reward: number;
    pool: {
      id: number;
      name: string;
      slug: string;
    };
  };
}

interface EsploraTransaction {
  txid: string;
  status: {
    confirmed: boolean;
    block_height: number;
    block_hash: string;
  };
  fee: number;
}

interface EsploraAddressStats {
  chain_stats: {
    funded_txo_sum: number;
    spent_txo_sum: number;
  };
  mempool_stats: {
    funded_txo_sum: number;
    spent_txo_sum: number;
  };
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_expires_in: number;
  token_type: string;
  id_token: string;
  "not-before-policy": number;
  scope: string;
}

export class EsploraService {
  private readonly enterpriseApiUrl: string;
  private readonly tokenUrl =
    "https://login.blockstream.com/realms/blockstream-public/protocol/openid-connect/token";
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly axiosInstance;

  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor() {
    this.enterpriseApiUrl =
      env.BITCOIN_NETWORK === "mainnet"
        ? "https://enterprise.blockstream.info/api"
        : "https://enterprise.blockstream.info/testnet/api";

    this.clientId = env.ESPLORA_CLIENT_ID ?? "";
    this.clientSecret = env.ESPLORA_CLIENT_SECRET ?? "";

    this.axiosInstance = axios.create({
      baseURL: this.enterpriseApiUrl,
      timeout: 10000,
      headers: {
        "Content-Type": "application/json",
      },
    });

    this.axiosInstance.interceptors.request.use(async (config) => {
      await this.ensureValidToken();
      if (this.accessToken) {
        config.headers.Authorization = `Bearer ${this.accessToken}`;
      }
      return config;
    });

    this.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          this.accessToken = null;
          this.tokenExpiresAt = 0;
          const originalRequest = error.config;
          if (!originalRequest._retry) {
            originalRequest._retry = true;
            await this.ensureValidToken();
            if (this.accessToken) {
              originalRequest.headers.Authorization = `Bearer ${this.accessToken}`;
            }
            return this.axiosInstance(originalRequest);
          }
        }
        // Reject with the original error, which includes response details
        return Promise.reject(new Error(JSON.stringify(error)));
      },
    );
  }

  private async ensureValidToken(): Promise<void> {
    const now = Date.now();

    if (!this.accessToken || now >= this.tokenExpiresAt - 30000) {
      await this.refreshAccessToken();
    }
  }

  private async refreshAccessToken(): Promise<void> {
    try {
      const params = new URLSearchParams();
      params.append("client_id", this.clientId);
      params.append("client_secret", this.clientSecret);
      params.append("grant_type", "client_credentials");
      params.append("scope", "openid");

      const response = await axios.post<TokenResponse>(this.tokenUrl, params, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        timeout: 10000,
      });

      this.accessToken = response.data.access_token;
      this.tokenExpiresAt = Date.now() + (response.data.expires_in - 30) * 1000;

      console.log("Successfully refreshed Esplora access token");
    } catch (error) {
      console.error("Error refreshing Esplora access token:", error);
      throw new Error("Failed to get Esplora access token");
    }
  }

  async getCurrentBlockHeight(): Promise<number> {
    try {
      const response =
        await this.axiosInstance.get<number>("/blocks/tip/height");
      return response.data;
    } catch (error) {
      console.error("Error fetching current block height:", error);
      throw new Error("Failed to fetch current block height");
    }
  }

  async getBlockByHeight(height: number): Promise<BlockInfo> {
    try {
      const response = await this.axiosInstance.get<string>(
        `/block-height/${height}`,
      );
      const blockHash = response.data;

      const blockResponse = await this.axiosInstance.get<EsploraBlock>(
        `/block/${blockHash}`,
      );
      const block = blockResponse.data;

      return {
        id: block.id,
        height: block.height,
        version: block.version,
        timestamp: block.timestamp,
        tx_count: block.tx_count,
        size: block.size,
        weight: block.weight,
        merkle_root: block.merkle_root,
        previousblockhash: block.previousblockhash,
        mediantime: block.mediantime,
        nonce: block.nonce,
        bits: block.bits,
        difficulty: block.difficulty,
        extras: {
          totalFees: block.extras?.total_fees ?? 0,
          medianFee: block.extras?.median_fee ?? 0,
          feeRange: block.extras?.fee_range ?? [0, 0],
        },
      };
    } catch (error) {
      console.error(`Error fetching block at height ${height}:`, error);
      throw new Error(`Failed to fetch block at height ${height}`);
    }
  }

  async getBlockByHash(hash: string): Promise<BlockInfo> {
    try {
      const response = await this.axiosInstance.get<EsploraBlock>(
        `/block/${hash}`,
      );
      const block = response.data;

      return {
        id: block.id,
        height: block.height,
        version: block.version,
        timestamp: block.timestamp,
        tx_count: block.tx_count,
        size: block.size,
        weight: block.weight,
        merkle_root: block.merkle_root,
        previousblockhash: block.previousblockhash,
        mediantime: block.mediantime,
        nonce: block.nonce,
        bits: block.bits,
        difficulty: block.difficulty,
        extras: {
          totalFees: block.extras?.total_fees ?? 0,
          medianFee: block.extras?.median_fee ?? 0,
          feeRange: block.extras?.fee_range ?? [0, 0],
        },
      };
    } catch (error) {
      console.error(`Error fetching block with hash ${hash}:`, error);
      throw new Error(`Failed to fetch block with hash ${hash}`);
    }
  }

  async getLatestBlock(): Promise<BlockInfo> {
    try {
      const response =
        await this.axiosInstance.get<EsploraBlock>("/blocks/tip");
      const block = response.data;

      return {
        id: block.id,
        height: block.height,
        version: block.version,
        timestamp: block.timestamp,
        tx_count: block.tx_count,
        size: block.size,
        weight: block.weight,
        merkle_root: block.merkle_root,
        previousblockhash: block.previousblockhash,
        mediantime: block.mediantime,
        nonce: block.nonce,
        bits: block.bits,
        difficulty: block.difficulty,
        extras: {
          totalFees: block.extras?.total_fees ?? 0,
          medianFee: block.extras?.median_fee ?? 0,
          feeRange: block.extras?.fee_range ?? [0, 0],
        },
      };
    } catch (error) {
      console.error("Error fetching latest block:", error);
      throw new Error("Failed to fetch latest block");
    }
  }

  async getRecentBlocks(count = 12): Promise<BlockInfo[]> {
    try {
      const height = await this.getCurrentBlockHeight();
      const heights = Array.from({ length: count }, (_, i) => height - i);
      const blocks = await this.getBlocksBatch(heights);
      return blocks.sort((a, b) => a.height - b.height);
    } catch (error) {
      console.error("Error fetching recent blocks:", error);
      throw new Error("Failed to fetch recent blocks");
    }
  }

  async getTransaction(txid: string): Promise<BitcoinTransaction> {
    try {
      const response = await this.axiosInstance.get<EsploraTransaction>(
        `/tx/${txid}`,
      );
      const tx = response.data;

      return {
        txid: tx.txid,
        confirmations: tx.status.confirmed ? tx.status.block_height : 0,
        blockHeight: tx.status.block_height,
        blockHash: tx.status.block_hash,
        fee: tx.fee,
      };
    } catch (error) {
      console.error(`Error fetching transaction ${txid}:`, error);
      throw new Error(`Failed to fetch transaction ${txid}`);
    }
  }

  async isTransactionConfirmed(txid: string): Promise<boolean> {
    try {
      const tx = await this.getTransaction(txid);
      return tx.confirmations > 0;
    } catch (error) {
      console.error(`Error checking transaction confirmation ${txid}:`, error);
      return false;
    }
  }

  async getBlocksBatch(heights: number[]): Promise<BlockInfo[]> {
    try {
      const promises = heights.map((height) => this.getBlockByHeight(height));
      return await Promise.all(promises);
    } catch (error) {
      console.error("Error fetching blocks batch:", error);
      throw new Error("Failed to fetch blocks batch");
    }
  }

  async getFeeEstimates(): Promise<Record<string, number>> {
    try {
      const response =
        await this.axiosInstance.get<Record<string, number>>("/fee-estimates");
      return response.data;
    } catch (error) {
      console.error("Error fetching fee estimates:", error);
      return { "1": 15, "6": 10, "144": 5 };
    }
  }

  async getAddressBalance(
    address: string,
  ): Promise<{ confirmed: number; unconfirmed: number }> {
    try {
      const response = await this.axiosInstance.get<EsploraAddressStats>(
        `/address/${address}`,
      );
      const data = response.data;

      return {
        confirmed:
          data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum,
        unconfirmed:
          data.mempool_stats.funded_txo_sum - data.mempool_stats.spent_txo_sum,
      };
    } catch (error) {
      console.error(`Error fetching balance for address ${address}:`, error);
      throw new Error(`Failed to fetch balance for address ${address}`);
    }
  }
}
export const esploraService = new EsploraService();
