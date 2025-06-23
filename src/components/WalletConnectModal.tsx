"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "./providers";

interface WalletConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WalletConnectModal({
  isOpen,
  onClose,
}: WalletConnectModalProps) {
  const [walletInput, setWalletInput] = useState("");
  const [error, setError] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const { setWalletAddress } = useWallet();

  const validateBitcoinAddress = (address: string): boolean => {
    // Basic Bitcoin address validation (simplified)
    // Supports Legacy (1...), SegWit (3...), and Bech32 (bc1...)
    const legacyRegex = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
    const segwitRegex = /^3[a-km-zA-HJ-NP-Z1-9]{25,34}$/;
    const bech32Regex = /^(bc1|tb1)[a-z0-9]{39,59}$/;

    return (
      legacyRegex.test(address) ||
      segwitRegex.test(address) ||
      bech32Regex.test(address)
    );
  };

  const handleConnect = async () => {
    if (!walletInput.trim()) {
      setError("Please enter a wallet address");
      return;
    }

    if (!validateBitcoinAddress(walletInput.trim())) {
      setError("Please enter a valid Bitcoin address");
      return;
    }

    setIsConnecting(true);
    setError("");

    try {
      // Set the wallet address
      setWalletAddress(walletInput.trim());

      // Close modal
      onClose();
      setWalletInput("");
    } catch (error) {
      console.error("Error connecting wallet:", error);
      setError("Failed to connect wallet. Please try again.");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setWalletInput(e.target.value);
    if (error) setError(""); // Clear error when user types
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-md rounded-2xl border border-white/20 bg-gradient-to-br from-gray-900/95 to-black/95 p-6 shadow-2xl backdrop-blur-xl"
        >
          {/* Header */}
          <div className="mb-6 text-center">
            <div className="mb-3 flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-2xl shadow-lg">
                🔗
              </div>
            </div>
            <h2 className="text-2xl font-bold text-white">Connect Wallet</h2>
            <p className="mt-2 text-sm text-gray-400">
              Enter your Bitcoin wallet address to vote and submit proposals
            </p>
          </div>

          {/* Input Form */}
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Bitcoin Wallet Address
              </label>
              <input
                type="text"
                value={walletInput}
                onChange={handleInputChange}
                placeholder="e.g., bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"
                className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white placeholder-gray-500 ring-1 ring-white/10 transition-all focus:border-white/30 focus:ring-white/20 focus:outline-none"
                disabled={isConnecting}
              />
              <p className="mt-1 text-xs text-gray-500">
                Supports Legacy (1...), SegWit (3...), and Bech32 (bc1...)
                addresses
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isConnecting}
                className="flex-1 rounded-xl border border-white/20 bg-white/5 px-4 py-3 font-semibold text-gray-300 transition-all hover:bg-white/10 hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConnect}
                disabled={isConnecting || !walletInput.trim()}
                className="flex-1 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-3 font-semibold text-black transition-all hover:from-orange-600 hover:to-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isConnecting ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                    Connecting...
                  </div>
                ) : (
                  "Connect Wallet"
                )}
              </button>
            </div>
          </div>

          {/* Info */}
          <div className="mt-6 rounded-xl bg-white/5 p-4">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-white">
              <span>🔒</span>
              Your Privacy
            </h3>
            <p className="text-xs text-gray-400">
              Your wallet address is only used for voting and proposal
              submission. We don't store any private keys or have access to your
              funds.
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
