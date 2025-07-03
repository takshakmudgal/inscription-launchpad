"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import type {
  ApiResponse,
  BlockInfo,
  UpcomingBlock,
  Inscription,
} from "~/types";
import { SparklesIcon } from "@heroicons/react/24/outline";

interface RecentBlocksResponse {
  blocks: BlockInfo[];
}

interface UpcomingBlocksResponse {
  blocks: UpcomingBlock[];
}

interface CarouselBlock {
  height: number;
  tx_count: number;
  isUpcoming: boolean;
  isLatestConfirmed: boolean;
  timestamp?: number;
  totalFees?: number;
  blockSize?: number;
  inscription?: Inscription | null;
}

const BlockCard = ({ block }: { block: CarouselBlock }) => {
  const timeAgo = block.timestamp
    ? formatDistanceToNow(new Date(block.timestamp * 1000), {
        addSuffix: true,
      })
    : null;

  const cardClasses = block.isUpcoming
    ? "border-dashed border-blue-500/40 bg-blue-900/20"
    : block.inscription
      ? "border-green-500/40 bg-green-900/20"
      : "border-orange-500/40 bg-orange-900/20";

  return (
    <div className="flex-shrink-0">
      <div className="relative pb-1">
        <div
          className={`mr-1 flex h-20 w-24 flex-shrink-0 cursor-grab flex-col justify-between rounded-lg border ${cardClasses} p-1.5 shadow-md transition-transform duration-200 ease-in-out active:cursor-grabbing sm:mr-1.5 sm:h-28 sm:w-32 lg:mr-2 lg:h-36 lg:w-44`}
        >
          <div className="text-center">
            <div className="font-mono text-xs font-bold text-white sm:text-sm lg:text-xl">
              {block.isUpcoming ? `~${block.height}` : block.height}
            </div>
          </div>

          <hr className="my-0.5 border-t border-white/10 sm:my-1" />

          <div className="space-y-0.5 text-center font-mono text-white">
            <div className="text-xs font-bold sm:text-sm lg:text-base">
              {`${((block.totalFees ?? 0) / 100_000_000).toFixed(3)} tBTC`}
            </div>
            <div className="text-xs text-orange-300 sm:text-xs lg:text-sm">
              {(block.tx_count ?? 0).toLocaleString()} txs
            </div>
          </div>

          {block.inscription && block.inscription.proposal ? (
            <>
              <hr className="my-0.5 border-t border-white/10 sm:my-1" />
              <div className="flex items-center justify-center gap-1 text-center font-mono text-xs text-green-300 sm:text-xs lg:text-sm">
                <SparklesIcon className="h-2.5 w-2.5 text-green-400 sm:h-3 sm:w-3" />
                <span className="truncate">
                  {block.inscription.proposal.ticker}
                </span>
              </div>
            </>
          ) : (
            <hr className="my-0.5 border-t border-white/10 sm:my-1" />
          )}

          <div className="text-center font-mono text-xs text-orange-400 sm:text-xs lg:text-sm">
            {block.isUpcoming ? "Upcoming" : timeAgo}
          </div>
        </div>
        {block.isLatestConfirmed && (
          <motion.div
            className="absolute top-full left-1/2 mt-0.5 -translate-x-1/2 sm:mt-1"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <div className="h-0 w-0 border-x-2 border-b-2 border-x-transparent border-b-orange-500 sm:border-x-4 sm:border-b-4 lg:border-x-6 lg:border-b-6" />
          </motion.div>
        )}
      </div>
      {block.inscription?.proposal && (
        <div className="mt-1 mr-1 w-24 text-center sm:mr-1.5 sm:w-32 lg:mr-2 lg:w-44">
          <p className="px-1 text-[10px] text-green-300 sm:text-xs">
            Proposal #{block.inscription.proposal.id} inscribed
          </p>
        </div>
      )}
    </div>
  );
};

export const BlockCarousel = ({
  onLatestBlock,
}: {
  onLatestBlock: (block: BlockInfo | null) => void;
}) => {
  const [confirmedBlocks, setConfirmedBlocks] = useState<BlockInfo[]>([]);
  const [upcomingBlock, setUpcomingBlock] = useState<UpcomingBlock | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const carouselRef = useRef<HTMLDivElement>(null);

  const fetchConfirmedBlocks = useCallback(async () => {
    try {
      const res = await fetch(`/api/blocks/recent?t=${Date.now()}`);
      if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);
      const data: ApiResponse<RecentBlocksResponse> = await res.json();
      if (data.success && data.data?.blocks) {
        setConfirmedBlocks((prevBlocks) => {
          const blockMap = new Map(prevBlocks.map((b) => [b.height, b]));
          for (const newBlock of data.data!.blocks) {
            blockMap.set(newBlock.height, newBlock);
          }
          const allBlocks = Array.from(blockMap.values()).sort(
            (a, b) => a.height - b.height,
          );
          return allBlocks.slice(-20);
        });
        setError(null);
      } else {
        throw new Error(data.error || "Failed to fetch recent blocks");
      }
    } catch (error) {
      console.error("Failed to fetch recent blocks", error);
      setError(
        error instanceof Error ? error.message : "An unknown error occurred",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchUpcomingBlock = useCallback(async () => {
    try {
      const res = await fetch(`/api/blocks/upcoming?t=${Date.now()}`);
      if (!res.ok) {
        setUpcomingBlock(null);
        return;
      }
      const data: ApiResponse<UpcomingBlocksResponse> = await res.json();
      if (data.success && data.data?.blocks && data.data.blocks.length > 0) {
        setUpcomingBlock(data.data.blocks[0]!);
      } else {
        setUpcomingBlock(null);
      }
    } catch (error) {
      console.error("Failed to fetch upcoming block", error);
      setUpcomingBlock(null);
    }
  }, []);

  useEffect(() => {
    const latestBlock =
      confirmedBlocks.length > 0
        ? confirmedBlocks[confirmedBlocks.length - 1]
        : null;
    onLatestBlock(latestBlock ?? null);
  }, [confirmedBlocks, onLatestBlock]);

  useEffect(() => {
    void fetchConfirmedBlocks();
    void fetchUpcomingBlock();
    const interval = setInterval(() => {
      void fetchConfirmedBlocks();
      void fetchUpcomingBlock();
    }, 12000);
    return () => clearInterval(interval);
  }, [fetchConfirmedBlocks, fetchUpcomingBlock]);

  useEffect(() => {
    if (carouselRef.current) {
      const el = carouselRef.current;
      const timer = setTimeout(() => {
        el.scrollTo({ left: el.scrollWidth, behavior: "smooth" });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [confirmedBlocks, upcomingBlock]);

  const latestConfirmedBlock =
    confirmedBlocks.length > 0
      ? confirmedBlocks[confirmedBlocks.length - 1]
      : null;
  const confirmedCarouselBlocks: CarouselBlock[] = confirmedBlocks.map((b) => ({
    height: b.height,
    tx_count: b.tx_count,
    isUpcoming: false,
    isLatestConfirmed: latestConfirmedBlock?.height === b.height,
    timestamp: b.timestamp,
    totalFees: b.extras.totalFees,
    blockSize: b.size,
    inscription: b.inscription,
  }));

  const upcomingCarouselBlock: CarouselBlock | null =
    upcomingBlock && latestConfirmedBlock
      ? {
          height: latestConfirmedBlock.height + 1,
          tx_count: upcomingBlock.nTx,
          isUpcoming: true,
          isLatestConfirmed: false,
          totalFees: upcomingBlock.totalFees,
          blockSize: upcomingBlock.blockSize,
          inscription: null,
        }
      : null;

  if (error) {
    return (
      <div className="extra-mobile-padding w-full overflow-hidden p-3 text-center text-red-400 sm:p-4">
        <div>Error loading blocks:</div>
        <div className="extra-mobile-text text-xs text-gray-500 sm:text-sm">
          {error}
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="w-full overflow-hidden">
        <div className="extra-mobile-padding mb-3 px-3 text-center sm:mb-4 sm:px-4 lg:px-6">
          <h2 className="extra-mobile-title bg-gradient-to-r from-orange-400 via-orange-300 to-orange-200 bg-clip-text text-lg font-bold text-transparent sm:text-2xl lg:text-3xl">
            Bitcoin Blocks
          </h2>
          <p className="extra-mobile-text text-xs text-white/70 sm:text-sm lg:text-base">
            Real-time Bitcoin blockchain activity
          </p>
        </div>
        <div className="extra-mobile-padding flex gap-1.5 overflow-x-auto px-3 pb-3 sm:gap-2 sm:px-4 sm:pb-4 lg:px-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="mr-1.5 h-24 w-28 flex-shrink-0 animate-pulse rounded-lg border border-orange-500/20 bg-orange-900/20 sm:mr-2 sm:h-32 sm:w-36 lg:h-40 lg:w-48"
            />
          ))}
        </div>
      </div>
    );
  }

  const allBlocks = [
    ...confirmedCarouselBlocks,
    ...(upcomingCarouselBlock ? [upcomingCarouselBlock] : []),
  ];

  return (
    <div className="w-full overflow-hidden">
      <div className="extra-mobile-padding mb-3 px-3 text-center sm:mb-4 sm:px-4 lg:px-6">
        <h2 className="extra-mobile-title bg-gradient-to-r from-orange-400 via-orange-300 to-orange-200 bg-clip-text text-lg font-bold text-transparent sm:text-2xl lg:text-3xl">
          Bitcoin Blocks
        </h2>
        <p className="extra-mobile-text text-xs text-white/70 sm:text-sm lg:text-base">
          Real-time Bitcoin blockchain activity
        </p>
      </div>

      <div
        ref={carouselRef}
        className="scrollbar-hide extra-mobile-padding flex gap-1.5 overflow-x-auto px-3 pb-3 sm:gap-2 sm:px-4 sm:pb-4 lg:px-6"
        style={{
          scrollBehavior: "smooth",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          maxWidth: "100vw",
        }}
      >
        <AnimatePresence mode="popLayout">
          {allBlocks.map((block, index) => (
            <motion.div
              key={`${block.height}-${block.isUpcoming}`}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{
                duration: 0.3,
                delay: Math.min(index * 0.05, 0.5),
              }}
            >
              <BlockCard block={block} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {latestConfirmedBlock && (
        <div className="extra-mobile-padding extra-mobile-text px-3 text-center text-xs text-white/60 sm:px-4 sm:text-sm lg:px-6">
          Latest Block: #{latestConfirmedBlock.height.toLocaleString()} •{" "}
          {formatDistanceToNow(
            new Date(latestConfirmedBlock.timestamp * 1000),
            {
              addSuffix: true,
            },
          )}
        </div>
      )}
    </div>
  );
};
