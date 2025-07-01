"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ProposalCard } from "~/components/ProposalCard";
import { SubmitProposalModal } from "~/components/SubmitProposalModal";
import { WalletConnectModal } from "~/components/WalletConnectModal";
import { InscriptionModal } from "~/components/InscriptionModal";
import { ActiveOrdersWidget } from "~/components/ActiveOrdersWidget";
import {
  OrderNotification,
  useNotifications,
} from "~/components/OrderNotification";
import { UserProfileModal } from "~/components/UserProfileModal";
import { useWallet } from "~/components/providers";
import { useBackgroundOrderMonitor } from "~/hooks/useBackgroundOrderMonitor";
import type { Proposal, ApiResponse, BlockInfo } from "~/types";
import { BlockCarousel } from "~/components/BlockCarousel";

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

interface ActiveOrder {
  orderId: string;
  proposalId: number;
  proposalName: string;
  proposalTicker: string;
  receiveAddress: string;
}

export default function HomePage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [isInscriptionModalOpen, setIsInscriptionModalOpen] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(
    null,
  );
  const [existingOrderId, setExistingOrderId] = useState<string | undefined>(
    undefined,
  );
  const [currentBlock, setCurrentBlock] = useState<BlockInfo | null>(null);
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<"trending" | "new" | "top">(
    "trending",
  );
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const {
    walletAddress,
    isConnected,
    disconnect,
    userProfile,
    hasCompleteProfile,
    updateProfile,
  } = useWallet();
  const { notifications, addNotification, removeNotification } =
    useNotifications();

  useBackgroundOrderMonitor({
    enabled: isConnected,
    interval: 60000,
    onOrderComplete: (orderId, status) => {
      refreshAllData();

      addNotification({
        type: "success",
        title: "Inscription Complete! 🎉",
        message: `Your Bitcoin inscription order (${orderId.slice(0, 8)}...) has been successfully completed. Your meme is now permanently inscribed on Bitcoin!`,
        duration: 10000,
      });
    },
    onOrderFailed: (orderId, status) => {
      addNotification({
        type: "error",
        title: `Inscription ${status === "canceled" ? "Canceled" : "Failed"} ❌`,
        message: `Your inscription order (${orderId.slice(0, 8)}...) was ${status}. You can try creating a new order if needed.`,
        duration: 8000,
      });
    },
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isConnected && !hasCompleteProfile && mounted) {
      const timer = setTimeout(() => {
        setIsProfileModalOpen(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isConnected, hasCompleteProfile, mounted]);

  const fetchProposals = async () => {
    try {
      const statuses = ["active", "leader", "inscribing"];
      const allProposals: Proposal[] = [];

      for (const status of statuses) {
        const url = `/api/proposals?status=${status}&t=${Date.now()}`;
        console.log(`🔍 Fetching ${status} proposals from:`, url);
        const response = await fetch(url, {
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
        });
        const data: ApiResponse<ProposalsResponse> = await response.json();
        if (data.success && data.data?.proposals) {
          allProposals.push(...data.data.proposals);
        }
      }

      setProposals(allProposals);
      console.log(
        "🔄 All proposals refreshed:",
        allProposals.length,
        "total",
        allProposals.map((p) => ({
          ticker: p.ticker,
          status: p.status,
        })),
      );
    } catch (error) {
      console.error("Error fetching proposals:", error);
    }
  };

  const fetchInscribedProposals = async (): Promise<Proposal[]> => {
    try {
      const url = `/api/proposals?status=inscribed&t=${Date.now()}`;
      console.log("🔍 Fetching inscribed proposals from:", url);
      const response = await fetch(url, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      });
      const data: ApiResponse<ProposalsResponse> = await response.json();
      if (data.success && data.data?.proposals) {
        console.log(
          "🏆 Inscribed proposals refreshed:",
          data.data.proposals.length,
          "total",
          data.data.proposals.map((p) => ({
            ticker: p.ticker,
            status: p.status,
          })),
        );
        return data.data.proposals;
      }
    } catch (error) {
      console.error("Error fetching inscribed proposals:", error);
    }
    return [];
  };

  const [inscribedProposals, setInscribedProposals] = useState<Proposal[]>([]);

  useEffect(() => {
    refreshAllData();
    const refreshInterval = setInterval(refreshAllData, 30000);

    return () => clearInterval(refreshInterval);
  }, []);

  const refreshAllData = async () => {
    console.log("🔄 Refreshing all proposal data...");
    setProposals([]);
    setInscribedProposals([]);
    const timestamp = Date.now();
    await Promise.all([
      fetchProposals(),
      fetchInscribedProposals().then(setInscribedProposals),
    ]);

    console.log("✅ All proposal data refreshed successfully");
  };

  const handleLatestBlock = (block: BlockInfo | null) => {
    if (block) {
      setCurrentBlock(block);
    }
  };

  interface proposal {
    name: string;
    ticker: string;
    description: string;
    imageUrl: string;
    creator: string;
  }

  const handleProposalSubmit = async (proposal: proposal) => {
    if (!isConnected) {
      setIsWalletModalOpen(true);
      return;
    }

    if (!hasCompleteProfile) {
      setIsProfileModalOpen(true);
      addNotification({
        type: "error",
        title: "Profile Required ⚠️",
        message: "Please complete your profile before submitting proposals.",
        duration: 5000,
      });
      return;
    }

    try {
      const response = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...proposal,
          walletAddress,
          submittedBy: userProfile?.id,
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as ApiResponse<Proposal>;
        if (data.success && data.data) {
          await refreshAllData();
          addNotification({
            type: "success",
            title: "Proposal Submitted! 🎉",
            message: `Your meme "${proposal.name}" has been submitted successfully!`,
            duration: 5000,
          });
        }
      } else {
        const errorData = await response.json();
        addNotification({
          type: "error",
          title: "Submission Failed ❌",
          message:
            errorData.error || "Failed to submit proposal. Please try again.",
          duration: 5000,
        });
      }
    } catch (error) {
      console.error("Error submitting proposal:", error);
      addNotification({
        type: "error",
        title: "Submission Failed ❌",
        message: "Failed to submit proposal. Please try again.",
        duration: 5000,
      });
    }
  };

  const handleVote = async (proposalId: number, voteType: "up" | "down") => {
    if (!isConnected) {
      setIsWalletModalOpen(true);
      return;
    }

    if (!hasCompleteProfile) {
      addNotification({
        type: "info",
        title: "Complete Your Profile 👤",
        message:
          "Consider completing your profile to get the full BitMemes experience!",
        duration: 3000,
      });
    }

    try {
      const response = await fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposalId,
          voteType,
          walletAddress,
          userId: userProfile?.id,
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as ApiResponse<{
          success: boolean;
        }>;
        if (data.success) {
          await refreshAllData();

          addNotification({
            type: "success",
            title: `Vote ${voteType === "up" ? "👍" : "👎"} Recorded!`,
            message: `Your ${voteType === "up" ? "upvote" : "downvote"} has been counted.`,
            duration: 2000,
          });
        }
      } else {
        const errorData = await response.json();
        addNotification({
          type: "error",
          title: "Vote Failed ❌",
          message:
            errorData.error || "Failed to record vote. Please try again.",
          duration: 3000,
        });
      }
    } catch (error) {
      console.error("Error voting:", error);
      addNotification({
        type: "error",
        title: "Vote Failed ❌",
        message: "Failed to record vote. Please try again.",
        duration: 3000,
      });
    }
  };

  const handleResumeOrder = (
    orderId: string,
    proposalId: number,
    proposalName: string,
    proposalTicker: string,
    receiveAddress: string,
  ) => {
    const proposal: Proposal = {
      id: proposalId,
      name: proposalName,
      ticker: proposalTicker,
      description: "",
      imageUrl: "",
      submittedBy: 0,
      votesUp: 0,
      votesDown: 0,
      totalVotes: 0,
      status: "active",
      leaderboardMinBlocks: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setExistingOrderId(orderId);
    setSelectedProposal(proposal);
    setIsInscriptionModalOpen(true);
  };

  const handleProfileSubmit = async (profileData: {
    username: string;
    email?: string;
    twitter?: string;
    telegram?: string;
    bio?: string;
  }) => {
    try {
      await updateProfile(profileData);
      setIsProfileModalOpen(false);

      addNotification({
        type: "success",
        title: "Profile Updated! 🎉",
        message: `Welcome to BitMemes, ${profileData.username}! Your profile has been saved successfully.`,
        duration: 5000,
      });
    } catch (error) {
      console.error("Error updating profile:", error);
      addNotification({
        type: "error",
        title: "Profile Update Failed ❌",
        message:
          error instanceof Error
            ? error.message
            : "Failed to update profile. Please try again.",
        duration: 5000,
      });
    }
  };

  const getFilteredProposals = () => {
    const activeProposals = proposals
      .filter((p) => p.status === "active" || p.status === "leader")
      .filter(
        (proposal, index, array) =>
          array.findIndex((p) => p.id === proposal.id) === index,
      );

    switch (activeTab) {
      case "trending":
        return activeProposals.sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        );
      case "new":
        return activeProposals.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
      case "top":
        return activeProposals.sort(
          (a, b) => b.votesUp - b.votesDown - (a.votesUp - a.votesDown),
        );
      default:
        return activeProposals;
    }
  };

  const getProcessingProposals = () => {
    return proposals
      .filter((p) => p.status === "inscribing")
      .filter(
        (proposal, index, array) =>
          array.findIndex((p) => p.id === proposal.id) === index,
      )
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
  };

  const getInscribedProposals = () => {
    return inscribedProposals
      .filter(
        (proposal, index, array) =>
          array.findIndex((p) => p.id === proposal.id) === index,
      )
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
  };

  const totalVotes = [...proposals, ...inscribedProposals].reduce(
    (sum, p) => sum + p.totalVotes,
    0,
  );
  const activeProposalsCount = proposals.filter(
    (p) => p.status === "active" || p.status === "leader",
  ).length;
  const processingProposalsCount = proposals.filter(
    (p) => p.status === "inscribing",
  ).length;
  const inscribedProposalsCount = inscribedProposals.length;

  if (!mounted) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-black/50 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-20 items-center justify-between">
            <div className="flex items-center space-x-4">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
                className="text-2xl font-bold"
              >
                <span className="text-orange-500">₿</span>
                <span className="text-white">itMemes</span>
              </motion.div>
              <div className="text-center">
                <div className="text-lg font-bold text-white">
                  #{currentBlock ? currentBlock.height.toLocaleString() : "..."}
                </div>
                <div className="text-xs text-gray-400">Current Block</div>
              </div>
            </div>

            <div className="flex flex-1 items-center justify-center">
              <div className="hidden sm:block">
                <div className="flex items-center gap-3">
                  <div className="text-center">
                    <div className="text-lg font-bold text-white">
                      {totalVotes.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-400">Total Votes</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-white">
                      {activeProposalsCount}
                    </div>
                    <div className="text-xs text-gray-400">Active</div>
                  </div>
                  {processingProposalsCount > 0 && (
                    <div className="text-center">
                      <div className="text-lg font-bold text-blue-400">
                        {processingProposalsCount}
                      </div>
                      <div className="text-xs text-gray-400">Processing</div>
                    </div>
                  )}
                  <div className="text-center">
                    <div className="text-lg font-bold text-white">
                      {inscribedProposalsCount}
                    </div>
                    <div className="text-xs text-gray-400">Inscribed</div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={refreshAllData}
                  className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-sm font-medium text-blue-400 transition-all hover:bg-blue-500/20"
                  title="Refresh proposal data"
                >
                  🔄 Refresh
                </button>
                {isConnected ? (
                  <div className="flex items-center gap-3">
                    <div className="hidden text-right sm:block">
                      <div className="text-xs text-gray-400">
                        {userProfile
                          ? `Hello, ${userProfile.username}`
                          : "Connected"}
                      </div>
                      <div className="font-mono text-sm text-white">
                        {walletAddress?.slice(0, 6)}...
                        {walletAddress?.slice(-4)}
                      </div>
                    </div>
                    {!hasCompleteProfile && (
                      <button
                        onClick={() => setIsProfileModalOpen(true)}
                        className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs font-medium text-yellow-400 transition-all hover:bg-yellow-500/20"
                      >
                        Complete Profile
                      </button>
                    )}
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
        </div>
      </header>
      <BlockCarousel onLatestBlock={handleLatestBlock} />
      <main className="container mx-auto p-4">
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

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mt-6 flex flex-col justify-center gap-3 sm:mt-8 sm:flex-row sm:gap-4"
            >
              <button
                onClick={() => {
                  if (!isConnected) {
                    setIsWalletModalOpen(true);
                  } else {
                    setIsModalOpen(true);
                  }
                }}
                className="rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 px-6 py-3 text-base font-bold text-white shadow-xl transition-all hover:scale-105 hover:from-purple-600 hover:to-pink-600 sm:px-8 sm:py-4 sm:text-lg"
              >
                🚀 Submit Your Meme
              </button>
              <button
                onClick={() =>
                  document
                    .getElementById("proposals")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
                className="rounded-xl border border-white/20 bg-white/5 px-6 py-3 text-base font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/10 sm:px-8 sm:py-4 sm:text-lg"
              >
                🗳️ Vote Now
              </button>
            </motion.div>
          </div>

          <div className="absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute -top-40 -right-32 h-80 w-80 rounded-full bg-purple-500/20 blur-3xl" />
            <div className="absolute -bottom-40 -left-32 h-80 w-80 rounded-full bg-pink-500/20 blur-3xl" />
          </div>
        </section>

        <section id="proposals" className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-12 text-center">
              <div className="mb-4 flex items-center justify-center gap-4">
                <h3 className="text-3xl font-bold text-white">
                  🏆 Meme Leaderboard
                </h3>

                <div className="hidden items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-2 lg:flex">
                  <div className="flex items-center gap-2 text-xs">
                    <div className="h-2 w-2 animate-pulse rounded-full bg-green-400"></div>
                    <span className="text-gray-400">Block</span>
                    <span className="font-mono text-white">
                      {currentBlock?.height.toLocaleString()}
                    </span>
                  </div>
                  <div className="text-gray-500">•</div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-400">Active</span>
                    <span className="font-semibold text-green-400">
                      {activeProposalsCount}
                    </span>
                  </div>
                  {processingProposalsCount > 0 && (
                    <>
                      <div className="text-gray-500">•</div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-gray-400">Processing</span>
                        <span className="font-semibold text-blue-400">
                          {processingProposalsCount}
                        </span>
                      </div>
                    </>
                  )}
                  {inscribedProposalsCount > 0 && (
                    <>
                      <div className="text-gray-500">•</div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-gray-400">Inscribed</span>
                        <span className="font-semibold text-purple-400">
                          {inscribedProposalsCount}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <p className="mt-4 text-gray-400">
                Vote for your favorite memes. Top proposals get inscribed on
                Bitcoin!
              </p>

              <div className="mt-4 flex items-center justify-center gap-4 text-xs lg:hidden">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400"></div>
                  <span className="text-gray-400">
                    Block {currentBlock?.height.toLocaleString()}
                  </span>
                </div>
                <div className="text-gray-500">•</div>
                <span className="text-gray-400">
                  {activeProposalsCount} Active
                </span>
                {processingProposalsCount > 0 && (
                  <>
                    <div className="text-gray-500">•</div>
                    <span className="text-gray-400">
                      {processingProposalsCount} Processing
                    </span>
                  </>
                )}
                {inscribedProposalsCount > 0 && (
                  <>
                    <div className="text-gray-500">•</div>
                    <span className="text-gray-400">
                      {inscribedProposalsCount} Inscribed
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="mb-6 flex justify-center sm:mb-8">
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
                    className={`relative rounded-lg px-3 py-2 text-xs font-medium transition-all sm:px-6 sm:py-3 sm:text-sm ${
                      activeTab === tab.key
                        ? "bg-white/10 text-white shadow-lg"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    <span className="hidden sm:inline">{tab.label}</span>
                    <span className="sm:hidden">{tab.label.split(" ")[0]}</span>
                  </button>
                ))}
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
              >
                {getFilteredProposals().map((proposal, index) => (
                  <motion.div
                    key={`active-${proposal.id}`}
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
                        proposal.submitter?.username
                          ? userProfile &&
                            proposal.submittedBy === userProfile.id
                            ? `${proposal.submitter.username} (You)`
                            : proposal.submitter.username
                          : proposal.submittedBy
                            ? `User #${proposal.submittedBy}`
                            : "Anonymous"
                      }
                      votesUp={proposal.votesUp}
                      votesDown={proposal.votesDown}
                      totalVotes={proposal.totalVotes}
                      status={proposal.status}
                      firstTimeAsLeader={proposal.firstTimeAsLeader}
                      leaderStartBlock={proposal.leaderStartBlock}
                      leaderboardMinBlocks={proposal.leaderboardMinBlocks}
                      expirationBlock={proposal.expirationBlock}
                      currentBlockHeight={currentBlock?.height}
                      onVote={handleVote}
                    />
                  </motion.div>
                ))}
              </motion.div>
            </AnimatePresence>

            {getFilteredProposals().length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-16 text-center"
              >
                <div className="mb-4 text-6xl">🎭</div>
                <h3 className="mb-2 text-xl font-semibold text-white">
                  No active memes yet!
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

        {getProcessingProposals().length > 0 && (
          <section className="bg-gradient-to-r from-blue-900/10 to-purple-900/10 px-4 py-16 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl">
              <div className="mb-12 text-center">
                <div className="mb-4 flex items-center justify-center gap-4">
                  <h3 className="text-3xl font-bold text-white">
                    ⚡ Processing Inscriptions
                  </h3>
                  <div className="flex items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-2">
                    <div className="h-2 w-2 animate-pulse rounded-full bg-blue-400"></div>
                    <span className="text-sm font-medium text-blue-400">
                      {getProcessingProposals().length} Processing
                    </span>
                  </div>
                </div>
                <p className="mt-4 text-gray-400">
                  These memes are currently being inscribed on the Bitcoin
                  blockchain. This process typically takes a few minutes.
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {getProcessingProposals().map((proposal, index) => (
                  <motion.div
                    key={`processing-${proposal.id}`}
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
                        proposal.submitter?.username
                          ? userProfile &&
                            proposal.submittedBy === userProfile.id
                            ? `${proposal.submitter.username} (You)`
                            : proposal.submitter.username
                          : proposal.submittedBy
                            ? `User #${proposal.submittedBy}`
                            : "Anonymous"
                      }
                      votesUp={proposal.votesUp}
                      votesDown={proposal.votesDown}
                      totalVotes={proposal.totalVotes}
                      status={proposal.status}
                      firstTimeAsLeader={proposal.firstTimeAsLeader}
                      leaderStartBlock={proposal.leaderStartBlock}
                      leaderboardMinBlocks={proposal.leaderboardMinBlocks}
                      expirationBlock={proposal.expirationBlock}
                      currentBlockHeight={currentBlock?.height}
                      onVote={handleVote}
                    />
                  </motion.div>
                ))}
              </div>
            </div>
          </section>
        )}

        {getInscribedProposals().length > 0 && (
          <section className="px-4 py-16 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl">
              <div className="mb-12 text-center">
                <div className="mb-4 flex items-center justify-center gap-4">
                  <h3 className="text-3xl font-bold text-white">
                    🏆 Bitcoin Inscriptions
                  </h3>
                  <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-2">
                    <div className="h-2 w-2 rounded-full bg-green-400"></div>
                    <span className="text-sm font-medium text-green-400">
                      {inscribedProposalsCount} Inscribed
                    </span>
                  </div>
                </div>
                <p className="mt-4 text-gray-400">
                  Memes that made it! These proposals have been permanently
                  inscribed on Bitcoin.
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {getInscribedProposals().map((proposal, index) => (
                  <motion.div
                    key={`inscribed-${proposal.id}`}
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
                        proposal.submitter?.username
                          ? userProfile &&
                            proposal.submittedBy === userProfile.id
                            ? `${proposal.submitter.username} (You)`
                            : proposal.submitter.username
                          : proposal.submittedBy
                            ? `User #${proposal.submittedBy}`
                            : "Anonymous"
                      }
                      votesUp={proposal.votesUp}
                      votesDown={proposal.votesDown}
                      totalVotes={proposal.totalVotes}
                      status={proposal.status}
                      firstTimeAsLeader={proposal.firstTimeAsLeader}
                      leaderStartBlock={proposal.leaderStartBlock}
                      leaderboardMinBlocks={proposal.leaderboardMinBlocks}
                      expirationBlock={proposal.expirationBlock}
                      currentBlockHeight={currentBlock?.height}
                      onVote={handleVote}
                    />
                  </motion.div>
                ))}
              </div>
            </div>
          </section>
        )}

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
              setExistingOrderId(undefined);
            }}
            proposalId={selectedProposal.id}
            proposalName={selectedProposal.name}
            proposalTicker={selectedProposal.ticker}
            receiveAddress={walletAddress}
            existingOrderId={existingOrderId}
          />
        )}

        <div className="flex-shrink-0">
          {isConnected && (
            <ActiveOrdersWidget onResumeOrder={handleResumeOrder} />
          )}
          {walletAddress && (
            <UserProfileModal
              isOpen={isProfileModalOpen}
              onClose={() => setIsProfileModalOpen(false)}
              onSubmit={handleProfileSubmit}
              walletAddress={walletAddress}
              isRequired={!hasCompleteProfile}
            />
          )}
        </div>
        <OrderNotification
          notifications={notifications}
          onRemove={removeNotification}
        />
      </main>

      <div className="pointer-events-none fixed right-4 bottom-4 z-50 flex flex-col items-end space-y-2">
        <OrderNotification
          notifications={notifications}
          onRemove={removeNotification}
        />
        <ActiveOrdersWidget onResumeOrder={handleResumeOrder} />
      </div>
    </div>
  );
}
