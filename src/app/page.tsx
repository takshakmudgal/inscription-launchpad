"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Toaster, toast } from "sonner";
import { useWallet as useSolanaWallet } from "@solana/wallet-adapter-react";
import dynamic from "next/dynamic";

const WalletMultiButton = dynamic(
  async () =>
    (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false },
);

import { BlockCarousel } from "~/components/BlockCarousel";
import { ProposalCard } from "~/components/ProposalCard";
import { SubmitProposalModal } from "~/components/SubmitProposalModal";
import { UserProfileModal } from "~/components/UserProfileModal";
import { InscriptionModal } from "~/components/InscriptionModal";
import HowItWorksModal from "~/components/HowItWorksModal";

import { getLeaderboard, submitVote, createProposal } from "~/lib/api";
import { useWallet } from "~/components/providers";

import type {
  LeaderboardEntry as BaseLeaderboardEntry,
  BlockInfo,
  Inscription,
  ProposalSubmission,
  ApiResponse,
  Vote,
} from "~/types";

// Assume LeaderboardEntry can have an inscription object
interface LeaderboardEntry extends BaseLeaderboardEntry {
  inscription: Inscription | null;
}

const REFRESH_INTERVAL = 15000; // 15 seconds

export default function HomePage() {
  const {
    walletAddress,
    isConnected,
    userProfile,
    updateProfile,
    setWalletAddress,
    isProposalModalOpen,
    openProposalModal,
    closeProposalModal,
  } = useWallet();
  const { publicKey, connected } = useSolanaWallet();

  useEffect(() => {
    if (connected && publicKey) {
      setWalletAddress(publicKey.toBase58());
    } else {
      setWalletAddress(null);
    }
  }, [connected, publicKey, setWalletAddress]);

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [launchedProposals, setLaunchedProposals] = useState<
    LeaderboardEntry[]
  >([]);
  const [latestBlock, setLatestBlock] = useState<BlockInfo | null>(null);
  const [isProfileModalOpen, setProfileModalOpen] = useState(false);
  const [isHowItWorksModalOpen, setHowItWorksModalOpen] = useState(false);
  const [_isFetching, setIsFetching] = useState(true);
  const [selectedInscription, setSelectedInscription] =
    useState<Inscription | null>(null);
  const [showProfileTooltip, setShowProfileTooltip] = useState(false);

  const fetchData = useCallback(async (showLoading = false) => {
    if (showLoading) {
      setIsFetching(true);
    }
    try {
      const [activeRes, launchedRes] = await Promise.all([
        getLeaderboard(50, "active"),
        getLeaderboard(50, "inscribed"),
      ]);

      if (activeRes.success) {
        setLeaderboard(activeRes.data as LeaderboardEntry[]);
      } else {
        toast.error("Failed to load active proposals");
      }

      if (launchedRes.success) {
        setLaunchedProposals(launchedRes.data as LeaderboardEntry[]);
      } else {
        toast.error("Failed to load launched proposals");
      }
    } catch (error) {
      toast.error("An error occurred while fetching data.");
      console.error(error);
    } finally {
      if (showLoading) {
        setIsFetching(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchData(true);
    const interval = setInterval(() => fetchData(), REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Show profile tooltip for new users
  useEffect(() => {
    if (isConnected && !userProfile) {
      setShowProfileTooltip(true);
      const timer = setTimeout(() => {
        setShowProfileTooltip(false);
      }, 8000); // Hide after 8 seconds
      return () => clearTimeout(timer);
    } else {
      setShowProfileTooltip(false);
    }
  }, [isConnected, userProfile]);

  const handleVote = async (proposalId: number, voteType: "up" | "down") => {
    if (!isConnected || !walletAddress) {
      toast.error("Please connect your wallet to vote.");
      return;
    }

    const promise = submitVote({
      proposalId,
      walletAddress,
      voteType,
    });

    toast.promise(promise, {
      loading: "Submitting your vote...",
      success: (res: ApiResponse<Vote>) => {
        if (res.success) {
          fetchData(); // Refresh data after successful vote
          return "Vote submitted successfully!";
        }
        throw new Error(res.error ?? "Failed to vote");
      },
      error: (err: Error) => err.message || "An error occurred.",
    });
  };

  const handleOpenSubmitProposal = () => {
    if (!isConnected) {
      toast.info("Please connect your wallet to submit a proposal.");
      return;
    }
    openProposalModal();
  };

  const handleCreateProposal = async (proposal: ProposalSubmission) => {
    if (!walletAddress) {
      toast.error("Wallet not connected");
      return;
    }
    const promise = createProposal({
      ...proposal,
      walletAddress: walletAddress,
    });
    toast.promise(promise, {
      loading: "Submitting your proposal...",
      success: (res) => {
        if (res.success) {
          fetchData();
          closeProposalModal();
          return "Proposal submitted successfully!";
        }
        throw new Error(res.error ?? "Failed to submit proposal");
      },
      error: (err: any) => err.message || "An error occurred.",
    });
  };

  return (
    <>
      <Toaster position="top-center" richColors />
      <div className="no-scrollbar-x min-h-screen bg-black">
        {/* Header Removed */}

        <SubmitProposalModal
          isOpen={isProposalModalOpen}
          onClose={closeProposalModal}
          onSubmit={handleCreateProposal}
        />

        <section className="relative overflow-hidden bg-black pt-24 pb-12 text-white sm:pt-32 sm:pb-16 lg:pt-40 lg:pb-24">
          <div className="container mx-auto max-w-full px-3 sm:px-4 lg:px-6">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="space-y-4 sm:space-y-6 lg:space-y-8"
            >
              <div className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4 lg:gap-8">
                <div className="text-center">
                  <div className="mb-2 flex items-center justify-center gap-2">
                    <Image
                      src="/btc_logo.svg"
                      alt="Bitcoin"
                      width={100}
                      height={100}
                    />
                  </div>
                  <h2 className="extra-mobile-title text-base font-bold text-white sm:text-xl lg:text-2xl">
                    Inscribe on Bitcoin{" "}
                    <span className="text-orange-200 italic">Forever</span>
                  </h2>
                </div>

                <div className="text-lg text-white/20 sm:text-2xl lg:text-4xl">
                  +
                </div>

                <div className="text-center">
                  <div className="mb-2 flex items-center justify-center gap-2">
                    <Image
                      src="/solana_logo.png"
                      alt="Solana"
                      width={100}
                      height={100}
                    />
                  </div>
                  <h2 className="extra-mobile-title text-base font-bold text-white sm:text-xl lg:text-2xl">
                    Launch on Solana
                  </h2>
                </div>
              </div>

              {/* <p className="extra-mobile-text px-2 text-sm leading-relaxed text-white/70 sm:px-4 sm:text-lg lg:text-xl">
                The ultimate battleground for memes. Propose, vote, and get your
                meme inscribed on Bitcoin and launched as a token on Solana.
              </p> */}

              {/* <motion.button
                onClick={handleOpenSubmitProposal}
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 px-4 py-2.5 text-sm font-medium text-white transition-all duration-200 hover:from-orange-400 hover:to-orange-500 hover:shadow-lg sm:px-6 sm:py-3 sm:text-base lg:px-8 lg:py-4 lg:text-lg"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Create Meme
              </motion.button> */}
            </motion.div>
          </div>
        </section>

        {/* Block Carousel */}
        <section className="extra-mobile-padding mb-8 overflow-hidden px-3 sm:mb-12 sm:px-4 lg:mb-16 lg:px-6">
          <div className="container mx-auto max-w-full overflow-hidden">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <BlockCarousel onLatestBlock={setLatestBlock} />
            </motion.div>
          </div>
        </section>

        {/* Active Competition */}
        {leaderboard.length > 0 && (
          <section className="extra-mobile-padding mb-12 overflow-hidden px-3 sm:mb-16 sm:px-4 lg:mb-20 lg:px-6">
            <div className="container mx-auto max-w-7xl overflow-hidden">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.6 }}
                className="space-y-6 sm:space-y-8 lg:space-y-12"
              >
                <div className="text-center">
                  <motion.h2
                    className="extra-mobile-title mb-3 text-xl font-bold text-white sm:mb-4 sm:text-3xl lg:mb-6 lg:text-4xl"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.1 }}
                  >
                    <span className="text-orange-400">Active Competition</span>
                  </motion.h2>
                  <motion.p
                    className="mx-auto max-w-3xl text-sm text-white/80 sm:text-lg lg:text-xl"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                  >
                    Vote for your favorite memes to help them win the current
                    block and get inscribed on Bitcoin forever
                  </motion.p>
                </div>

                <div className="grid max-w-full auto-rows-fr grid-cols-1 gap-4 overflow-hidden sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {leaderboard.slice(0, 12).map((proposal, index) => (
                    <motion.div
                      key={proposal.id}
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.5,
                        delay: 0.3 + index * 0.05,
                      }}
                      className="h-full"
                    >
                      <ProposalCard
                        id={proposal.id}
                        rank={proposal.rank}
                        name={proposal.name}
                        ticker={proposal.ticker}
                        description={proposal.description}
                        imageUrl={proposal.imageUrl}
                        bannerUrl={proposal.bannerUrl}
                        creator={
                          proposal.submitter?.username ??
                          proposal.submitter?.twitterId ??
                          "Anonymous"
                        }
                        votesUp={proposal.votesUp}
                        votesDown={proposal.votesDown}
                        totalVotes={proposal.totalVotes}
                        status={proposal.status}
                        inscription={proposal.inscription}
                        leaderStartBlock={proposal.leaderStartBlock}
                        leaderboardMinBlocks={proposal.leaderboardMinBlocks}
                        currentBlockHeight={latestBlock?.height}
                        onVote={handleVote}
                      />
                    </motion.div>
                  ))}
                </div>

                {leaderboard.length > 12 && (
                  <motion.div
                    className="text-center"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.8 }}
                  >
                    <motion.button
                      whileHover={{ scale: 1.05, y: -2 }}
                      whileTap={{ scale: 0.95 }}
                      className="group inline-flex items-center gap-3 rounded-xl border border-orange-500/30 bg-gradient-to-r from-orange-500/10 to-orange-600/10 px-6 py-3 text-sm font-medium text-white backdrop-blur-sm transition-all duration-300 hover:border-orange-400/50 hover:from-orange-500/20 hover:to-orange-600/20 hover:shadow-lg hover:shadow-orange-500/25 sm:px-8 sm:py-4 sm:text-base"
                    >
                      <span>View All Proposals ({leaderboard.length})</span>
                    </motion.button>
                  </motion.div>
                )}
              </motion.div>
            </div>
          </section>
        )}

        {/* Launched Champions */}
        {launchedProposals.length > 0 && (
          <section className="extra-mobile-padding mb-12 overflow-hidden px-3 sm:mb-16 sm:px-4 lg:mb-20 lg:px-6">
            <div className="container mx-auto max-w-7xl overflow-hidden">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.8 }}
                className="space-y-6 sm:space-y-8 lg:space-y-12"
              >
                <div className="text-center">
                  <motion.h2
                    className="extra-mobile-title mb-3 text-xl font-bold text-white sm:mb-4 sm:text-3xl lg:mb-6 lg:text-4xl"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.1 }}
                  >
                    <span className="text-yellow-400">Launched Champions</span>
                  </motion.h2>
                  <motion.p
                    className="mx-auto max-w-3xl text-sm text-white/80 sm:text-lg lg:text-xl"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                  >
                    These legendary memes have achieved immortality on Bitcoin
                    and successfully launched as tokens on Solana
                  </motion.p>
                </div>

                <div className="grid max-w-full auto-rows-fr grid-cols-1 gap-4 overflow-hidden pt-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {launchedProposals.slice(0, 8).map((proposal, index) => (
                    <motion.div
                      key={proposal.id}
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.5,
                        delay: 0.2 + index * 0.05,
                      }}
                      className="group h-full cursor-pointer"
                      onClick={() =>
                        window.open(`/proposals/${proposal.id}`, "_self")
                      }
                    >
                      <div className="relative flex h-full min-h-[280px] flex-col rounded-2xl border border-white/10 bg-white/[.02] p-4 backdrop-blur-xl transition-all duration-300 group-hover:border-white/20 group-hover:bg-white/[.06] sm:min-h-[320px] sm:p-5 lg:min-h-[360px] lg:p-6">
                        {/* Champion badge */}
                        <div className="absolute -top-2 left-3 z-10 sm:-top-2 sm:left-4">
                          <div className="flex items-center gap-1 rounded-full bg-yellow-500 px-2 py-1 text-xs font-bold text-black shadow-lg sm:gap-1.5 sm:px-3 sm:text-xs">
                            <span className="whitespace-nowrap">CHAMPION</span>
                          </div>
                        </div>

                        {/* Main content */}
                        <div className="relative flex flex-1 flex-col pt-4 sm:pt-5">
                          <div className="mb-4 flex items-center gap-3 sm:mb-5 sm:gap-4">
                            <motion.div
                              whileHover={{ scale: 1.1, rotate: 5 }}
                              className="relative flex-shrink-0"
                            >
                              <Image
                                src={proposal.imageUrl}
                                alt={proposal.name}
                                width={48}
                                height={48}
                                className="h-12 w-12 rounded-xl object-cover shadow-xl ring-2 ring-yellow-400/30 sm:h-14 sm:w-14 sm:rounded-2xl lg:h-16 lg:w-16"
                              />
                              <div className="absolute -inset-1 rounded-xl bg-gradient-to-r from-yellow-400 to-orange-400 opacity-30 blur-sm sm:rounded-2xl" />
                            </motion.div>

                            <div className="min-w-0 flex-1">
                              <h3 className="mb-1 truncate text-sm font-bold text-white sm:text-base lg:text-lg">
                                {proposal.name}
                              </h3>
                              <div className="mb-1 flex items-center gap-2">
                                <p className="font-mono text-xs font-semibold text-orange-400 sm:text-sm">
                                  ${proposal.ticker}
                                </p>
                                <span className="text-xs text-green-400">
                                  ✓
                                </span>
                              </div>
                              <p className="text-xs text-white/70">
                                Inscribed Champion
                              </p>
                            </div>
                          </div>

                          <p className="mb-4 line-clamp-2 text-xs leading-relaxed text-white/80 sm:mb-5 sm:text-sm lg:text-base">
                            {proposal.description}
                          </p>

                          {/* Stats section */}
                          <div className="mb-4 flex items-center justify-between sm:mb-5">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-1 text-white/70">
                                <span className="text-xs font-medium sm:text-sm">
                                  {proposal.totalVotes.toLocaleString()}
                                </span>
                                <span className="text-xs">votes</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 rounded-lg bg-green-500/20 px-2 py-1 text-xs font-semibold text-green-400 backdrop-blur-sm sm:gap-1.5 sm:px-3 sm:py-1.5">
                                <span>Inscribed</span>
                              </span>
                            </div>
                          </div>

                          <button className="mt-auto flex w-full items-center justify-center gap-2 rounded-lg bg-orange-500 py-2 text-xs font-bold text-black transition-all duration-300 hover:bg-orange-400 sm:py-2.5 sm:text-sm">
                            <span>View Champion</span>
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {launchedProposals.length > 8 && (
                  <motion.div
                    className="text-center"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.8 }}
                  >
                    <motion.button
                      whileHover={{ scale: 1.05, y: -2 }}
                      whileTap={{ scale: 0.95 }}
                      className="group inline-flex items-center gap-3 rounded-xl border border-orange-500/30 bg-gradient-to-r from-orange-500/10 to-yellow-500/10 px-6 py-3 text-sm font-medium text-white backdrop-blur-sm transition-all duration-300 hover:border-orange-400/50 hover:from-orange-500/20 hover:to-yellow-500/20 hover:shadow-lg hover:shadow-orange-500/25 sm:px-8 sm:py-4 sm:text-base"
                    >
                      <span>
                        View All Champions ({launchedProposals.length})
                      </span>
                    </motion.button>
                  </motion.div>
                )}
              </motion.div>
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="overflow-hidden border-t border-gray-800/50 bg-gray-950/20 py-8 sm:py-12">
          <div className="container mx-auto max-w-full overflow-hidden px-4 sm:px-6">
            <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
              <div className="text-xs text-white/70 sm:text-sm">
                © 2025 BitPill. All rights reserved.
              </div>
              <div className="text-xs text-white/70 sm:text-sm">
                The future of memes is eternal.
              </div>
            </div>
          </div>
        </footer>

        {/* Floating Submit button for mobile */}
        <div className="fixed right-4 bottom-20 z-40 sm:hidden">
          <motion.button
            onClick={handleOpenSubmitProposal}
            className="h-14 w-14 rounded-full bg-orange-500 text-white shadow-xl transition-all duration-300 hover:scale-110 hover:bg-orange-400"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="mx-auto h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
          </motion.button>
        </div>
      </div>

      {/* Modals */}
      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        onSubmit={updateProfile}
        walletAddress={walletAddress || ""}
      />

      <HowItWorksModal
        isOpen={isHowItWorksModalOpen}
        onClose={() => setHowItWorksModalOpen(false)}
      />

      {selectedInscription && selectedInscription.proposal && (
        <InscriptionModal
          isOpen={!!selectedInscription}
          onClose={() => setSelectedInscription(null)}
          proposalId={selectedInscription.proposal.id}
          proposalName={selectedInscription.proposal.name}
          proposalTicker={selectedInscription.proposal.ticker}
          receiveAddress={process.env.NEXT_PUBLIC_UNISAT_RECEIVE_ADDRESS ?? ""}
          existingOrderId={selectedInscription.unisatOrderId}
        />
      )}
    </>
  );
}
