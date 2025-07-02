"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import type { ApiResponse, BlockInfo, UpcomingBlock } from "~/types";

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
}

const BlockCard = ({ block }: { block: CarouselBlock }) => {
  const timeAgo = block.timestamp
    ? formatDistanceToNow(new Date(block.timestamp * 1000), {
        addSuffix: true,
      })
    : null;

  const cardClasses = block.isUpcoming
    ? "border-dashed border-blue-500/40 bg-blue-900/20"
    : "border-[#f3814b]/40 bg-[#2e1f1a]/50";

  return (
    <div className="relative pb-1">
      <div
        className={`mr-2 flex h-32 w-36 flex-shrink-0 cursor-grab flex-col justify-between rounded-lg border ${cardClasses} p-2 shadow-md transition-transform duration-300 ease-in-out active:cursor-grabbing sm:h-40 sm:w-48 sm:p-3`}
      >
        <div className="text-center">
          <div className="font-mono text-lg font-bold text-white sm:text-2xl">
            {block.isUpcoming ? `~${block.height}` : block.height}
          </div>
        </div>

        <hr className="my-1 border-t border-white/10 sm:my-2" />

        <div className="space-y-1 text-center font-mono text-white">
          <div className="text-sm font-bold sm:text-lg">
            {`${((block.totalFees ?? 0) / 100_000_000).toFixed(3)} tBTC`}
          </div>
          <div className="text-[10px] text-gray-400 sm:text-xs">
            {(block.tx_count ?? 0).toLocaleString()} transactions
          </div>
        </div>

        <hr className="my-1 border-t border-white/10 sm:my-2" />

        <div className="text-center font-mono text-[10px] text-orange-400 sm:text-xs">
          {block.isUpcoming ? "Upcoming" : timeAgo}
        </div>
      </div>
      {block.isLatestConfirmed && (
        <motion.div
          className="absolute top-full left-1/2 mt-1 -translate-x-1/2"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className="h-0 w-0 border-x-8 border-b-8 border-x-transparent border-b-[#f3814b]" />
        </motion.div>
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
    totalFees: b.extras?.totalFees,
    blockSize: b.size,
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
        }
      : null;

  if (error) {
    return (
      <div className="w-full overflow-hidden p-4 text-center text-red-500">
        <div>Error loading blocks:</div>
        <div className="text-sm text-gray-400">{error}</div>
      </div>
    );
  }

  if (
    isLoading &&
    confirmedCarouselBlocks.length === 0 &&
    !upcomingCarouselBlock
  ) {
    return (
      <div className="w-full overflow-hidden text-white">
        <div className="text-center font-mono text-gray-400">
          Loading recent blocks...
        </div>
      </div>
    );
  }

  return (
    <div className="w-full overflow-hidden py-2 sm:py-4">
      <div className="group relative">
        <motion.div
          ref={carouselRef}
          className="flex cursor-grab snap-x snap-mandatory scroll-px-2 items-center overflow-x-auto px-2 pb-4 active:cursor-grabbing sm:scroll-px-6 sm:px-6"
          style={
            {
              scrollbarWidth: "none",
              msOverflowStyle: "none",
            } as React.CSSProperties
          }
        >
          <AnimatePresence initial={false}>
            {confirmedCarouselBlocks.map((block) => (
              <motion.div
                key={`${block.height}-confirmed`}
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
                className="snap-start"
              >
                <BlockCard block={block} />
              </motion.div>
            ))}
            {upcomingCarouselBlock && [
              <div
                key="separator"
                className="flex h-32 flex-col items-center justify-center self-center px-4 sm:h-40"
              >
                <div className="h-1/3 border-l-2 border-dashed border-gray-500/70" />
                <div className="my-1 text-2xl text-gray-400">⇄</div>
                <div className="h-1/3 border-l-2 border-dashed border-gray-500/70" />
              </div>,
              <motion.div
                key={`${upcomingCarouselBlock.height}-upcoming`}
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
                className="snap-start"
              >
                <BlockCard block={upcomingCarouselBlock} />
              </motion.div>,
            ]}
          </AnimatePresence>
        </motion.div>
        <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-black to-transparent opacity-50 transition-opacity group-hover:opacity-80" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-black to-transparent opacity-50 transition-opacity group-hover:opacity-80" />
      </div>
    </div>
  );
};
