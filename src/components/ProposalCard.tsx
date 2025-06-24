"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { getActiveOrdersFromStorage } from "./InscriptionModal";

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
  status: "active" | "inscribed" | "rejected";
  onVote: (proposalId: number, voteType: "up" | "down") => void;
  onInscribe: (proposalId: number) => void;
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
  onVote,
  onInscribe,
}: ProposalCardProps) {
  const [imageError, setImageError] = useState(false);
  const [isVoting, setIsVoting] = useState<"up" | "down" | null>(null);
  const [inscriptionStatus, setInscriptionStatus] = useState<{
    hasActiveOrder: boolean;
    orderStatus: string;
    orderId?: string;
  }>({ hasActiveOrder: false, orderStatus: "" });

  // Check for active inscription orders for this proposal
  useEffect(() => {
    const checkInscriptionStatus = async () => {
      try {
        // First check local storage for active orders
        const activeOrders = getActiveOrdersFromStorage();
        const proposalOrder = Object.values(activeOrders).find(
          (order) => order.proposalId === id,
        );

        if (proposalOrder) {
          // Check the actual status from the API
          const response = await fetch(
            `/api/unisat/order/${proposalOrder.orderId}`,
          );
          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              setInscriptionStatus({
                hasActiveOrder: true,
                orderStatus: data.data.status,
                orderId: proposalOrder.orderId,
              });
              return;
            }
          }

          // Fallback to stored status
          setInscriptionStatus({
            hasActiveOrder: true,
            orderStatus: proposalOrder.status || "pending",
            orderId: proposalOrder.orderId,
          });
        } else {
          // Check if proposal has an inscription via API
          const response = await fetch(
            `/api/proposals/${id}/inscription-status`,
          );
          if (response.ok) {
            const data = await response.json();
            if (
              data.success &&
              data.data.hasInscription &&
              data.data.orderStatus
            ) {
              setInscriptionStatus({
                hasActiveOrder:
                  data.data.orderStatus !== "minted" &&
                  data.data.orderStatus !== "sent",
                orderStatus: data.data.orderStatus,
                orderId: data.data.orderId,
              });
            }
          }
        }
      } catch (error) {
        console.error("Error checking inscription status:", error);
      }
    };

    if (status === "active") {
      checkInscriptionStatus();
    }
  }, [id, status]);

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

  const handleInscribe = () => {
    console.log(`⚡ Inscribe button clicked for proposal ${id}`);
    onInscribe(id);
  };

  const votePercentage = totalVotes > 0 ? (votesUp / totalVotes) * 100 : 50;

  const getStatusBadge = () => {
    switch (status) {
      case "inscribed":
        return (
          <div className="inline-flex items-center gap-1 rounded-full border border-green-500/30 bg-green-500/20 px-3 py-1 text-xs font-medium text-green-400">
            <span>✅</span>
            Inscribed on Bitcoin
          </div>
        );
      case "rejected":
        return (
          <div className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/20 px-3 py-1 text-xs font-medium text-red-400">
            <span>❌</span>
            Rejected
          </div>
        );
      default:
        return (
          <div className="inline-flex items-center gap-1 rounded-full border border-green-500/30 bg-green-500/20 px-3 py-1 text-xs font-medium text-green-400">
            <span>✨</span>
            Active
          </div>
        );
    }
  };

  const getInscriptionStatusDisplay = (orderStatus: string) => {
    switch (orderStatus) {
      case "pending":
        return {
          text: "⏳ Awaiting Payment",
          color: "text-yellow-400",
          bg: "bg-yellow-500/20 border-yellow-500/30",
        };
      case "payment_received":
      case "payment_success":
        return {
          text: "💳 Payment Received",
          color: "text-blue-400",
          bg: "bg-blue-500/20 border-blue-500/30",
        };
      case "inscribing":
        return {
          text: "⚡ Creating Inscription",
          color: "text-purple-400",
          bg: "bg-purple-500/20 border-purple-500/30",
        };
      case "minted":
      case "sent":
        return {
          text: "✅ Inscription Complete",
          color: "text-green-400",
          bg: "bg-green-500/20 border-green-500/30",
        };
      case "canceled":
        return {
          text: "❌ Canceled",
          color: "text-red-400",
          bg: "bg-red-500/20 border-red-500/30",
        };
      case "refunded":
        return {
          text: "↩️ Refunded",
          color: "text-orange-400",
          bg: "bg-orange-500/20 border-orange-500/30",
        };
      default:
        return {
          text: "⏳ Processing",
          color: "text-yellow-400",
          bg: "bg-yellow-500/20 border-yellow-500/30",
        };
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -5 }}
      className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-gray-900/50 to-black/50 p-6 shadow-xl backdrop-blur-sm transition-all duration-300 hover:border-white/20 hover:shadow-2xl"
    >
      {/* Background glow effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-pink-500/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      {/* Status Badge */}
      <div className="mb-4 flex items-start justify-between">
        {getStatusBadge()}
        <div className="text-right">
          <div className="text-sm text-gray-400">Creator</div>
          <div className="text-sm font-medium text-white">{creator}</div>
        </div>
      </div>

      {/* Meme Image */}
      <div className="relative mb-4 overflow-hidden rounded-xl">
        {!imageError ? (
          <img
            src={imageUrl}
            alt={`${name} meme`}
            className="h-48 w-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="flex h-48 w-full items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
            <div className="text-center">
              <div className="mb-2 text-4xl">🎭</div>
              <div className="text-sm text-gray-400">Image not available</div>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="space-y-3">
        {/* Title & Ticker */}
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold text-white">{name}</h3>
            <span className="rounded-lg border border-orange-500/30 bg-gradient-to-r from-orange-500/20 to-amber-500/20 px-2 py-1 text-xs font-bold text-orange-400">
              ${ticker}
            </span>
          </div>
        </div>

        {/* Description */}
        <p className="line-clamp-2 text-sm text-gray-300">{description}</p>

        {/* Vote Progress - Only show for active proposals */}
        {status === "active" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Community Vote</span>
              <span className="font-semibold text-white">
                {totalVotes === 1
                  ? "1 vote"
                  : `${totalVotes.toLocaleString()} votes`}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="h-2 overflow-hidden rounded-full bg-gray-800">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${votePercentage}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="h-full bg-gradient-to-r from-green-500 to-emerald-400"
              />
            </div>

            {/* Vote counts */}
            <div className="flex justify-between text-xs text-gray-400">
              <span>👍 {votesUp.toLocaleString()}</span>
              <span>👎 {votesDown.toLocaleString()}</span>
            </div>
          </div>
        )}

        {/* Inscribed Proposal Info - Show final stats for inscribed proposals */}
        {status === "inscribed" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Final Results</span>
              <span className="font-semibold text-white">
                {totalVotes === 1
                  ? "1 vote"
                  : `${totalVotes.toLocaleString()} votes`}
              </span>
            </div>

            {/* Final Progress Bar */}
            <div className="h-2 overflow-hidden rounded-full bg-gray-800">
              <div
                style={{ width: `${votePercentage}%` }}
                className="h-full bg-gradient-to-r from-green-500 to-emerald-400"
              />
            </div>

            {/* Final Vote counts */}
            <div className="flex justify-between text-xs text-gray-400">
              <span>👍 {votesUp.toLocaleString()}</span>
              <span>👎 {votesDown.toLocaleString()}</span>
            </div>

            {/* Inscription info */}
            <div className="mt-3 rounded-lg border border-green-500/20 bg-green-500/10 p-3">
              <div className="text-xs text-green-400">
                ✅ Permanently inscribed on Bitcoin blockchain
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          {/* Vote Buttons - Only show for active proposals */}
          {status === "active" && (
            <>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log("🚨 BUTTON CLICKED - THIS SHOULD ALWAYS WORK!");
                  handleVote("up");
                }}
                disabled={isVoting !== null}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-green-500/30 bg-green-500/20 px-4 py-3 text-sm font-semibold text-green-400 transition-all hover:scale-105 hover:bg-green-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                style={{ pointerEvents: "auto", zIndex: 10 }}
              >
                {isVoting === "up" ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-green-400/30 border-t-green-400" />
                ) : (
                  <>
                    <span>👍</span>
                    Vote
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
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/20 px-4 py-3 text-sm font-semibold text-red-400 transition-all hover:scale-105 hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                style={{ pointerEvents: "auto", zIndex: 10 }}
              >
                {isVoting === "down" ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-400/30 border-t-red-400" />
                ) : (
                  <>
                    <span>👎</span>
                    Vote
                  </>
                )}
              </button>
            </>
          )}

          {/* Inscribe Button / Status */}
          {status === "active" ? (
            inscriptionStatus.hasActiveOrder ? (
              <button
                disabled
                className={`flex w-full cursor-default items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${
                  getInscriptionStatusDisplay(inscriptionStatus.orderStatus).bg
                } ${getInscriptionStatusDisplay(inscriptionStatus.orderStatus).color}`}
              >
                {
                  getInscriptionStatusDisplay(inscriptionStatus.orderStatus)
                    .text
                }
              </button>
            ) : (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log("🚨 INSCRIBE CLICKED - THIS SHOULD ALWAYS WORK!");
                  handleInscribe();
                }}
                className="flex items-center justify-center gap-2 rounded-xl border border-purple-500/30 bg-gradient-to-r from-purple-500/20 to-pink-500/20 px-4 py-3 text-sm font-semibold text-purple-400 transition-all hover:scale-105 hover:from-purple-500/30 hover:to-pink-500/30"
                style={{ pointerEvents: "auto", zIndex: 10 }}
              >
                <span>⚡</span>
                Inscribe
              </button>
            )
          ) : status === "inscribed" ? (
            <button
              disabled
              className="flex w-full cursor-default items-center justify-center gap-2 rounded-xl border border-green-500/30 bg-green-500/20 px-4 py-3 text-sm font-semibold text-green-400"
            >
              <span>🏆</span>
              Permanently Inscribed
            </button>
          ) : (
            <button
              disabled
              className="flex cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-gray-500/30 bg-gray-500/20 px-4 py-3 text-sm font-semibold text-gray-400"
            >
              <span>❌</span>
              Rejected
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
