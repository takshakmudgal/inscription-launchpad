"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  Users,
  Clock,
  Bitcoin,
  Twitter,
  Send,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useWallet } from "~/components/providers";
import type { Proposal, Inscription } from "~/types";

interface ProposalPageProps {
  params: Promise<{ proposalId: string }>;
}

interface PumpFunToken {
  mintAddress: string;
  transactionSignature: string;
  metadataUri: string;
}

export default function ProposalPage({ params }: ProposalPageProps) {
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [inscription, setInscription] = useState<Inscription | null>(null);
  const [pumpToken, setPumpToken] = useState<PumpFunToken | null>(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState<"up" | "down" | null>(null);
  const [resolvedParams, setResolvedParams] = useState<{
    proposalId: string;
  } | null>(null);

  const { walletAddress } = useWallet();

  // Resolve the params Promise
  useEffect(() => {
    params.then(setResolvedParams);
  }, [params]);

  useEffect(() => {
    if (!resolvedParams?.proposalId) return;

    const fetchProposal = async () => {
      try {
        const response = await fetch(
          `/api/proposals/${resolvedParams.proposalId}`,
        );
        const data = await response.json();

        if (data.success) {
          setProposal(data.data);
          if (data.data.inscription) {
            setInscription(data.data.inscription);
          }
          if (data.data.pumpFunToken) {
            setPumpToken(data.data.pumpFunToken);
          }
        } else {
          toast.error("Failed to load proposal");
        }
      } catch (error) {
        console.error("Error fetching proposal:", error);
        toast.error("An error occurred while loading the proposal");
      } finally {
        setLoading(false);
      }
    };

    fetchProposal();
  }, [resolvedParams]);

  const handleVote = async (voteType: "up" | "down") => {
    if (!walletAddress) {
      toast.error("Please connect your wallet to vote");
      return;
    }

    if (!proposal) return;

    setVoting(voteType);
    try {
      const response = await fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposalId: proposal.id,
          voteType,
          walletAddress,
        }),
      });

      const data = await response.json();
      if (data.success) {
        // Refresh proposal data
        const updatedResponse = await fetch(`/api/proposals/${proposal.id}`);
        const updatedData = await updatedResponse.json();
        if (updatedData.success) {
          setProposal(updatedData.data);
        }
        toast.success("Vote submitted successfully!");
      } else {
        toast.error(data.error || "Failed to submit vote");
      }
    } catch (error) {
      console.error("Vote error:", error);
      toast.error("An error occurred while voting");
    } finally {
      setVoting(null);
    }
  };

  const getStatusBadge = () => {
    if (!proposal) return null;

    switch (proposal.status) {
      case "leader":
        return {
          text: "LEADING",
          className: "bg-amber-500 text-white",
        };
      case "inscribing":
        return {
          text: "INSCRIBING",
          className: "bg-orange-500 text-white",
        };
      case "inscribed":
        return {
          text: "IMMORTAL",
          className: "bg-yellow-500 text-white",
        };
      case "expired":
        return {
          text: "ELIMINATED",
          className: "bg-red-500 text-white",
        };
      default:
        return {
          text: "ACTIVE",
          className: "bg-amber-600 text-white",
        };
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950">
        <div className="space-y-4 text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-orange-500 border-t-transparent"></div>
          <p className="text-white/80">Loading proposal...</p>
        </div>
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950">
        <div className="space-y-4 text-center">
          <h1 className="text-2xl font-bold text-white">Proposal Not Found</h1>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 px-6 py-3 font-medium text-white transition-transform hover:scale-105"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const statusBadge = getStatusBadge();
  const votePercentage =
    proposal.totalVotes > 0
      ? (proposal.votesUp / proposal.totalVotes) * 100
      : 50;

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="container mx-auto px-4 py-6 sm:px-6 sm:py-12">
        <div className="mb-6 flex items-center justify-between sm:mb-8">
          <Link
            href="/"
            className="flex items-center gap-2 text-white/80 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="text-sm sm:text-base">Back to Proposals</span>
          </Link>

          {statusBadge && (
            <div
              className={`rounded-full px-3 py-1 text-xs font-bold sm:px-4 sm:py-2 sm:text-sm ${statusBadge.className}`}
            >
              {statusBadge.text}
            </div>
          )}
        </div>
        <div className="mx-auto max-w-4xl">
          {/* Main Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="grid grid-cols-1 gap-6 sm:gap-8 lg:grid-cols-3"
          >
            {/* Left Column - Main Info */}
            <div className="space-y-6 sm:space-y-8 lg:col-span-2">
              {/* Hero Section */}
              <div className="relative overflow-hidden rounded-2xl border border-amber-600/20 bg-white/5 backdrop-blur-xl">
                <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-600 opacity-20 blur"></div>

                {/* Banner Image */}
                {proposal?.bannerUrl && (
                  <div className="relative h-32 overflow-hidden rounded-t-2xl sm:h-40 lg:h-48">
                    <Image
                      src={proposal.bannerUrl}
                      alt={`${proposal.name} banner`}
                      fill
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60" />
                  </div>
                )}

                <div
                  className={`relative p-4 sm:p-6 lg:p-8 ${proposal?.bannerUrl ? "pt-6" : ""}`}
                >
                  <div className="flex flex-col items-start gap-4 sm:flex-row sm:gap-6">
                    <div className="relative flex-shrink-0">
                      <Image
                        src={proposal.imageUrl}
                        alt={proposal.name}
                        width={80}
                        height={80}
                        className="rounded-2xl object-cover sm:h-24 sm:w-24 lg:h-32 lg:w-32"
                      />
                      <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-600 opacity-30 blur-sm"></div>
                    </div>

                    <div className="min-w-0 flex-1">
                      <h1 className="mb-2 text-2xl font-bold text-white sm:mb-3 sm:text-3xl lg:text-4xl">
                        {proposal.name}
                      </h1>
                      <div className="mb-3 flex flex-wrap items-center gap-3 sm:mb-4 sm:gap-4">
                        <span className="font-mono text-base font-bold text-orange-400 sm:text-lg">
                          ${proposal.ticker}
                        </span>
                        {proposal.submitter && (
                          <span className="text-sm text-white/70 sm:text-base">
                            by {proposal.submitter.username || "Unknown"}
                          </span>
                        )}
                      </div>

                      {/* External Links */}
                      <div className="flex flex-wrap gap-2 sm:gap-3">
                        {proposal.website && (
                          <a
                            href={proposal.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg border border-amber-600/20 bg-white/5 px-3 py-1.5 text-xs text-white/80 transition-all hover:bg-white/10 hover:text-white sm:gap-2 sm:px-4 sm:py-2 sm:text-sm"
                          >
                            <ExternalLink className="h-3 w-3 sm:h-4 sm:w-4" />
                            Website
                          </a>
                        )}
                        {proposal.twitter && (
                          <a
                            href={
                              proposal.twitter.startsWith("https://")
                                ? proposal.twitter
                                : `https://twitter.com/${proposal.twitter.replace(
                                    /^@/,
                                    "",
                                  )}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg border border-amber-600/20 bg-white/5 px-3 py-1.5 text-xs text-white/80 transition-all hover:bg-white/10 hover:text-white sm:gap-2 sm:px-4 sm:py-2 sm:text-sm"
                          >
                            <Twitter className="h-3 w-3 sm:h-4 sm:w-4" />
                            Twitter
                          </a>
                        )}
                        {proposal.telegram && (
                          <a
                            href={proposal.telegram}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg border border-amber-600/20 bg-white/5 px-3 py-1.5 text-xs text-white/80 transition-all hover:bg-white/10 hover:text-white sm:gap-2 sm:px-4 sm:py-2 sm:text-sm"
                          >
                            <Send className="h-3 w-3 sm:h-4 sm:w-4" />
                            Telegram
                          </a>
                        )}

                        {inscription?.inscriptionUrl && (
                          <a
                            href={inscription.inscriptionUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg border border-orange-500/30 bg-orange-500/20 px-3 py-1.5 text-xs text-orange-400 transition-all hover:bg-orange-500/30 sm:gap-2 sm:px-4 sm:py-2 sm:text-sm"
                          >
                            <Bitcoin className="h-3 w-3 sm:h-4 sm:w-4" />
                            View Inscription
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="rounded-2xl border border-amber-600/20 bg-white/5 p-4 backdrop-blur-xl sm:p-6 lg:p-8">
                <h2 className="mb-3 text-xl font-bold text-white sm:mb-4 sm:text-2xl">
                  About This Meme
                </h2>
                <p className="text-sm leading-relaxed text-white/80 sm:text-base lg:text-lg">
                  {proposal.description}
                </p>
              </div>

              {/* Inscription Status */}
              {(proposal.status === "inscribed" ||
                proposal.status === "inscribing") &&
                inscription && (
                  <div className="rounded-2xl border border-amber-600/20 bg-white/5 p-4 backdrop-blur-xl sm:p-6 lg:p-8">
                    <h2 className="mb-3 flex items-center gap-2 text-xl font-bold text-white sm:mb-4 sm:gap-3 sm:text-2xl">
                      <Bitcoin className="h-5 w-5 text-orange-400 sm:h-6 sm:w-6" />
                      Bitcoin Inscription
                    </h2>

                    <div className="space-y-3 sm:space-y-4">
                      {inscription.inscriptionId && (
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-4">
                          <span className="text-sm text-white/70 sm:text-base">
                            Inscription ID:
                          </span>
                          <span className="font-mono text-xs break-all text-orange-400 sm:col-span-2 sm:text-sm">
                            {inscription.inscriptionId}
                          </span>
                        </div>
                      )}

                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-4">
                        <span className="text-sm text-white/70 sm:text-base">
                          Block Height:
                        </span>
                        <span className="text-sm text-white sm:col-span-2 sm:text-base">
                          {inscription.blockHeight.toLocaleString()}
                        </span>
                      </div>

                      {inscription.txid && (
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-4">
                          <span className="text-sm text-white/70 sm:text-base">
                            Transaction:
                          </span>
                          <span className="font-mono text-xs break-all text-orange-400 sm:col-span-2 sm:text-sm">
                            {inscription.txid}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

              {/* Pump.fun Token Details */}
              {pumpToken && (
                <div className="rounded-2xl border border-amber-600/20 bg-white/5 p-4 backdrop-blur-xl sm:p-6 lg:p-8">
                  <h2 className="mb-3 flex items-center gap-2 text-xl font-bold text-white sm:mb-4 sm:gap-3 sm:text-2xl">
                    <Image
                      src="/solana_logo.png"
                      alt="Solana"
                      width={80}
                      height={80}
                    />
                    Solana Pump.fun Token
                  </h2>

                  <div className="space-y-3 text-sm sm:space-y-4">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-4">
                      <span className="text-white/70">Mint Address:</span>
                      <a
                        href={`https://solscan.io/token/${pumpToken.mintAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono break-all text-orange-400 hover:underline sm:col-span-2"
                      >
                        {pumpToken.mintAddress}
                      </a>
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-4">
                      <span className="text-white/70">Transaction:</span>
                      <a
                        href={`https://solscan.io/tx/${pumpToken.transactionSignature}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono break-all text-orange-400 hover:underline sm:col-span-2"
                      >
                        {pumpToken.transactionSignature}
                      </a>
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-4">
                      <span className="text-white/70">Metadata URI:</span>
                      <a
                        href={pumpToken.metadataUri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="break-all text-orange-400 hover:underline sm:col-span-2"
                      >
                        {pumpToken.metadataUri}
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column - Voting & Stats */}
            <div className="space-y-6">
              {/* Voting Section */}
              {proposal.status === "active" && (
                <div className="rounded-2xl border border-amber-600/20 bg-white/5 p-4 backdrop-blur-xl sm:p-6">
                  <h3 className="mb-4 text-lg font-bold text-white sm:text-xl">
                    Cast Your Vote
                  </h3>

                  <div className="space-y-3">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleVote("up")}
                      disabled={voting === "up" || !walletAddress}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-green-500/30 bg-green-500/20 py-3 font-medium text-green-400 transition-all hover:bg-green-500/30 disabled:opacity-50 sm:py-4"
                    >
                      {voting === "up" ? (
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-green-400 border-t-transparent" />
                      ) : (
                        <svg
                          className="h-5 w-5"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                      )}
                      <span>Upvote</span>
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleVote("down")}
                      disabled={voting === "down" || !walletAddress}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/20 py-3 font-medium text-red-400 transition-all hover:bg-red-500/30 disabled:opacity-50 sm:py-4"
                    >
                      {voting === "down" ? (
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-red-400 border-t-transparent" />
                      ) : (
                        <svg
                          className="h-5 w-5"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                          transform="rotate(180)"
                        >
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                      )}
                      <span>Downvote</span>
                    </motion.button>
                  </div>

                  {!walletAddress && (
                    <p className="mt-3 text-center text-xs text-white/60 sm:text-sm">
                      Connect your wallet to vote
                    </p>
                  )}
                </div>
              )}

              {/* Stats */}
              <div className="rounded-2xl border border-amber-600/20 bg-white/5 p-4 backdrop-blur-xl sm:p-6">
                <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-white sm:text-xl">
                  <Users className="h-5 w-5 text-orange-400" />
                  Vote Statistics
                </h3>

                <div className="space-y-4">
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm text-white/70">Total Votes</span>
                      <span className="text-lg font-bold text-white">
                        {proposal.totalVotes}
                      </span>
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm text-green-400">Upvotes</span>
                      <span className="text-white">{proposal.votesUp}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full bg-gradient-to-r from-green-400 to-green-500 transition-all duration-500"
                        style={{ width: `${votePercentage}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm text-red-400">Downvotes</span>
                      <span className="text-white">{proposal.votesDown}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* <div className="rounded-2xl border border-amber-600/20 bg-white/5 p-4 backdrop-blur-xl sm:p-6">
                <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-white sm:text-xl">
                  <ShieldCheck className="h-5 w-5 text-orange-400" />
                  Competition Details
                </h3>
                <div className="space-y-3 text-sm">
                  {proposal.leaderStartBlock && (
                    <div className="flex justify-between">
                      <span className="text-white/70">
                        Became Leader at Block:
                      </span>
                      <span className="text-white">
                        {proposal.leaderStartBlock.toLocaleString()}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-white/70">
                      Min. Blocks as Leader:
                    </span>
                    <span className="text-white">
                      {proposal.leaderboardMinBlocks}
                    </span>
                  </div>
                  {proposal.expirationBlock && (
                    <div className="flex justify-between">
                      <span className="text-white/70">Expires at Block:</span>
                      <span className="text-white">
                        {proposal.expirationBlock.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div> */}

              {/* Additional Info */}
              <div className="rounded-2xl border border-amber-600/20 bg-white/5 p-4 backdrop-blur-xl sm:p-6">
                <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-white sm:text-xl">
                  <Clock className="h-5 w-5 text-orange-400" />
                  Timeline
                </h3>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-white/70">Created:</span>
                    <span className="text-white">
                      {new Date(proposal.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {proposal.firstTimeAsLeader && (
                    <div className="flex justify-between">
                      <span className="text-white/70">First as Leader:</span>
                      <span className="text-white">
                        {new Date(
                          proposal.firstTimeAsLeader,
                        ).toLocaleDateString()}
                      </span>
                    </div>
                  )}

                  {inscription && (
                    <div className="flex justify-between">
                      <span className="text-white/70">Inscribed:</span>
                      <span className="text-white">
                        {new Date(inscription.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
