"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import {
  TrophyIcon,
  FireIcon,
  ClockIcon,
  ArrowTrendingUpIcon,
  CheckCircleIcon,
  XCircleIcon,
  EyeIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import {
  Crown,
  Zap,
  Timer,
  TrendingUp,
  Shield,
  Target,
  Gem,
  Medal,
} from "lucide-react";
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
  const [imageError, setImageError] = useState(false);

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
          badge: "👑 LEADER",
          badgeColor: "bg-gradient-to-r from-yellow-500 to-amber-500",
          borderColor: "border-yellow-500/30",
          glowColor: "from-yellow-500 to-amber-400",
          icon: <Crown className="h-3 w-3 sm:h-4 sm:w-4" />,
          bgGradient: "from-yellow-500/10 to-amber-500/5",
        };
      case "inscribing":
        return {
          badge: "⚡ INSCRIBING",
          badgeColor: "bg-gradient-to-r from-blue-500 to-cyan-500",
          borderColor: "border-blue-500/30",
          glowColor: "from-blue-500 to-cyan-400",
          icon: <Zap className="h-3 w-3 sm:h-4 sm:w-4" />,
          bgGradient: "from-blue-500/10 to-cyan-500/5",
        };
      case "inscribed":
        return {
          badge: "🏆 CHAMPION",
          badgeColor: "bg-gradient-to-r from-green-500 to-emerald-500",
          borderColor: "border-green-500/30",
          glowColor: "from-green-500 to-emerald-400",
          icon: <TrophyIcon className="h-3 w-3 sm:h-4 sm:w-4" />,
          bgGradient: "from-green-500/10 to-emerald-500/5",
        };
      case "expired":
        return {
          badge: "💀 EXPIRED",
          badgeColor: "bg-gradient-to-r from-red-500 to-rose-500",
          borderColor: "border-red-500/30",
          glowColor: "from-red-500 to-rose-400",
          icon: <XCircleIcon className="h-3 w-3 sm:h-4 sm:w-4" />,
          bgGradient: "from-red-500/10 to-rose-500/5",
        };
      default:
        return {
          badge: null,
          badgeColor: "",
          borderColor: "border-orange-500/20",
          glowColor: "from-orange-500 to-orange-400",
          icon: <Target className="h-3 w-3 sm:h-4 sm:w-4" />,
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
        icon:
          remaining > 0 ? (
            <Timer className="h-3 w-3 sm:h-4 sm:w-4" />
          ) : (
            <CheckCircleIcon className="h-3 w-3 sm:h-4 sm:w-4" />
          ),
      };
    }
    return { show: false };
  };

  const getRankIcon = () => {
    if (rank === 1) return <Crown className="h-3 w-3 text-yellow-400" />;
    if (rank === 2) return <Medal className="h-3 w-3 text-gray-300" />;
    if (rank === 3) return <Medal className="h-3 w-3 text-amber-600" />;
    return <Gem className="h-3 w-3 text-orange-400" />;
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
              {statusConfig.icon}
              <span className="hidden sm:inline">
                {statusConfig.badge.split(" ")[1]}
              </span>
              <span className="sm:hidden">
                {statusConfig.badge.split(" ")[0]}
              </span>
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
              {getRankIcon()}
              <span className="text-xs font-bold text-white sm:text-sm">
                #{rank}
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

        {/* Main Content */}
        <div
          className={`flex flex-1 flex-col p-3 ${bannerUrl ? "pt-3" : "pt-12"} sm:p-4 ${bannerUrl ? "sm:pt-4" : "sm:pt-16"} lg:p-6 ${bannerUrl ? "lg:pt-6" : "lg:pt-20"}`}
        >
          {/* Header Section */}
          <div className="mb-3 flex items-center gap-2 sm:mb-4 sm:gap-3">
            <div className="relative flex-shrink-0">
              <motion.div whileHover={{ scale: 1.05 }} className="relative">
                <Image
                  src={imageError ? "/bitmemes_logo.png" : imageUrl}
                  alt={name}
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded-lg object-cover shadow-lg sm:h-12 sm:w-12 sm:rounded-xl lg:h-14 lg:w-14 lg:rounded-2xl"
                  onError={() => setImageError(true)}
                />
              </motion.div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-1 sm:gap-2">
                <h3 className="truncate text-sm font-bold text-white sm:text-base lg:text-lg">
                  {name}
                </h3>
              </div>
              <div className="mb-1 flex items-center gap-1 sm:gap-2">
                <p className="font-mono text-xs font-semibold text-orange-400 sm:text-sm">
                  ${ticker}
                </p>
                {status === "leader" && (
                  <SparklesIcon className="h-3 w-3 text-yellow-400 sm:h-4 sm:w-4" />
                )}
              </div>
              <p className="flex items-center gap-1 text-xs text-white/70">
                <span>by</span>
                <span className="truncate font-medium text-orange-300">
                  {creator}
                </span>
              </p>
            </div>
          </div>

          {/* Description */}
          <p className="mb-3 line-clamp-2 text-xs leading-relaxed text-white/80 sm:mb-4 sm:text-sm lg:text-base">
            {description}
          </p>

          {/* Progress Bar for Leaders */}
          {progressInfo.show && (
            <div className="mb-3 sm:mb-4">
              <div className="mb-1 flex items-center justify-between text-xs sm:mb-2 sm:text-sm">
                <div
                  className={`flex items-center gap-1 ${progressInfo.color} font-medium sm:gap-1.5`}
                >
                  {progressInfo.icon}
                  <span className="truncate">{progressInfo.text}</span>
                </div>
                <span className="font-mono text-xs text-white/60 sm:text-sm">
                  {Math.round(progressInfo.progress || 0)}%
                </span>
              </div>
              <div className="relative h-1.5 overflow-hidden rounded-full bg-gray-800/50 sm:h-2">
                <motion.div
                  className="relative h-full bg-gradient-to-r from-amber-500 to-yellow-400"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressInfo.progress}%` }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                >
                  <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                </motion.div>
              </div>
            </div>
          )}

          {/* Vote Progress */}
          <div className="mb-3 sm:mb-4">
            <div className="mb-1 flex items-center justify-between text-xs sm:mb-2 sm:text-sm">
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="flex items-center gap-0.5 font-medium text-green-400 sm:gap-1">
                  <ArrowTrendingUpIcon className="h-3 w-3 sm:h-4 sm:w-4" />
                  {votesUp.toLocaleString()}
                </span>
                <span className="flex items-center gap-0.5 font-medium text-red-400 sm:gap-1">
                  <XCircleIcon className="h-3 w-3 sm:h-4 sm:w-4" />
                  {votesDown.toLocaleString()}
                </span>
              </div>
              <span className="font-mono text-xs text-white/60">
                {totalVotes.toLocaleString()}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-red-500/20 sm:h-2">
              <div
                className="h-full rounded-full bg-gradient-to-r from-green-400 to-emerald-500"
                style={{ width: `${votePercentage}%` }}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-auto flex gap-1.5 sm:gap-2">
            {status === "active" && (
              <>
                <motion.button
                  onClick={() => handleVote("up")}
                  disabled={isVoting === "up"}
                  className="group/btn flex flex-1 items-center justify-center gap-1 rounded-lg bg-gradient-to-r from-green-600 to-green-500 py-2 text-xs font-medium text-white transition-all duration-200 hover:from-green-500 hover:to-green-400 hover:shadow-lg hover:shadow-green-500/25 disabled:cursor-not-allowed disabled:opacity-50 sm:gap-2 sm:rounded-xl sm:py-3 sm:text-sm"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {isVoting === "up" ? (
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white sm:h-4 sm:w-4" />
                  ) : (
                    <ArrowTrendingUpIcon className="h-3 w-3 transition-transform group-hover/btn:scale-110 sm:h-4 sm:w-4" />
                  )}
                  <span className="hidden sm:inline">Vote Up</span>
                  <span className="sm:hidden">Up</span>
                </motion.button>

                <motion.button
                  onClick={() => handleVote("down")}
                  disabled={isVoting === "down"}
                  className="group/btn flex flex-1 items-center justify-center gap-1 rounded-lg bg-gradient-to-r from-red-600 to-red-500 py-2 text-xs font-medium text-white transition-all duration-200 hover:from-red-500 hover:to-red-400 hover:shadow-lg hover:shadow-red-500/25 disabled:cursor-not-allowed disabled:opacity-50 sm:gap-2 sm:rounded-xl sm:py-3 sm:text-sm"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {isVoting === "down" ? (
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white sm:h-4 sm:w-4" />
                  ) : (
                    <XCircleIcon className="h-3 w-3 transition-transform group-hover/btn:scale-110 sm:h-4 sm:w-4" />
                  )}
                  <span className="hidden sm:inline">Vote Down</span>
                  <span className="sm:hidden">Down</span>
                </motion.button>
              </>
            )}

            {status === "inscribed" && (
              <Link
                href={`/proposals/${id}`}
                className="group/btn flex flex-1 items-center justify-center gap-1 rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 py-2 text-xs font-medium text-white transition-all duration-200 hover:from-orange-400 hover:to-orange-500 hover:shadow-lg hover:shadow-orange-500/25 sm:gap-2 sm:rounded-xl sm:py-3 sm:text-sm"
              >
                <TrophyIcon className="h-3 w-3 transition-transform group-hover/btn:scale-110 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">View Champion</span>
                <span className="sm:hidden">Champion</span>
              </Link>
            )}

            {(status === "leader" ||
              status === "inscribing" ||
              status === "expired") && (
              <Link
                href={`/proposals/${id}`}
                className="group/btn flex flex-1 items-center justify-center gap-1 rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 py-2 text-xs font-medium text-white transition-all duration-200 hover:from-orange-400 hover:to-orange-500 hover:shadow-lg hover:shadow-orange-500/25 sm:gap-2 sm:rounded-xl sm:py-3 sm:text-sm"
              >
                <EyeIcon className="h-3 w-3 transition-transform group-hover/btn:scale-110 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">View Details</span>
                <span className="sm:hidden">Details</span>
              </Link>
            )}
          </div>
        </div>
      </div>

      {(status === "leader" || status === "inscribing") && (
        <ProposalStatusBanner
          status={status}
          remaining={progressInfo.remaining}
          progress={progressInfo.progress}
        />
      )}
    </motion.div>
  );
}
