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

const UpcomingBlockCard = ({
  block,
  index,
}: {
  block: UpcomingBlock;
  index: number;
}) => {
  const { feeRange, totalFees, nTx } = block;
  let feeText = "N/A";
  if (feeRange && feeRange.length > 1) {
    const first = feeRange[0];
    const last = feeRange[feeRange.length - 1];
    if (first !== undefined && last !== undefined) {
      feeText = `~${first.toFixed(0)} - ${last.toFixed(0)} sat/vB`;
    }
  } else if (feeRange && feeRange.length === 1) {
    const first = feeRange[0];
    if (first !== undefined) {
      feeText = `~${first.toFixed(0)} sat/vB`;
    }
  }

  return (
    <div className="mr-4 flex h-36 w-40 flex-shrink-0 flex-col justify-between rounded-lg border border-red-500/40 bg-red-900/30 p-2 shadow-md sm:h-40 sm:w-48 sm:p-3">
      <div className="text-center font-mono text-xs text-gray-300 sm:text-sm">
        {feeText}
      </div>
      <hr className="my-2 border-t border-white/10" />
      <div className="space-y-1 text-center font-mono text-white">
        <div className="text-base font-bold sm:text-lg">
          {(totalFees / 100_000_000).toFixed(3)} tBTC
        </div>
        <div className="text-2xs text-gray-400 sm:text-xs">
          {nTx.toLocaleString()} transactions
        </div>
      </div>
      <hr className="my-2 border-t border-white/10" />
      <div className="text-2xs text-center font-mono text-red-400 sm:text-xs">
        In ~{(index + 1) * 10} minutes
      </div>
    </div>
  );
};

const Separator = () => (
  <div className="flex h-36 w-8 flex-shrink-0 flex-col items-center justify-center px-1 sm:h-40 sm:w-10 sm:px-2">
    <div className="text-base font-thin text-gray-400 sm:text-lg">↑</div>
    <div className="h-full w-px bg-white/20"></div>
    <div className="text-base font-thin text-gray-400 sm:text-lg">↓</div>
  </div>
);

const BlockCard = ({
  block,
  isLatest,
}: {
  block: BlockInfo;
  isLatest: boolean;
}) => {
  const timeAgo = formatDistanceToNow(new Date((block.timestamp ?? 0) * 1000), {
    addSuffix: true,
  });

  return (
    <div className="relative pb-1">
      <div className="mr-4 flex h-36 w-40 flex-shrink-0 cursor-grab flex-col justify-between rounded-lg border border-[#f3814b]/40 bg-[#2e1f1a]/50 p-2 shadow-md transition-transform duration-300 ease-in-out active:cursor-grabbing sm:h-40 sm:w-48 sm:p-3">
        <div className="text-center">
          <div className="font-mono text-xl font-bold text-white sm:text-2xl">
            {block.height}
          </div>
        </div>

        <hr className="my-2 border-t border-white/10" />

        <div className="space-y-1 text-center font-mono text-white">
          <div className="text-base font-bold sm:text-lg">
            {((block.extras?.totalFees ?? 0) / 100_000_000).toFixed(3)} tBTC
          </div>
          <div className="text-2xs text-gray-400 sm:text-xs">
            {(block.tx_count ?? 0).toLocaleString()} transactions
          </div>
        </div>

        <hr className="my-2 border-t border-white/10" />

        <div className="text-2xs text-center font-mono text-orange-400 sm:text-xs">
          {timeAgo}
        </div>
      </div>
      {isLatest && (
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
  const [upcomingBlocks, setUpcomingBlocks] = useState<UpcomingBlock[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const constraintsRef = useRef<HTMLDivElement>(null);

  const fetchConfirmedBlocks = useCallback(async () => {
    try {
      const res = await fetch(`/api/blocks/recent?t=${Date.now()}`);
      const data: ApiResponse<RecentBlocksResponse> = await res.json();
      if (data.success && data.data?.blocks) {
        if (data.data.blocks.length > 0) {
          setConfirmedBlocks((prevBlocks) => {
            const existingBlockHeights = new Set(
              prevBlocks.map((b) => b.height),
            );
            const newBlocks = data.data!.blocks.filter(
              (b) => !existingBlockHeights.has(b.height),
            );
            if (newBlocks.length > 0) {
              const allBlocks = [...prevBlocks, ...newBlocks].sort(
                (a, b) => a.height - b.height,
              );
              return allBlocks.slice(-20);
            }
            return prevBlocks;
          });
        }
        setError(null);
      } else {
        throw new Error(data.error || "Failed to fetch recent blocks");
      }
    } catch (error) {
      console.error("Failed to fetch recent blocks", error);
      setConfirmedBlocks([]);
      setError(
        error instanceof Error ? error.message : "An unknown error occurred",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchUpcomingBlocks = useCallback(async () => {
    try {
      const res = await fetch(`/api/blocks/upcoming?t=${Date.now()}`);
      const data: ApiResponse<UpcomingBlocksResponse> = await res.json();
      if (data.success && data.data?.blocks) {
        setUpcomingBlocks(data.data.blocks.slice(0, 3));
      }
    } catch (error) {
      console.error("Failed to fetch upcoming blocks", error);
    }
  }, []);

  useEffect(() => {
    if (confirmedBlocks.length > 0) {
      onLatestBlock(confirmedBlocks[confirmedBlocks.length - 1] ?? null);
    }
  }, [confirmedBlocks, onLatestBlock]);

  useEffect(() => {
    void fetchConfirmedBlocks();
    void fetchUpcomingBlocks();
    const interval = setInterval(() => {
      void fetchConfirmedBlocks();
      void fetchUpcomingBlocks();
    }, 12000);
    return () => clearInterval(interval);
  }, [fetchConfirmedBlocks, fetchUpcomingBlocks]);

  useEffect(() => {
    if (!isLoading && carouselRef.current) {
      const el = carouselRef.current;
      el.scrollTo({
        left: el.scrollWidth,
        behavior: "instant",
      });
    }
  }, [isLoading]);

  if (error) {
    return (
      <div className="w-full overflow-hidden p-4 text-center text-red-500">
        <div>Error loading blocks:</div>
        <div className="text-sm text-gray-400">{error}</div>
      </div>
    );
  }

  if (isLoading && confirmedBlocks.length === 0) {
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
      <div ref={constraintsRef} className="group relative">
        <motion.div
          ref={carouselRef}
          drag="x"
          dragConstraints={constraintsRef}
          dragTransition={{ bounceStiffness: 600, bounceDamping: 20 }}
          dragElastic={0.1}
          className="flex cursor-grab items-center overflow-x-auto pb-4 pl-4 active:cursor-grabbing sm:pl-6"
          style={
            {
              scrollbarWidth: "none",
              msOverflowStyle: "none",
            } as React.CSSProperties
          }
        >
          <AnimatePresence initial={false}>
            {confirmedBlocks.map((block, index) => (
              <motion.div
                key={block.height}
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
              >
                <BlockCard
                  block={block}
                  isLatest={index === confirmedBlocks.length - 1}
                />
              </motion.div>
            ))}
          </AnimatePresence>

          {upcomingBlocks.length > 0 && <Separator />}

          {upcomingBlocks.map((block, index) => (
            <UpcomingBlockCard key={index} block={block} index={index} />
          ))}
        </motion.div>
      </div>
    </div>
  );
};
