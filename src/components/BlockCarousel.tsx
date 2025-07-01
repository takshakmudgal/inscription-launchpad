"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ApiResponse, BlockInfo } from "~/types";

interface RecentBlocksResponse {
  blocks: BlockInfo[];
}

const BlockCard = ({
  block,
  isLatest,
}: {
  block: BlockInfo;
  isLatest: boolean;
}) => (
  <div className="relative pb-1">
    <div className="while-active:cursor-grabbing mr-4 flex h-24 w-32 flex-shrink-0 cursor-grab flex-col items-center justify-center rounded-lg border border-[#f3814b]/40 bg-[#2e1f1a]/50 shadow-md transition-transform duration-300 ease-in-out">
      <div className="font-mono text-sm text-[#fbe6c6]">Block</div>
      <div className="font-mono text-2xl font-bold text-[#fbe6c6]">
        {block.height}
      </div>
      <div className="font-mono text-xs text-[#f3814b]">
        {new Date(block.timestamp * 1000).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })}
      </div>
    </div>
    {isLatest && (
      <motion.div
        className="absolute top-full left-16 mt-1 -translate-x-1/2"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <div className="h-0 w-0 border-x-[16px] border-b-[16px] border-x-transparent border-b-[#f3814b]" />
      </motion.div>
    )}
  </div>
);

export const BlockCarousel = ({
  onLatestBlock,
}: {
  onLatestBlock: (block: BlockInfo | null) => void;
}) => {
  const [blocks, setBlocks] = useState<BlockInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const carouselRef = useRef<HTMLDivElement>(null);
  const constraintsRef = useRef<HTMLDivElement>(null);
  const [showScrollToEnd, setShowScrollToEnd] = useState(false);

  const checkForScrollEnd = useCallback(() => {
    const el = carouselRef.current;
    if (el) {
      const isAtEnd = el.scrollWidth - el.scrollLeft - el.clientWidth < 10;
      setShowScrollToEnd(!isAtEnd);
    }
  }, []);

  const fetchBlocks = useCallback(async () => {
    try {
      const res = await fetch(`/api/blocks/recent?t=${Date.now()}`);
      const data: ApiResponse<RecentBlocksResponse> = await res.json();
      if (data.success && data.data?.blocks) {
        const fetchedBlocks = data.data.blocks;
        setBlocks((prevBlocks) => {
          const existingBlockHeights = new Set(prevBlocks.map((b) => b.height));
          const newBlocks = fetchedBlocks.filter(
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
    } catch (error) {
      console.error("Failed to fetch recent blocks", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (blocks.length > 0) {
      onLatestBlock(blocks[blocks.length - 1] ?? null);
    }
    checkForScrollEnd();
  }, [blocks, onLatestBlock, checkForScrollEnd]);

  useEffect(() => {
    void fetchBlocks();
    const interval = setInterval(fetchBlocks, 12000); // Bitcoin blocks are ~10m, but for demo this is fine.
    return () => clearInterval(interval);
  }, [fetchBlocks]);

  useEffect(() => {
    const el = carouselRef.current;
    if (el && !showScrollToEnd) {
      el.scrollTo({
        left: el.scrollWidth,
        behavior: "smooth",
      });
    }
  }, [blocks, showScrollToEnd]);

  useEffect(() => {
    const el = carouselRef.current;
    if (el) {
      el.addEventListener("scroll", checkForScrollEnd);
      window.addEventListener("resize", checkForScrollEnd);
      checkForScrollEnd(); // Initial check
    }
    return () => {
      if (el) {
        el.removeEventListener("scroll", checkForScrollEnd);
        window.removeEventListener("resize", checkForScrollEnd);
      }
    };
  }, [checkForScrollEnd]);

  const scrollToEnd = () => {
    const el = carouselRef.current;
    if (el) {
      el.scrollTo({ left: el.scrollWidth, behavior: "smooth" });
    }
  };

  if (isLoading && blocks.length === 0) {
    return (
      <div className="w-full overflow-hidden text-white">
        <div className="text-center font-mono text-gray-400">
          Loading recent blocks...
        </div>
      </div>
    );
  }

  return (
    <div className="w-full p-4 text-white">
      <h2 className="mb-2 font-mono text-xl font-bold text-[#f3814b]">
        Recent Blocks
      </h2>
      <div ref={constraintsRef} className="group relative overflow-hidden">
        <motion.div
          ref={carouselRef}
          drag="x"
          dragConstraints={constraintsRef}
          dragTransition={{ bounceStiffness: 600, bounceDamping: 20 }}
          dragElastic={0.1}
          className="flex cursor-grab overflow-x-auto pb-4 active:cursor-grabbing"
          style={
            {
              scrollbarWidth: "none",
              msOverflowStyle: "none",
            } as React.CSSProperties
          }
        >
          <AnimatePresence initial={false}>
            {blocks.map((block, index) => (
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
                  isLatest={index === blocks.length - 1}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>

        <AnimatePresence>
          {showScrollToEnd && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={scrollToEnd}
              className="absolute top-1/2 right-4 z-10 -translate-y-1/2 rounded-full bg-[#b95934]/80 p-2 font-bold text-[#fbe6c6] transition-colors hover:bg-[#f3814b]"
              title="Scroll to latest block"
            >
              &gt;&gt;
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
