"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { useWallet as useSolanaWallet } from "@solana/wallet-adapter-react";
import dynamic from "next/dynamic";
import { Toaster, toast } from "sonner";

import { UserProfileModal } from "~/components/UserProfileModal";
import HowItWorksModal from "~/components/HowItWorksModal";

import { useWallet } from "~/components/providers";

const WalletMultiButton = dynamic(
  async () =>
    (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false },
);

const CONTRACT_ADDRESS = "GZcGneiDq6L6PsEPBjPJuDcEezc3NRNE5F47XqcZpump"; // Replace with actual contract address

export function Header() {
  const {
    walletAddress,
    isConnected,
    userProfile,
    setWalletAddress,
    updateProfile,
    refreshProfile,
    openProposalModal,
  } = useWallet();
  const { publicKey, connected } = useSolanaWallet();

  useEffect(() => {
    if (connected && publicKey) {
      setWalletAddress(publicKey.toBase58());
    } else {
      setWalletAddress(null);
    }
  }, [connected, publicKey, setWalletAddress]);

  const [isProfileModalOpen, setProfileModalOpen] = useState(false);
  const [isHowItWorksModalOpen, setHowItWorksModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(CONTRACT_ADDRESS);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-orange-500/20 bg-black/90 backdrop-blur-lg">
        <div className="container mx-auto flex h-14 max-w-full items-center justify-between px-3 sm:h-16 sm:px-4 lg:h-20 lg:px-6">
          <motion.div
            className="flex items-center gap-2 sm:gap-3"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Image
              src="/bitmemes_logo.png"
              alt="BitPill Logo"
              width={24}
              height={24}
              className="ultra-mobile-logo rounded-lg sm:h-8 sm:w-8 lg:h-10 lg:w-10"
            />
            <h1 className="extra-mobile-title text-base font-bold text-orange-400 sm:text-lg lg:text-2xl">
              BitPill
            </h1>
          </motion.div>

          <motion.div
            className="ultra-mobile-gap flex items-center gap-1.5 sm:gap-2 lg:gap-4"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <div
              className="sm:text-md relative cursor-pointer text-sm font-bold text-orange-400 lg:text-lg"
              onClick={handleCopy}
            >
              {copied
                ? "Copied!"
                : "GZcGneiDq6L6PsEPBjPJuDcEezc3NRNE5F47XqcZpump"}
            </div>
            <a
              href="https://x.com/bitpilldotfun"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Image
                src="/x_white.png"
                alt="Twitter"
                width={24}
                height={24}
                className="h-5 w-5 sm:h-6 sm:w-6"
              />
            </a>
            <button
              onClick={() => setHowItWorksModalOpen(true)}
              className="hidden items-center gap-1.5 rounded-xl border border-orange-500/30 bg-white/5 px-3 py-1.5 text-xs font-medium text-white transition-all duration-200 hover:border-orange-500/50 hover:bg-white/10 sm:flex sm:px-4 sm:py-2 sm:text-sm lg:px-6 lg:py-3 lg:text-base"
            >
              <span>How it Works</span>
            </button>
            <button
              onClick={openProposalModal}
              className="hidden items-center gap-1.5 rounded-xl bg-orange-500 px-3 py-1.5 text-xs font-medium text-white transition-all duration-200 hover:bg-orange-400 hover:shadow-md sm:flex sm:px-4 sm:py-2 sm:text-sm lg:px-6 lg:py-3 lg:text-base"
            >
              <span>Create Meme</span>
            </button>
            <div className="scale-[0.65] sm:scale-75 lg:scale-100">
              <WalletMultiButton />
            </div>

            {isConnected && (
              <div className="relative">
                <motion.button
                  onClick={() => setProfileModalOpen(true)}
                  className="ultra-mobile-button flex items-center justify-center rounded-xl border border-orange-500/20 bg-white/5 p-1.5 transition-all duration-200 hover:border-orange-500/30 hover:bg-white/8 sm:p-2 lg:p-3"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 sm:h-6 sm:w-6 lg:h-7 lg:w-7">
                    <span className="text-xs text-white">U</span>
                  </div>
                </motion.button>
              </div>
            )}
          </motion.div>
        </div>
      </header>

      {walletAddress && (
        <UserProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => setProfileModalOpen(false)}
          walletAddress={walletAddress}
          initialData={userProfile ?? undefined}
          onSubmit={async (data) => {
            await updateProfile(data);
            await refreshProfile();
            toast.success("Profile updated!");
            setProfileModalOpen(false);
          }}
        />
      )}
      <HowItWorksModal
        isOpen={isHowItWorksModalOpen}
        onClose={() => setHowItWorksModalOpen(false)}
      />
    </>
  );
}
