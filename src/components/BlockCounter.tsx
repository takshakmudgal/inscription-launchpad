"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface BlockData {
  currentBlock: number;
  lastBlock: number;
  nextBlock: number;
  timeToNext: number;
  avgBlockTime: number;
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function LightningBolts() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: 3 }, (_, i) => (
        <motion.div
          key={i}
          className="absolute text-2xl text-yellow-400/20"
          initial={{
            x: Math.random() * 400,
            y: Math.random() * 200,
            opacity: 0,
          }}
          animate={{
            x: Math.random() * 400,
            y: Math.random() * 200,
            opacity: [0, 1, 0],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            delay: i * 0.7,
            ease: "easeInOut",
          }}
        >
          LIVE
        </motion.div>
      ))}
    </div>
  );
}

function EnergyRings() {
  return (
    <div className="pointer-events-none absolute inset-0">
      {Array.from({ length: 3 }, (_, i) => (
        <motion.div
          key={i}
          className="absolute inset-0 rounded-2xl border border-white/10"
          animate={{
            scale: [1, 1.05, 1],
            opacity: [0.2, 0.5, 0.2],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            delay: i * 1,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

export function BlockCounter() {
  const [blockData, setBlockData] = useState<BlockData>({
    currentBlock: 4546377,
    lastBlock: 4546376,
    nextBlock: 4546378,
    timeToNext: 600,
    avgBlockTime: 600,
  });

  const [timeRemaining, setTimeRemaining] = useState(blockData.timeToNext);
  const [isNewBlock, setIsNewBlock] = useState(false);

  useEffect(() => {
    const fetchBlockData = async () => {
      try {
        interface BlockApiResponse {
          success: boolean;
          block?: {
            height: number;
          };
          estimatedTimeToNext?: number;
        }

        const response = await fetch("/api/blocks/latest");
        if (response.ok) {
          const data = (await response.json()) as BlockApiResponse;
          if (data.success && typeof data.block?.height === "number") {
            const newBlockHeight = data.block.height;
            if (newBlockHeight > blockData.currentBlock) {
              setIsNewBlock(true);
              setTimeout(() => setIsNewBlock(false), 3000);
            }

            setBlockData({
              currentBlock: newBlockHeight,
              lastBlock: newBlockHeight - 1,
              nextBlock: newBlockHeight + 1,
              timeToNext: data.estimatedTimeToNext ?? 600,
              avgBlockTime: 600,
            });
            setTimeRemaining(data.estimatedTimeToNext ?? 600);
          }
        }
      } catch (error) {
        console.error("Failed to fetch block data:", error);
      }
    };

    void fetchBlockData();
    const interval = setInterval(() => void fetchBlockData(), 30000);

    return () => clearInterval(interval);
  }, [blockData.currentBlock]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          return blockData.avgBlockTime;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [blockData.avgBlockTime]);

  const progressPercentage = Math.max(
    0,
    Math.min(
      100,
      ((blockData.avgBlockTime - timeRemaining) / blockData.avgBlockTime) * 100,
    ),
  );

  return (
    <div className="relative mx-auto max-w-6xl">
      <LightningBolts />
      <AnimatePresence>
        {isNewBlock && (
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
          >
            <motion.div
              animate={{
                rotate: 360,
                scale: [1, 1.2, 1],
              }}
              transition={{
                duration: 2,
                ease: "easeInOut",
              }}
              className="text-6xl font-bold text-green-400"
            >
              NEW!
            </motion.div>
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              className="absolute top-20 bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-2xl font-bold text-transparent text-white"
            >
              NEW BLOCK MINED!
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, rotateY: -15 }}
          animate={{ opacity: 1, scale: 1, rotateY: 0 }}
          whileHover={{
            scale: 1.05,
            rotateY: 5,
            boxShadow: "0 25px 50px rgba(255,255,255,0.15)",
          }}
          transition={{ duration: 0.5, type: "spring", stiffness: 100 }}
          style={{ boxShadow: "0 0px 0px rgba(255,255,255,0)" }}
          className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-gray-900/20 p-8 text-center backdrop-blur-sm hover:border-white/20 hover:from-white/10"
        >
          <EnergyRings />

          <motion.h3
            className="mb-2 text-lg font-semibold text-gray-400 transition-colors group-hover:text-gray-300"
            whileHover={{
              scale: 1.1,
              textShadow: "0 0 10px rgba(255,255,255,0.8)",
            }}
          >
            Current Block
          </motion.h3>

          <motion.div
            className="mb-4 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-4xl font-bold text-transparent"
            animate={{
              backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
              scale: isNewBlock ? [1, 1.1, 1] : 1,
            }}
            transition={{
              backgroundPosition: {
                duration: 5,
                repeat: Infinity,
                ease: "linear",
              },
              scale: {
                duration: 0.5,
              },
            }}
            style={{
              backgroundSize: "200% 200%",
            }}
          >
            #{blockData.currentBlock.toLocaleString()}
          </motion.div>

          <motion.div
            className="text-sm text-gray-500 transition-colors group-hover:text-gray-400"
            animate={{
              opacity: [0.7, 1, 0.7],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
            }}
          >
            Last mined: {blockData.lastBlock.toLocaleString()}
          </motion.div>
          <div className="pointer-events-none absolute inset-0">
            {Array.from({ length: 5 }, (_, i) => (
              <motion.div
                key={i}
                className="absolute h-1 w-1 rounded-full bg-white/30"
                animate={{
                  x: [0, Math.random() * 200 - 100],
                  y: [0, Math.random() * 200 - 100],
                  opacity: [0, 1, 0],
                }}
                transition={{
                  duration: Math.random() * 3 + 2,
                  repeat: Infinity,
                  delay: Math.random() * 2,
                }}
              />
            ))}
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, scale: 0.9, rotateY: -15 }}
          animate={{ opacity: 1, scale: 1, rotateY: 0 }}
          whileHover={{
            scale: 1.05,
            rotateY: 5,
            boxShadow: "0 25px 50px rgba(255,255,255,0.2)",
          }}
          transition={{
            duration: 0.5,
            delay: 0.1,
            type: "spring",
            stiffness: 100,
          }}
          style={{ boxShadow: "0 0px 0px rgba(255,255,255,0)" }}
          className="group relative overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-br from-white/10 to-gray-800/30 p-8 text-center ring-1 ring-white/10 backdrop-blur-sm hover:border-white/30 hover:from-white/15"
        >
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent"
            animate={{
              x: ["-100%", "100%"],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "linear",
            }}
          />

          <motion.h3
            className="mb-2 text-lg font-semibold text-gray-300 transition-colors group-hover:text-white"
            whileHover={{
              scale: 1.1,
              textShadow: "0 0 15px rgba(255,255,255,0.8)",
            }}
          >
            Time Since Last Block
          </motion.h3>

          <motion.div
            className="mb-4 text-4xl font-bold text-white"
            animate={{
              scale: [1, 1.02, 1],
              textShadow: [
                "0 0 10px rgba(255,255,255,0.5)",
                "0 0 20px rgba(255,255,255,0.8)",
                "0 0 10px rgba(255,255,255,0.5)",
              ],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
            }}
          >
            {formatTime(blockData.avgBlockTime - timeRemaining)}
          </motion.div>

          <div className="relative mb-4">
            <div className="h-2 overflow-hidden rounded-full bg-gray-800/50">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPercentage}%` }}
                transition={{ duration: 0.5 }}
                className="relative h-full"
              >
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-white via-gray-300 to-zinc-400"
                  animate={{
                    backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                  style={{
                    backgroundSize: "200% 200%",
                  }}
                />
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-white via-gray-300 to-zinc-400 opacity-50 blur-sm"
                  animate={{
                    opacity: [0.3, 0.7, 0.3],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                  }}
                />
              </motion.div>
            </div>
          </div>

          <motion.div
            className="text-sm text-gray-400 transition-colors group-hover:text-gray-300"
            animate={{
              opacity: [0.8, 1, 0.8],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
            }}
          >
            Avg: ~{Math.floor(blockData.avgBlockTime / 60)} minutes per block
          </motion.div>
          <motion.div
            className="absolute inset-0 rounded-2xl border border-white/20"
            animate={{
              scale: [1, 1.02, 1],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
            }}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9, rotateY: -15 }}
          animate={{ opacity: 1, scale: 1, rotateY: 0 }}
          whileHover={{
            scale: 1.05,
            rotateY: 5,
            boxShadow: "0 25px 50px rgba(255,255,255,0.15)",
          }}
          transition={{
            duration: 0.5,
            delay: 0.2,
            type: "spring",
            stiffness: 100,
          }}
          style={{ boxShadow: "0 0px 0px rgba(255,255,255,0)" }}
          className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-gray-900/20 p-8 text-center backdrop-blur-sm hover:border-white/20 hover:from-white/10"
        >
          <EnergyRings />

          <motion.h3
            className="mb-2 text-lg font-semibold text-gray-400 transition-colors group-hover:text-gray-300"
            whileHover={{
              scale: 1.1,
              textShadow: "0 0 10px rgba(255,255,255,0.8)",
            }}
          >
            Est. Next Block
          </motion.h3>

          <motion.div
            className="mb-4 text-4xl font-bold text-white"
            animate={{
              scale: [1, 1.05, 1],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            #{blockData.nextBlock.toLocaleString()}
          </motion.div>

          <motion.div
            className="text-sm text-gray-500 transition-colors group-hover:text-gray-400"
            animate={{
              opacity: [0.7, 1, 0.7],
            }}
            transition={{
              duration: 2.5,
              repeat: Infinity,
            }}
          >
            ETA: ~{formatTime(timeRemaining)}
          </motion.div>
          <div className="pointer-events-none absolute inset-0">
            {Array.from({ length: 3 }, (_, i) => (
              <motion.div
                key={i}
                className="absolute text-xs text-white/20"
                animate={{
                  y: [100, -20],
                  opacity: [0, 1, 0],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  delay: i * 1,
                }}
                style={{
                  left: `${20 + i * 30}%`,
                }}
              >
                •
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 30, rotateX: -10 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        whileHover={{
          scale: 1.02,
          rotateX: 2,
          boxShadow: "0 30px 60px rgba(255,255,255,0.1)",
        }}
        transition={{ duration: 0.6, delay: 0.3, type: "spring" }}
        style={{ boxShadow: "0 0px 0px rgba(255,255,255,0)" }}
        className="group relative mt-8 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-white/5 to-gray-900/20 p-6 text-center backdrop-blur-sm hover:border-white/20 hover:from-white/10"
      >
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/3 to-transparent"
          animate={{
            x: ["-100%", "100%"],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "linear",
          }}
        />

        <motion.div
          className="mb-4 text-2xl font-bold text-orange-400"
          animate={{
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          LIVE
        </motion.div>

        <motion.h3
          className="mb-2 text-xl font-semibold text-white group-hover:text-gray-100"
          whileHover={{
            scale: 1.05,
            textShadow: "0 0 15px rgba(255,255,255,0.8)",
          }}
        >
          Winner Selection Process
        </motion.h3>

        <motion.p
          className="mx-auto max-w-2xl text-gray-400 transition-colors group-hover:text-gray-300"
          animate={{
            opacity: [0.8, 1, 0.8],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
          }}
        >
          When block #{blockData.nextBlock.toLocaleString()} is mined, the
          proposal with the most votes at that exact moment will be selected as
          the winner and permanently inscribed on the Bitcoin blockchain. The
          selection happens automatically based on the blockchain timestamp.
        </motion.p>
      </motion.div>
    </div>
  );
}
