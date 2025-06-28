"use client";

import { useState } from "react";
import { motion } from "framer-motion";

interface ProposalCardProps {
  id: number;
  name: string;
  ticker: string;
  description: string;
  imageUrl: string;
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
  firstTimeAsLeader?: string;
  leaderStartBlock?: number;
  leaderboardMinBlocks: number;
  expirationBlock?: number;
  currentBlockHeight?: number;
  onVote: (proposalId: number, voteType: "up" | "down") => void;
}

export function ProposalCard({
  id,
  name,
  ticker,
  description,
  imageUrl,
  creator,
  votesUp,
  votesDown,
  totalVotes,
  status,
  firstTimeAsLeader,
  leaderStartBlock,
  leaderboardMinBlocks,
  expirationBlock,
  currentBlockHeight,
  onVote,
}: ProposalCardProps) {
  const [imageError, setImageError] = useState(false);
  const [isVoting, setIsVoting] = useState<"up" | "down" | null>(null);

  const handleVote = async (voteType: "up" | "down") => {
    console.log(`🗳️ Vote button clicked: ${voteType} for proposal ${id}`);
    setIsVoting(voteType);
    try {
      await onVote(id, voteType);
      console.log(`✅ Vote completed: ${voteType} for proposal ${id}`);
    } catch (error) {
      console.error(`❌ Vote failed: ${voteType} for proposal ${id}`, error);
    } finally {
      setIsVoting(null);
    }
  };

  const getAutomaticInscriptionStatus = () => {
    if (status === "inscribed") return null;
    if (status === "active") {
      return {
        text: "⚔️ Fighting for #1 position to become leader",
        color: "text-gray-400",
        bg: "bg-gray-500/20 border-gray-500/30",
        icon: "⚔️",
        phase: "voting",
        details: "Must reach #1 to start 2-block survival challenge",
      };
    }

    if (status === "leader" && leaderStartBlock && currentBlockHeight) {
      const blocksAsLeader = currentBlockHeight - leaderStartBlock;
      const remaining = Math.max(0, leaderboardMinBlocks - blocksAsLeader);

      if (remaining > 0) {
        return {
          text: `💪 DEFENDING LEADERSHIP: ${remaining} blocks to survive`,
          color: "text-yellow-400",
          bg: "bg-yellow-500/20 border-yellow-500/30",
          icon: "👑",
          phase: "leading",
          details: `Block ${currentBlockHeight} • Survival Progress: ${blocksAsLeader}/${leaderboardMinBlocks} blocks`,
          subDetails: "⚠️ Lose #1 position = immediate elimination!",
          progress: (blocksAsLeader / leaderboardMinBlocks) * 100,
        };
      } else {
        return {
          text: "🏆 SURVIVAL COMPLETE! Inscription starting...",
          color: "text-green-400",
          bg: "bg-green-500/20 border-green-500/30",
          icon: "🚀",
          phase: "ready",
          details: `Block ${currentBlockHeight} • Champion earned inscription rights!`,
          progress: 100,
        };
      }
    }

    if (status === "inscribing") {
      return {
        text: "⚡ CHAMPION INSCRIPTION IN PROGRESS",
        color: "text-blue-400",
        bg: "bg-blue-500/20 border-blue-500/30",
        icon: "⚡",
        phase: "inscribing",
        details:
          "🏆 Winner is being permanently inscribed on Bitcoin blockchain",
        subDetails: "This champion survived the competitive elimination!",
      };
    }

    if (status === "expired") {
      return {
        text: "💀 ELIMINATED from competition",
        color: "text-red-400",
        bg: "bg-red-500/20 border-red-500/30",
        icon: "💀",
        phase: "expired",
        details: "Failed to maintain #1 position long enough",
        subDetails: "Only the strongest proposals survive to inscription",
      };
    }

    return null;
  };

  const votePercentage = totalVotes > 0 ? (votesUp / totalVotes) * 100 : 50;

  const getInscriptionProgress = () => {
    const steps = [
      {
        key: "active",
        label: "Battle",
        icon: "⚔️",
        completed: status !== "expired",
        description: "Fighting for #1 position",
      },
      {
        key: "leader",
        label: "Survival",
        icon: "👑",
        completed:
          status === "leader" ||
          status === "inscribing" ||
          status === "inscribed",
        description: "Defending leadership for 2 blocks",
      },
      {
        key: "inscribing",
        label: "Champion",
        icon: "⚡",
        completed: status === "inscribing" || status === "inscribed",
        description: "Winner being inscribed",
      },
      {
        key: "inscribed",
        label: "Immortal",
        icon: "🏆",
        completed: status === "inscribed",
        description: "Permanently on Bitcoin",
      },
    ];

    const currentStepIndex = steps.findIndex((step) => step.key === status);
    const autoStatus = getAutomaticInscriptionStatus();

    return (
      <div className="mb-4 rounded-lg border border-white/10 bg-white/5 p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-medium text-gray-300">
            Competitive Elimination Progress
          </span>
          {autoStatus?.phase && (
            <span
              className={`rounded px-2 py-1 text-xs font-medium ${autoStatus.bg} ${autoStatus.color}`}
            >
              {autoStatus.phase === "voting" && "Battle Phase"}
              {autoStatus.phase === "leading" && "Survival Phase"}
              {autoStatus.phase === "ready" && "Champion Ready"}
              {autoStatus.phase === "inscribing" && "Champion Inscription"}
              {autoStatus.phase === "expired" && "Eliminated"}
            </span>
          )}
        </div>

        <div className="relative mb-3 flex items-center justify-between">
          {steps.map((step, index) => (
            <div
              key={step.key}
              className="z-10 flex flex-col items-center bg-gray-900 px-1"
              title={step.description}
            >
              <div
                className={`mb-2 flex h-8 w-8 items-center justify-center rounded-full border text-xs transition-all duration-300 ${
                  step.completed
                    ? "scale-110 border-green-500/50 bg-green-500/20 text-green-400 shadow-lg shadow-green-500/20"
                    : currentStepIndex === index
                      ? "animate-pulse border-blue-500/50 bg-blue-500/20 text-blue-400 shadow-lg shadow-blue-500/20"
                      : status === "expired" && step.key === "active"
                        ? "border-red-500/50 bg-red-500/20 text-red-400"
                        : "border-gray-500/50 bg-gray-500/20 text-gray-500"
                }`}
              >
                {step.completed
                  ? "✓"
                  : status === "expired" && step.key === "active"
                    ? "💀"
                    : step.icon}
              </div>
              <span
                className={`text-center text-xs whitespace-nowrap transition-colors duration-300 ${
                  step.completed
                    ? "font-medium text-green-400"
                    : currentStepIndex === index
                      ? "font-medium text-blue-400"
                      : status === "expired" && step.key === "active"
                        ? "font-medium text-red-400"
                        : "text-gray-500"
                }`}
              >
                {step.label}
              </span>
            </div>
          ))}
          <div className="absolute top-4 right-0 left-0 h-1 rounded bg-gray-500/30"></div>
          <motion.div
            initial={{ width: "0%" }}
            animate={{
              width: `${(steps.filter((s) => s.completed).length / steps.length) * 100}%`,
            }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className={`absolute top-4 left-0 h-1 rounded shadow-sm ${
              status === "expired"
                ? "bg-gradient-to-r from-red-500 to-red-600"
                : "bg-gradient-to-r from-green-500 to-emerald-400"
            }`}
          />
        </div>
        {autoStatus && (
          <div className="space-y-2">
            <div
              className={`text-center text-xs font-medium ${autoStatus.color}`}
            >
              {autoStatus.text}
            </div>

            {autoStatus.details && (
              <div className="text-center text-xs text-gray-400">
                {autoStatus.details}
              </div>
            )}

            {autoStatus.subDetails && (
              <div className="text-center text-xs text-gray-500">
                {autoStatus.subDetails}
              </div>
            )}
            {autoStatus.phase === "leading" &&
              autoStatus.progress !== undefined && (
                <div className="mt-2">
                  <div className="h-1.5 overflow-hidden rounded-full bg-gray-700">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${autoStatus.progress}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      className="h-full bg-gradient-to-r from-yellow-500 to-orange-400"
                    />
                  </div>
                  <div className="mt-1 text-center text-xs text-gray-500">
                    Survival Progress: {Math.round(autoStatus.progress)}%
                  </div>
                </div>
              )}
            {autoStatus.phase === "inscribing" && (
              <div className="mt-2 flex items-center justify-center">
                <div className="flex space-x-1">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.5, 1, 0.5],
                      }}
                      transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        delay: i * 0.2,
                      }}
                      className="h-2 w-2 rounded-full bg-blue-400"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const getStatusBadge = () => {
    const autoStatus = getAutomaticInscriptionStatus();

    switch (status) {
      case "inscribed":
        return (
          <div className="inline-flex items-center gap-2 rounded-full border border-green-500/30 bg-green-500/20 px-4 py-2 text-sm font-medium text-green-400">
            <motion.span
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="text-base"
            >
              🏆
            </motion.span>
            <span>CHAMPION INSCRIBED</span>
          </div>
        );
      case "inscribing":
        return (
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/20 px-4 py-2 text-sm font-medium text-blue-400">
            <div className="relative flex items-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="h-3 w-3 rounded-full border-2 border-blue-400/30 border-t-blue-400"
              />
            </div>
            <span>Champion Inscription</span>
          </div>
        );
      case "leader":
        return (
          <div className="inline-flex items-center gap-2 rounded-full border border-yellow-500/30 bg-yellow-500/20 px-4 py-2 text-sm font-medium text-yellow-400">
            <motion.span
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-base"
            >
              👑
            </motion.span>
            <span>DEFENDING LEADERSHIP</span>
            {autoStatus?.phase === "ready" && (
              <motion.span
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="rounded border border-green-500/30 bg-green-500/20 px-2 py-0.5 text-xs text-green-400"
              >
                Survived!
              </motion.span>
            )}
          </div>
        );
      case "rejected":
        return (
          <div className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/20 px-4 py-2 text-sm font-medium text-red-400">
            <span className="text-base">❌</span>
            <span>Rejected</span>
          </div>
        );
      case "expired":
        return (
          <div className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/20 px-4 py-2 text-sm font-medium text-red-400">
            <span className="text-base">💀</span>
            <span>ELIMINATED</span>
          </div>
        );
      default:
        return (
          <div className="inline-flex items-center gap-2 rounded-full border border-green-500/30 bg-green-500/20 px-4 py-2 text-sm font-medium text-green-400">
            <motion.span
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="text-base"
            >
              ⚔️
            </motion.span>
            <span>Battle for #1</span>
          </div>
        );
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -5 }}
      className="group relative w-full overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-gray-900/50 to-black/50 p-4 shadow-xl backdrop-blur-sm transition-all duration-300 hover:border-white/20 hover:shadow-2xl sm:p-6"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-pink-500/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="mb-3 flex flex-col gap-2 sm:mb-4 sm:flex-row sm:items-start sm:justify-between">
        {getStatusBadge()}
        <div className="text-left sm:text-right">
          <div className="text-xs text-gray-400 sm:text-sm">Creator</div>
          <div className="text-xs font-medium break-words text-white sm:text-sm">
            {creator}
          </div>
        </div>
      </div>
      <div className="relative mb-3 overflow-hidden rounded-xl sm:mb-4">
        {!imageError ? (
          <img
            src={imageUrl}
            alt={`${name} meme`}
            className="h-40 w-full object-cover transition-transform duration-300 group-hover:scale-105 sm:h-48"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="flex h-40 w-full items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900 sm:h-48">
            <div className="text-center">
              <div className="mb-2 text-3xl sm:text-4xl">🎭</div>
              <div className="text-xs text-gray-400 sm:text-sm">
                Image not available
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="space-y-3">
        <div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <h3 className="flex-1 text-lg font-bold break-words text-white sm:text-xl">
              {name}
            </h3>
            <span className="w-fit rounded-lg border border-orange-500/30 bg-gradient-to-r from-orange-500/20 to-amber-500/20 px-3 py-1 text-xs font-bold whitespace-nowrap text-orange-400">
              ${ticker}
            </span>
          </div>
        </div>
        <p className="line-clamp-3 text-xs leading-relaxed break-words text-gray-300 sm:text-sm">
          {description}
        </p>
        <div className="space-y-2">
          {getInscriptionProgress()}
          {status === "active" && (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Community Vote</span>
                <span className="font-semibold text-white">
                  {totalVotes === 1
                    ? "1 vote"
                    : `${totalVotes.toLocaleString()} votes`}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-gray-800">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${votePercentage}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className="h-full bg-gradient-to-r from-green-500 to-emerald-400"
                />
              </div>
              <div className="flex justify-between text-xs text-gray-400">
                <span>👍 {votesUp.toLocaleString()}</span>
                <span>👎 {votesDown.toLocaleString()}</span>
              </div>
            </>
          )}
        </div>
        {status === "inscribed" && (
          <div className="space-y-3">
            <div className="flex w-full items-center justify-center gap-2 rounded-xl border border-green-500/30 bg-green-500/20 px-4 py-3 text-sm font-semibold text-green-400">
              <motion.span
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-base"
              >
                🏆
              </motion.span>
              <span>CHAMPION IMMORTALIZED ON BITCOIN</span>
            </div>

            <div className="rounded-lg bg-gray-800/50 px-3 py-2 text-center text-xs text-gray-400">
              ✅ This champion survived the competitive elimination and is now
              permanently on Bitcoin
            </div>
            <div className="flex items-center justify-center gap-2 text-xs">
              <div className="h-2 w-2 rounded-full bg-green-400"></div>
              <span className="font-medium text-green-400">
                Victory Complete
              </span>
            </div>
          </div>
        )}
        <div className="pt-3">
          {status === "active" && (
            <>
              <div className="mb-3 grid grid-cols-2 gap-3">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log("🚨 BUTTON CLICKED - THIS SHOULD ALWAYS WORK!");
                    handleVote("up");
                  }}
                  disabled={isVoting !== null}
                  className="flex items-center justify-center gap-2 rounded-xl border border-green-500/30 bg-green-500/20 px-4 py-3 text-sm font-semibold text-green-400 transition-all hover:scale-105 hover:bg-green-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ pointerEvents: "auto", zIndex: 10 }}
                >
                  {isVoting === "up" ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-green-400/30 border-t-green-400" />
                  ) : (
                    <>
                      <span className="text-lg">👍</span>
                      <span>Vote Up</span>
                    </>
                  )}
                </button>

                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log(
                      "🚨 DOWN VOTE CLICKED - THIS SHOULD ALWAYS WORK!",
                    );
                    handleVote("down");
                  }}
                  disabled={isVoting !== null}
                  className="flex items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/20 px-4 py-3 text-sm font-semibold text-red-400 transition-all hover:scale-105 hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ pointerEvents: "auto", zIndex: 10 }}
                >
                  {isVoting === "down" ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-400/30 border-t-red-400" />
                  ) : (
                    <>
                      <span className="text-lg">👎</span>
                      <span>Vote Down</span>
                    </>
                  )}
                </button>
              </div>
              {(() => {
                const autoStatus = getAutomaticInscriptionStatus();
                return autoStatus ? (
                  <div
                    className={`flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium ${autoStatus.bg} ${autoStatus.color}`}
                  >
                    <span>{autoStatus.icon}</span>
                    <span className="text-center">{autoStatus.text}</span>
                  </div>
                ) : null;
              })()}
            </>
          )}
          {status === "leader" && (
            <div className="space-y-3">
              {(() => {
                const autoStatus = getAutomaticInscriptionStatus();
                return autoStatus ? (
                  <div className="space-y-2">
                    <div
                      className={`flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${autoStatus.bg} ${autoStatus.color}`}
                    >
                      <span className="text-base">{autoStatus.icon}</span>
                      <span className="text-center">{autoStatus.text}</span>
                    </div>
                    {autoStatus.details && (
                      <div className="rounded-lg bg-gray-800/50 px-3 py-2 text-center text-xs text-gray-400">
                        {autoStatus.details}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex w-full items-center justify-center gap-2 rounded-xl border border-yellow-500/30 bg-yellow-500/20 px-4 py-3 text-sm font-semibold text-yellow-400">
                    <span>👑</span>
                    <span>Leading the Vote</span>
                  </div>
                );
              })()}
            </div>
          )}
          {status === "inscribing" && (
            <div className="space-y-3">
              {(() => {
                const autoStatus = getAutomaticInscriptionStatus();
                return (
                  <div className="space-y-2">
                    <div
                      className={`flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${autoStatus?.bg || "border-blue-500/30 bg-blue-500/20"} ${autoStatus?.color || "text-blue-400"}`}
                    >
                      <div className="flex items-center gap-2">
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "linear",
                          }}
                          className="h-4 w-4 rounded-full border-2 border-blue-400/30 border-t-blue-400"
                        />
                        <span>Bitcoin Inscription in Progress</span>
                      </div>
                    </div>

                    {autoStatus?.details && (
                      <div className="rounded-lg bg-gray-800/50 px-3 py-2 text-center text-xs text-gray-400">
                        {autoStatus.details}
                      </div>
                    )}

                    {autoStatus?.subDetails && (
                      <div className="text-center text-xs text-gray-500">
                        {autoStatus.subDetails}
                      </div>
                    )}
                    <div className="flex items-center justify-center gap-2 text-xs text-blue-400">
                      <div className="h-2 w-2 animate-pulse rounded-full bg-blue-400"></div>
                      <span>Live on Bitcoin Network</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
          {status === "expired" && (
            <div className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/20 px-4 py-3 text-sm font-semibold text-red-400">
              <span className="text-base">💀</span>
              <span>ELIMINATED FROM COMPETITION</span>
            </div>
          )}
          {status === "rejected" && (
            <div className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/20 px-4 py-3 text-sm font-semibold text-red-400">
              <span className="text-base">❌</span>
              <span>Proposal Rejected</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
