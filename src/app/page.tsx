"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ProposalCard } from "~/components/ProposalCard";
import { SubmitProposalModal } from "~/components/SubmitProposalModal";
import { WalletConnectModal } from "~/components/WalletConnectModal";
import { InscriptionModal } from "~/components/InscriptionModal";
import { useWallet } from "~/components/providers";
import type { Proposal, ApiResponse } from "~/types";

interface ProposalsResponse {
  proposals: Proposal[];
}

interface BlockResponse {
  block: {
    height: number;
  };
}

interface InscriptionStatus {
  hasInscription: boolean;
  orderStatus?: string;
  orderId?: string;
  inscriptionId?: string;
  inscriptionUrl?: string;
  paymentAmount?: number;
  paymentAddress?: string;
}

export default function HomePage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [isInscriptionModalOpen, setIsInscriptionModalOpen] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(
    null,
  );
  const [currentBlock, setCurrentBlock] = useState(4546377);
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<"trending" | "new" | "top">(
    "trending",
  );
  const { walletAddress, isConnected, disconnect } = useWallet();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Fetch proposals
    fetch("/api/proposals")
      .then((res) => res.json())
      .then((data: ApiResponse<ProposalsResponse>) => {
        if (data.success && data.data?.proposals) {
          setProposals(data.data.proposals);
        }
      })
      .catch(console.error);

    // Fetch current block
    fetch("/api/blocks/latest")
      .then((res) => res.json())
      .then((data: ApiResponse<BlockResponse>) => {
        if (data.success && data.data?.block?.height) {
          setCurrentBlock(data.data.block.height);
        }
      })
      .catch(console.error);
  }, []);

  const handleProposalSubmit = async (proposal: {
    name: string;
    ticker: string;
    description: string;
    imageUrl: string;
    creator: string;
  }) => {
    if (!isConnected) {
      setIsWalletModalOpen(true);
      return;
    }

    try {
      const response = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...proposal,
          walletAddress,
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as ApiResponse<Proposal>;
        if (data.success && data.data) {
          setProposals([data.data, ...proposals]);
        }
      }
    } catch (error) {
      console.error("Error submitting proposal:", error);
    }
  };

  const handleVote = async (proposalId: number, voteType: "up" | "down") => {
    if (!isConnected) {
      setIsWalletModalOpen(true);
      return;
    }

    try {
      const response = await fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposalId,
          voteType,
          walletAddress,
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as ApiResponse<{
          success: boolean;
        }>;
        if (data.success) {
          // Refetch proposals to get updated vote counts
          const proposalsResponse = await fetch("/api/proposals");
          const proposalsData =
            (await proposalsResponse.json()) as ApiResponse<ProposalsResponse>;
          if (proposalsData.success && proposalsData.data?.proposals) {
            setProposals(proposalsData.data.proposals);
          }
        }
      }
    } catch (error) {
      console.error("Error voting:", error);
    }
  };

  const handleInscribe = async (proposalId: number) => {
    if (!isConnected) {
      setIsWalletModalOpen(true);
      return;
    }

    // Find the proposal to get its details
    const proposal = proposals.find((p) => p.id === proposalId);
    if (!proposal) {
      console.error("Proposal not found");
      return;
    }

    // Check if proposal is already inscribed or has pending inscription
    if (proposal.status === "inscribed") {
      alert("This proposal has already been inscribed on Bitcoin!");
      return;
    }

    if (proposal.status === "rejected") {
      alert("This proposal has been rejected and cannot be inscribed.");
      return;
    }

    // Check for existing inscription orders
    try {
      const statusResponse = await fetch(
        `/api/proposals/${proposalId}/inscription-status`,
      );
      const statusData =
        (await statusResponse.json()) as ApiResponse<InscriptionStatus>;

      if (statusData.success && statusData.data?.hasInscription) {
        const status = statusData.data;

        if (status.orderStatus === "minted" || status.orderStatus === "sent") {
          alert("This proposal has already been successfully inscribed!");
          // Refresh proposals to get updated status
          const proposalsResponse = await fetch("/api/proposals");
          const proposalsData =
            (await proposalsResponse.json()) as ApiResponse<ProposalsResponse>;
          if (proposalsData.success && proposalsData.data?.proposals) {
            setProposals(proposalsData.data.proposals);
          }
          return;
        }

        if (
          status.orderStatus === "pending" ||
          status.orderStatus === "inscribing"
        ) {
          const proceed = confirm(
            `This proposal already has a pending inscription order (Status: ${status.orderStatus}). ` +
              "Would you like to view the existing order instead of creating a new one?",
          );
          if (!proceed) {
            return;
          }
          // Could open existing order modal here instead
        }

        if (
          status.orderStatus === "canceled" ||
          status.orderStatus === "refunded"
        ) {
          const proceed = confirm(
            `This proposal had a previous inscription order that was ${status.orderStatus}. ` +
              "Would you like to create a new order?",
          );
          if (!proceed) {
            return;
          }
        }
      }
    } catch (error) {
      console.error("Error checking inscription status:", error);
      // Continue with inscription if status check fails
    }

    // Set the selected proposal and open the inscription modal
    setSelectedProposal(proposal);
    setIsInscriptionModalOpen(true);
  };

  const getFilteredProposals = () => {
    const sorted = [...proposals];
    switch (activeTab) {
      case "trending":
        return sorted.sort((a, b) => {
          const aScore =
            (a.votesUp - a.votesDown) /
            (Date.now() - new Date(a.createdAt).getTime());
          const bScore =
            (b.votesUp - b.votesDown) /
            (Date.now() - new Date(b.createdAt).getTime());
          return bScore - aScore;
        });
      case "new":
        return sorted.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
      case "top":
        return sorted.sort(
          (a, b) => b.votesUp - b.votesDown - (a.votesUp - a.votesDown),
        );
      default:
        return sorted;
    }
  };

  const totalVotes = proposals.reduce((sum, p) => sum + p.totalVotes, 0);

  if (!mounted) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
      {/* Header */}
      <header className="relative border-b border-white/10 bg-black/50 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-20 items-center justify-between">
            {/* Logo */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-xl font-bold text-black shadow-lg">
                🚀
              </div>
              <div>
                <h1 className="bg-gradient-to-r from-white to-gray-300 bg-clip-text text-2xl font-bold text-transparent">
                  BitMemes
                </h1>
                <p className="text-xs text-gray-400">Meme Contest Platform</p>
              </div>
            </motion.div>

            {/* Stats */}
            <div className="hidden items-center gap-8 md:flex">
              <div className="text-center">
                <div className="text-lg font-bold text-white">
                  {totalVotes.toLocaleString()}
                </div>
                <div className="text-xs text-gray-400">Total Votes</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-white">
                  {proposals.length}
                </div>
                <div className="text-xs text-gray-400">Proposals</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-white">
                  #{currentBlock.toLocaleString()}
                </div>
                <div className="text-xs text-gray-400">Current Block</div>
              </div>
            </div>

            {/* Wallet & Submit Button */}
            <div className="flex items-center gap-3">
              {isConnected ? (
                <div className="flex items-center gap-3">
                  <div className="hidden text-right sm:block">
                    <div className="text-xs text-gray-400">Connected</div>
                    <div className="font-mono text-sm text-white">
                      {walletAddress?.slice(0, 6)}...{walletAddress?.slice(-4)}
                    </div>
                  </div>
                  <button
                    onClick={disconnect}
                    className="rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-medium text-gray-300 transition-all hover:bg-white/10 hover:text-white"
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsWalletModalOpen(true)}
                  className="rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-2 text-sm font-semibold text-orange-400 transition-all hover:bg-orange-500/20"
                >
                  🔗 Connect Wallet
                </button>
              )}

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsModalOpen(true)}
                className="rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 px-6 py-3 font-bold text-white shadow-lg transition-all hover:from-purple-600 hover:to-pink-600"
              >
                🎭 Submit Meme
              </motion.button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-extrabold text-white sm:text-6xl"
          >
            The Ultimate
            <span className="bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">
              {" "}
              Meme Battle{" "}
            </span>
            Arena
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-6 text-xl text-gray-300"
          >
            Submit your meme coins, vote for the best, and watch winners get
            inscribed on Bitcoin forever.
          </motion.p>

          {/* Call to Action */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-8 flex flex-col justify-center gap-4 sm:flex-row"
          >
            <button
              onClick={() => {
                if (!isConnected) {
                  setIsWalletModalOpen(true);
                } else {
                  setIsModalOpen(true);
                }
              }}
              className="rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 px-8 py-4 text-lg font-bold text-white shadow-xl transition-all hover:scale-105 hover:from-purple-600 hover:to-pink-600"
            >
              🚀 Submit Your Meme
            </button>
            <button
              onClick={() =>
                document
                  .getElementById("proposals")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
              className="rounded-xl border border-white/20 bg-white/5 px-8 py-4 text-lg font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/10"
            >
              🗳️ Vote Now
            </button>
          </motion.div>
        </div>

        {/* Background decoration */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-40 -right-32 h-80 w-80 rounded-full bg-purple-500/20 blur-3xl" />
          <div className="absolute -bottom-40 -left-32 h-80 w-80 rounded-full bg-pink-500/20 blur-3xl" />
        </div>
      </section>

      {/* Proposals Section */}
      <section id="proposals" className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          {/* Section Header */}
          <div className="mb-12 text-center">
            <h3 className="text-3xl font-bold text-white">
              🏆 Meme Leaderboard
            </h3>
            <p className="mt-4 text-gray-400">
              Vote for your favorite memes. Top proposals get inscribed on
              Bitcoin!
            </p>
          </div>

          {/* Filter Tabs */}
          <div className="mb-8 flex justify-center">
            <div className="flex rounded-xl bg-white/5 p-1 backdrop-blur-sm">
              {[
                {
                  key: "trending",
                  label: "🔥 Trending",
                  desc: "Hot right now",
                },
                { key: "new", label: "✨ New", desc: "Latest submissions" },
                { key: "top", label: "👑 Top", desc: "Most voted" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as typeof activeTab)}
                  className={`relative rounded-lg px-6 py-3 text-sm font-medium transition-all ${
                    activeTab === tab.key
                      ? "bg-white/10 text-white shadow-lg"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Proposals Grid */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
            >
              {getFilteredProposals().map((proposal, index) => (
                <motion.div
                  key={proposal.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <ProposalCard
                    id={proposal.id}
                    name={proposal.name}
                    ticker={proposal.ticker}
                    description={proposal.description}
                    imageUrl={proposal.imageUrl}
                    creator={
                      proposal.submittedBy
                        ? `User #${proposal.submittedBy}`
                        : "Anonymous"
                    }
                    votesUp={proposal.votesUp}
                    votesDown={proposal.votesDown}
                    totalVotes={proposal.totalVotes}
                    status={proposal.status}
                    onVote={handleVote}
                    onInscribe={handleInscribe}
                  />
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>

          {/* Empty State */}
          {proposals.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-16 text-center"
            >
              <div className="mb-4 text-6xl">🎭</div>
              <h3 className="mb-2 text-xl font-semibold text-white">
                No memes yet!
              </h3>
              <p className="mb-6 text-gray-400">
                Be the first to submit a meme proposal
              </p>
              <button
                onClick={() => {
                  if (!isConnected) {
                    setIsWalletModalOpen(true);
                  } else {
                    setIsModalOpen(true);
                  }
                }}
                className="rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 px-6 py-3 font-bold text-white shadow-lg transition-all hover:from-purple-600 hover:to-pink-600"
              >
                🚀 Submit First Meme
              </button>
            </motion.div>
          )}
        </div>
      </section>

      {/* Modals */}
      <SubmitProposalModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleProposalSubmit}
      />

      <WalletConnectModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
      />

      {selectedProposal && walletAddress && (
        <InscriptionModal
          isOpen={isInscriptionModalOpen}
          onClose={() => {
            setIsInscriptionModalOpen(false);
            setSelectedProposal(null);
          }}
          proposalId={selectedProposal.id}
          proposalName={selectedProposal.name}
          proposalTicker={selectedProposal.ticker}
          receiveAddress={walletAddress}
        />
      )}
    </div>
  );
}
