import axios, { type AxiosInstance, type AxiosResponse } from "axios";
import { env } from "~/env";
import type { UpcomingBlock, BlockInfo } from "~/types";
import { db } from "~/server/db";
import { inscriptions, proposals } from "~/server/db/schema";
import { inArray, eq } from "drizzle-orm";

export class MempoolService {
  private readonly mempoolApiUrl: string;
  private axiosInstance: AxiosInstance;
  private lastSuccessfulFetch: {
    blocks: BlockInfo[];
    mempoolBlocks: UpcomingBlock[];
    timestamp: number;
  } | null = null;
  private maxRetries = 3;
  private retryDelay = 1000; // Start with 1 second
  /**
   * Minimum interval (in ms) before we hit the remote API again when we already
   * have a successful response cached.  This helps to dramatically reduce the
   * number of outbound requests ‑ especially when multiple API routes are
   * called in quick succession – and therefore prevents us from spamming the
   * mempool.space endpoint which often results in connection timeouts in a
   * server-less environment.
   */
  private cacheTTL = 60_000; // 1 minute

  constructor() {
    this.mempoolApiUrl =
      env.BITCOIN_NETWORK === "mainnet"
        ? "https://mempool.space/api/v1"
        : "https://mempool.space/testnet/api/v1";

    this.axiosInstance = axios.create({
      baseURL: this.mempoolApiUrl,
      timeout: 15000, // Increased timeout to 15 seconds
      headers: {
        "User-Agent": "BitPill/1.0",
      },
    });
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private getBackoffDelay(retryAttempts: number): number {
    return Math.min(this.retryDelay * Math.pow(2, retryAttempts), 30000);
  }

  private async requestWithRetry<T>(
    request: () => Promise<AxiosResponse<T>>,
  ): Promise<AxiosResponse<T> | null> {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        return await request();
      } catch (err) {
        lastError = err as Error;
        if (attempt < this.maxRetries - 1) {
          const delay = this.getBackoffDelay(attempt);
          await this.sleep(delay);
        }
      }
    }
    if (lastError) {
      throw lastError;
    }
    return null;
  }

  async getBlocks(limit = 25): Promise<BlockInfo[]> {
    // Return the cached value if it is still considered fresh so we don't make
    // unnecessary network calls every time the endpoint is hit.
    if (
      this.lastSuccessfulFetch &&
      Date.now() - this.lastSuccessfulFetch.timestamp < this.cacheTTL &&
      this.lastSuccessfulFetch.blocks.length > 0
    ) {
      return this.lastSuccessfulFetch.blocks.slice(0, limit);
    }

    let blockData: BlockInfo[] = [];
    try {
      // Retry the request a few times with exponential back-off. This deals
      // gracefully with temporary hiccups or rate-limits on the upstream API.
      const response = await this.requestWithRetry(() =>
        this.axiosInstance.get<BlockInfo[]>("/blocks"),
      );

      // If for some reason we still don't have a response, return an empty array
      if (!response) return [];

      blockData = response.data;

      // Cache successful response
      if (this.lastSuccessfulFetch) {
        this.lastSuccessfulFetch.blocks = blockData;
        this.lastSuccessfulFetch.timestamp = Date.now();
      } else {
        this.lastSuccessfulFetch = {
          blocks: blockData,
          mempoolBlocks: [],
          timestamp: Date.now(),
        };
      }
    } catch (error) {
      console.error("Error fetching blocks from mempool.space:", error);

      // If mempool.space API fails, try to return cached/fallback data instead of throwing
      if (axios.isAxiosError(error)) {
        console.error("Axios error response:", error.response?.data);

        // Check if we have cached data less than 5 minutes old
        if (
          this.lastSuccessfulFetch &&
          Date.now() - this.lastSuccessfulFetch.timestamp < 300000
        ) {
          console.warn("Mempool API unavailable, returning cached block data");
          return this.lastSuccessfulFetch.blocks;
        }

        // For now, return empty array to prevent crashes
        console.warn("Mempool API unavailable, returning empty block data");
        return [];
      }

      // Only throw if it's not a network/API issue
      if (
        !(error instanceof Error) ||
        !error.message.includes("Request failed")
      ) {
        console.warn("Network error, returning empty block data");
        return [];
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
    // Return cached mempool data if it is still fresh
    if (
      this.lastSuccessfulFetch &&
      Date.now() - this.lastSuccessfulFetch.timestamp < this.cacheTTL &&
      this.lastSuccessfulFetch.mempoolBlocks.length > 0
    ) {
      return this.lastSuccessfulFetch.mempoolBlocks;
    }

    try {
      // Retry the request a few times with exponential back-off. This deals
      // gracefully with temporary hiccups or rate-limits on the upstream API.
      const response = await this.requestWithRetry(() =>
        this.axiosInstance.get<UpcomingBlock[]>("/fees/mempool-blocks"),
      );

      if (!response) return [];

      const mempoolBlocks = response.data;

      if (this.lastSuccessfulFetch) {
        this.lastSuccessfulFetch.mempoolBlocks = mempoolBlocks;
        this.lastSuccessfulFetch.timestamp = Date.now();
      } else {
        this.lastSuccessfulFetch = {
          blocks: [],
          mempoolBlocks,
          timestamp: Date.now(),
        };
      }

      return mempoolBlocks;
    } catch (error) {
      console.error("Error fetching mempool blocks:", error);
      // If mempool.space API fails, try to return cached/fallback data
      if (axios.isAxiosError(error)) {
        console.error("Axios error response:", error.response?.data);
      }

      // Check if we have cached data less than 5 minutes old
      if (
        this.lastSuccessfulFetch &&
        Date.now() - this.lastSuccessfulFetch.timestamp < 300000 &&
        this.lastSuccessfulFetch.mempoolBlocks.length > 0
      ) {
        console.warn("Mempool API unavailable, returning cached mempool data");
        return this.lastSuccessfulFetch.mempoolBlocks;
      }
      // For now, return empty array to prevent crashes
      console.warn("Mempool API unavailable, returning empty mempool data");
      return [];
    }
  }

  async getRecommendedFees() {
    try {
      const response = await this.axiosInstance.get("/fees/recommended");
      return response.data;
    } catch (error) {
      console.error("Error fetching recommended fees:", error);
      return null;
    }
  }
}

export const mempoolService = new MempoolService();
