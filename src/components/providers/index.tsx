"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

interface WalletContextType {
  walletAddress: string | null;
  setWalletAddress: (address: string | null) => void;
  isConnected: boolean;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}

interface WalletProviderProps {
  children: React.ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps) {
  const [walletAddress, setWalletAddressState] = useState<string | null>(null);

  // Load wallet address from localStorage on mount
  useEffect(() => {
    const savedAddress = localStorage.getItem("walletAddress");
    if (savedAddress) {
      setWalletAddressState(savedAddress);
    }
  }, []);

  const setWalletAddress = (address: string | null) => {
    setWalletAddressState(address);
    if (address) {
      localStorage.setItem("walletAddress", address);
    } else {
      localStorage.removeItem("walletAddress");
    }
  };

  const disconnect = () => {
    setWalletAddress(null);
  };

  const isConnected = walletAddress !== null;

  return (
    <WalletContext.Provider
      value={{
        walletAddress,
        setWalletAddress,
        isConnected,
        disconnect,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export default WalletProvider;
