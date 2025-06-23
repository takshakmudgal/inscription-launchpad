import axios from "axios";
import { env } from "~/env";
import type { BlockInfo, BitcoinTransaction } from "~/types";

interface EsploraBlock {
  height: number;
  id: string;
  timestamp: number;
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

export class EsploraService {
  private readonly apiUrl: string;
  private readonly axiosInstance;

  constructor() {
    this.apiUrl = env.ESPLORA_API_URL;
    this.axiosInstance = axios.create({
      baseURL: this.apiUrl,
      timeout: 10000,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  /**
   * Get the current block height
   */
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

  /**
   * Get block information by height
   */
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
        height: block.height,
        hash: block.id,
        timestamp: block.timestamp,
      };
    } catch (error) {
      console.error(`Error fetching block at height ${height}:`, error);
      throw new Error(`Failed to fetch block at height ${height}`);
    }
  }

  /**
   * Get block information by hash
   */
  async getBlockByHash(hash: string): Promise<BlockInfo> {
    try {
      const response = await this.axiosInstance.get<EsploraBlock>(
        `/block/${hash}`,
      );
      const block = response.data;

      return {
        height: block.height,
        hash: block.id,
        timestamp: block.timestamp,
      };
    } catch (error) {
      console.error(`Error fetching block with hash ${hash}:`, error);
      throw new Error(`Failed to fetch block with hash ${hash}`);
    }
  }

  /**
   * Get the latest block information
   */
  async getLatestBlock(): Promise<BlockInfo> {
    try {
      const height = await this.getCurrentBlockHeight();
      return await this.getBlockByHeight(height);
    } catch (error) {
      console.error("Error fetching latest block:", error);
      throw new Error("Failed to fetch latest block");
    }
  }

  /**
   * Get transaction information by txid
   */
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

  /**
   * Check if a transaction is confirmed
   */
  async isTransactionConfirmed(txid: string): Promise<boolean> {
    try {
      const tx = await this.getTransaction(txid);
      return tx.confirmations > 0;
    } catch (error) {
      console.error(`Error checking transaction confirmation ${txid}:`, error);
      return false;
    }
  }

  /**
   * Get multiple blocks in batch
   */
  async getBlocksBatch(heights: number[]): Promise<BlockInfo[]> {
    try {
      const promises = heights.map((height) => this.getBlockByHeight(height));
      return await Promise.all(promises);
    } catch (error) {
      console.error("Error fetching blocks batch:", error);
      throw new Error("Failed to fetch blocks batch");
    }
  }

  /**
   * Get fee estimates
   */
  async getFeeEstimates(): Promise<Record<string, number>> {
    try {
      const response =
        await this.axiosInstance.get<Record<string, number>>("/fee-estimates");
      return response.data;
    } catch (error) {
      console.error("Error fetching fee estimates:", error);
      return { "1": 15, "6": 10, "144": 5 }; // Default fallback fees
    }
  }

  /**
   * Get address balance
   */
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

// Export singleton instance
export const esploraService = new EsploraService();
