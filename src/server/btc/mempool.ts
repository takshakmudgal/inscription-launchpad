import axios from "axios";
import { env } from "~/env";
import type { UpcomingBlock, BlockInfo } from "~/types";

export class MempoolService {
  private readonly mempoolApiUrl: string;
  private readonly axiosInstance;

  constructor() {
    this.mempoolApiUrl =
      env.BITCOIN_NETWORK === "mainnet"
        ? "https://mempool.space/api/v1"
        : "https://mempool.space/testnet/api/v1";

    this.axiosInstance = axios.create({
      baseURL: this.mempoolApiUrl,
      timeout: 10000,
    });
  }

  async getBlocks(): Promise<BlockInfo[]> {
    try {
      const response = await this.axiosInstance.get<BlockInfo[]>("/blocks");
      return response.data;
    } catch (error) {
      console.error("Error fetching blocks:", error);
      throw new Error("Failed to fetch blocks");
    }
  }

  async getMempoolBlocks(): Promise<UpcomingBlock[]> {
    try {
      const response = await this.axiosInstance.get<UpcomingBlock[]>(
        "/fees/mempool-blocks",
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching mempool blocks:", error);
      throw new Error("Failed to fetch mempool blocks");
    }
  }
}

export const mempoolService = new MempoolService();
