import axios, { type AxiosInstance } from "axios";
import { env } from "~/env";
import type { UpcomingBlock, BlockInfo } from "~/types";
import { db } from "~/server/db";
import { inscriptions, proposals } from "~/server/db/schema";
import { inArray, eq } from "drizzle-orm";

export class MempoolService {
  private readonly mempoolApiUrl: string;
  private axiosInstance: AxiosInstance;

  constructor() {
    this.mempoolApiUrl =
      env.BITCOIN_NETWORK === "mainnet"
        ? "https://mempool.space/api/v1"
        : "https://mempool.space/testnet/api/v1";

    this.axiosInstance = axios.create({
      baseURL: this.mempoolApiUrl,
      timeout: 10000,
      headers: {
        "User-Agent": "BitPill/1.0",
      },
    });
  }

  async getBlocks(limit = 25): Promise<BlockInfo[]> {
    let blockData: BlockInfo[] = [];
    try {
      const response = await this.axiosInstance.get<BlockInfo[]>("/blocks");
      blockData = response.data;
    } catch (error) {
      console.error("Error fetching blocks from mempool.space:", error);

      // If mempool.space API fails, try to return cached/fallback data instead of throwing
      if (axios.isAxiosError(error)) {
        console.error("Axios error response:", error.response?.data);

        // For now, return empty array to prevent crashes
        // In a production app, you might want to implement a cache here
        console.warn("Mempool API unavailable, returning empty block data");
        return [];
      }

      // Only throw if it's not a network/API issue
      if (
        !(error instanceof Error) ||
        !error.message.includes("Request failed")
      ) {
        throw new Error("Failed to fetch blocks from mempool.space API");
      }

      // Return empty array for network errors
      console.warn("Network error, returning empty block data");
      return [];
    }

    try {
      // Process and enhance block data
      if (!Array.isArray(blockData)) {
        console.error(
          "Unexpected data format from mempool.space. Expected an array.",
          blockData,
        );
        return [];
      }

      const blocks = blockData.slice(0, limit);
      const blockHeights = blocks.map((b) => b.height);

      // Fetch inscriptions for these blocks if any block heights exist
      if (blockHeights.length > 0) {
        try {
          const inscribedRecords = await db
            .select()
            .from(inscriptions)
            .where(inArray(inscriptions.blockHeight, blockHeights))
            .leftJoin(proposals, eq(inscriptions.proposalId, proposals.id));

          const inscriptionsMap = new Map<number, any>();
          for (const record of inscribedRecords) {
            inscriptionsMap.set(record.inscription.blockHeight, {
              ...record.inscription,
              proposal: record.proposal,
            });
          }

          // Attach inscriptions to blocks
          for (const block of blocks) {
            if (inscriptionsMap.has(block.height)) {
              block.inscription = inscriptionsMap.get(block.height);
            }
          }
        } catch (dbError) {
          console.error("Error fetching inscriptions for blocks:", dbError);
          // Continue without inscription data rather than failing
        }
      }

      const processedBlocks = blocks.map((block) => ({
        ...block,
        extras: {
          totalFees: block.extras?.totalFees ?? 0,
          medianFee: block.extras?.medianFee ?? 0,
          feeRange: block.extras?.feeRange ?? [0, 0, 0, 0, 0, 0, 0],
        },
        inscription: block.inscription ?? null,
      }));

      return processedBlocks;
    } catch (processingError) {
      console.error("Error processing block data:", processingError);
      // Return basic block data even if processing fails
      return blockData.slice(0, limit).map((block) => ({
        ...block,
        extras: block.extras ?? {},
        inscription: null,
      }));
    }
  }

  async getBlock(hash: string): Promise<BlockInfo | null> {
    try {
      const response = await this.axiosInstance.get<BlockInfo>(
        `/block/${hash}`,
      );
      return {
        ...response.data,
        extras: response.data.extras ?? {},
        inscription: null,
      };
    } catch (error) {
      console.error(`Error fetching block ${hash}:`, error);
      return null;
    }
  }

  async getBlockHeight(): Promise<number | null> {
    try {
      const response =
        await this.axiosInstance.get<number>("/blocks/tip/height");
      return response.data;
    } catch (error) {
      console.error("Error fetching block height:", error);
      return null;
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
