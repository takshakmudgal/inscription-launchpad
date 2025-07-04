"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";

import type { Inscription } from "~/types";
import ProposalStatusBanner from "./ProposalStatusBanner";

interface ProposalCardProps {
  id: number;
  rank: number;
  name: string;
  ticker: string;
  description: string;
  imageUrl: string;
  bannerUrl?: string;
  creator: string;
  votesUp: number;
  votesDown: number;
  totalVotes: number;
  status:
    | "active"
    | "leader"
    | "inscribing"
    | "inscribed"
    | "rejected"
    | "expired";
  inscription: Inscription | null;
  leaderStartBlock?: number;
  leaderboardMinBlocks: number;
  currentBlockHeight?: number;
  onVote: (proposalId: number, voteType: "up" | "down") => void;
}

export function ProposalCard({
  id,
  rank,
  name,
  ticker,
  description,
  imageUrl,
  bannerUrl,
  creator,
  votesUp,
  votesDown,
  totalVotes,
  status,
  leaderStartBlock,
  leaderboardMinBlocks,
  currentBlockHeight,
  onVote,
}: ProposalCardProps) {
  const [isVoting, setIsVoting] = useState<"up" | "down" | null>(null);

  const handleVote = async (voteType: "up" | "down") => {
    if (isVoting) return;

    setIsVoting(voteType);
    try {
      await onVote(id, voteType);
    } catch (error) {
      console.error("Error voting:", error);
    } finally {
      setIsVoting(null);
    }
  };

  const getStatusConfig = () => {
    switch (status) {
      case "leader":
        return {
          badge: "LEADER",
          badgeColor: "bg-yellow-500",
          borderColor: "border-yellow-500/30",
          glowColor: "from-yellow-500 to-amber-400",
          bgGradient: "from-yellow-500/10 to-amber-500/5",
        };
      case "inscribing":
        return {
          badge: "INSCRIBING",
          badgeColor: "bg-blue-500",
          borderColor: "border-blue-500/30",
          glowColor: "from-blue-500 to-cyan-400",
          bgGradient: "from-blue-500/10 to-cyan-500/5",
        };
      case "inscribed":
        return {
          badge: "CHAMPION",
          badgeColor: "bg-green-500",
          borderColor: "border-green-500/30",
          glowColor: "from-green-500 to-emerald-400",
          bgGradient: "from-green-500/10 to-emerald-500/5",
        };
      case "expired":
        return {
          badge: "EXPIRED",
          badgeColor: "bg-red-500",
          borderColor: "border-red-500/30",
          glowColor: "from-red-500 to-rose-400",
          bgGradient: "from-red-500/10 to-rose-500/5",
        };
      default:
        return {
          badge: null,
          badgeColor: "",
          borderColor: "border-orange-500/20",
          glowColor: "from-orange-500 to-orange-400",
          bgGradient: "from-orange-500/5 to-orange-600/5",
        };
    }
  };

  const getProgressInfo = () => {
    if (status === "leader" && leaderStartBlock && currentBlockHeight) {
      const blocksAsLeader = currentBlockHeight - leaderStartBlock;
      const remaining = Math.max(0, leaderboardMinBlocks - blocksAsLeader);
      const progress = Math.min(
        100,
        (blocksAsLeader / leaderboardMinBlocks) * 100,
      );

      return {
        show: true,
        remaining,
        progress,
        text:
          remaining > 0
            ? `${remaining} blocks to survival`
            : "Ready for inscription!",
        color: remaining > 0 ? "text-amber-400" : "text-green-400",
      };
    }
    return { show: false };
  };

  const getRankDisplay = () => {
    if (rank === 1) return "#1";
    if (rank === 2) return "#2";
    if (rank === 3) return "#3";
    return `#${rank}`;
  };

  const votePercentage = totalVotes > 0 ? (votesUp / totalVotes) * 100 : 50;
  const statusConfig = getStatusConfig();
  const progressInfo = getProgressInfo();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="relative h-full"
    >
      <div
        className={`relative flex h-full min-h-[280px] flex-col overflow-hidden rounded-2xl border backdrop-blur-xl transition-all duration-300 ${statusConfig.borderColor} bg-gradient-to-br ${statusConfig.bgGradient} backdrop-blur-md sm:min-h-[320px] lg:min-h-[360px]`}
      >
        {/* Status Badge */}
        {statusConfig.badge && (
          <div className="absolute top-2 right-2 z-20 sm:top-3 sm:right-3">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold text-white shadow-lg backdrop-blur-sm sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-xs ${statusConfig.badgeColor}`}
            >
              <span>{statusConfig.badge}</span>
            </motion.div>
          </div>
        )}

        {/* Rank Badge */}
        <div className="absolute top-2 left-2 z-20 sm:top-3 sm:left-3">
          <motion.div
            className={`flex h-8 w-8 items-center justify-center rounded-full shadow-lg backdrop-blur-sm sm:h-10 sm:w-10 ${
              rank === 1
                ? "bg-gradient-to-br from-yellow-400 to-yellow-600"
                : rank === 2
                  ? "bg-gradient-to-br from-gray-300 to-gray-500"
                  : rank === 3
                    ? "bg-gradient-to-br from-amber-500 to-amber-700"
                    : "bg-gradient-to-br from-orange-500 to-orange-600"
            }`}
          >
            <div className="flex items-center gap-0.5">
              <span className="text-xs font-bold text-white sm:text-sm">
                {getRankDisplay()}
              </span>
            </div>
          </motion.div>
        </div>

        {/* Banner Image */}
        {bannerUrl && (
          <div className="relative h-16 overflow-hidden rounded-t-2xl sm:h-20 lg:h-24">
            <Image
              src={bannerUrl}
              alt={`${name} banner`}
              fill
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/50" />
          </div>
        )}

        {/* Header */}
        <div className="relative p-3 sm:p-4">
          {/* Rank */}
          <div className="absolute top-3 left-3 z-10 sm:top-4 sm:left-4">
            <div className="flex items-center justify-center rounded-full bg-black/60 p-1.5 text-xs font-bold text-orange-400 backdrop-blur-sm sm:p-2 sm:text-sm">
              <span className="text-orange-400">{getRankDisplay()}</span>
            </div>
          </div>

          {/* Main Content */}
          <div className="relative z-10 mt-8 sm:mt-10">
            <div className="mb-2 flex items-center gap-2">
              <h3 className="text-lg font-bold text-white sm:text-xl lg:text-2xl">
                {name}
              </h3>
              <span className="inline-flex items-center gap-1 rounded-md bg-orange-500/20 px-2 py-0.5 text-xs font-medium text-orange-400">
                ${ticker}
              </span>
            </div>
            <p className="mb-3 line-clamp-2 text-xs text-gray-300 sm:text-sm lg:text-base">
              {description}
            </p>
            <p className="text-xs text-gray-400 sm:text-sm">
              Created by {creator}
            </p>
          </div>
        </div>

        {/* Progress Info for Leaders */}
        {progressInfo.show && (
          <div className="px-3 pb-2 sm:px-4">
            <div
              className={`flex items-center gap-2 text-xs ${progressInfo.color} sm:text-sm`}
            >
              <span className="font-medium">{progressInfo.text}</span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-700">
              <motion.div
                className="h-full bg-amber-500"
                initial={{ width: "0%" }}
                animate={{ width: `${progressInfo.progress}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
              />
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="flex-1 px-3 pb-2 sm:px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-center">
                <div className="text-xs text-gray-400 sm:text-sm">Votes</div>
                <div className="text-sm font-bold text-white sm:text-base">
                  {totalVotes}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-400 sm:text-sm">Support</div>
              <div className="text-sm font-bold text-green-400 sm:text-base">
                {votePercentage.toFixed(1)}%
              </div>
            </div>
          </div>

          {/* Vote Progress Bar */}
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-700">
            <motion.div
              className="h-full bg-green-500"
              initial={{ width: "0%" }}
              animate={{ width: `${votePercentage}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="border-t border-gray-700/50 p-3 sm:p-4">
          <div className="flex gap-2">
            {/* Vote Up */}
            <motion.button
              onClick={() => handleVote("up")}
              disabled={isVoting !== null}
              className="group/btn flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-green-600/80 py-2 text-xs font-medium text-white transition-all hover:bg-green-600 disabled:opacity-50 sm:gap-2 sm:text-sm"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <span className="transition-transform group-hover/btn:scale-110">
                ↑
              </span>
              <span>{votesUp}</span>
            </motion.button>

            {/* Vote Down */}
            <motion.button
              onClick={() => handleVote("down")}
              disabled={isVoting !== null}
              className="group/btn flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-red-600/80 py-2 text-xs font-medium text-white transition-all hover:bg-red-600 disabled:opacity-50 sm:gap-2 sm:text-sm"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <span className="transition-transform group-hover/btn:scale-110">
                ↓
              </span>
              <span>{votesDown}</span>
            </motion.button>

            {/* Leaderboard Button */}
            <Link href="/#leaderboard">
              <motion.button
                className="group/btn flex items-center justify-center gap-1.5 rounded-lg bg-orange-600/80 px-3 py-2 text-xs font-medium text-white transition-all hover:bg-orange-600 sm:gap-2 sm:text-sm"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <span className="transition-transform group-hover/btn:scale-110">
                  ↗
                </span>
              </motion.button>
            </Link>

            {/* View Details */}
            <Link href={`/proposals/${id}`}>
              <motion.button
                className="group/btn flex items-center justify-center gap-1.5 rounded-lg bg-gray-600/80 px-3 py-2 text-xs font-medium text-white transition-all hover:bg-gray-600 sm:gap-2 sm:text-sm"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <span className="transition-transform group-hover/btn:scale-110">
                  View
                </span>
              </motion.button>
            </Link>
          </div>
        </div>
      </div>

      {/* Voting feedback */}
      {isVoting && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 z-30 flex items-center justify-center rounded-2xl bg-black/50 backdrop-blur-sm"
        >
          <div className="text-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="mx-auto h-8 w-8 rounded-full border-2 border-orange-500 border-t-transparent"
            />
            <p className="mt-2 text-sm font-medium text-white">
              {isVoting === "up" ? "Voting up..." : "Voting down..."}
            </p>
          </div>
        </motion.div>
      )}

      {/* Status Banner */}
      {(status === "leader" || status === "inscribing") && (
        <ProposalStatusBanner
          status={status}
          progress={progressInfo.progress}
          remaining={progressInfo.remaining}
        />
      )}
    </motion.div>
  );
}
