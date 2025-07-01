"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import type { User } from "~/types";

interface UserProfile {
  id: number;
  walletAddress: string;
  username: string;
  email?: string;
  twitter?: string;
  telegram?: string;
  bio?: string;
  createdAt: string;
  updatedAt: string;
}

interface WalletContextType {
  walletAddress: string | null;
  setWalletAddress: (address: string | null) => void;
  isConnected: boolean;
  disconnect: () => void;
  userProfile: UserProfile | null;
  hasCompleteProfile: boolean;
  isLoadingProfile: boolean;
  refreshProfile: () => Promise<void>;
  updateProfile: (profileData: {
    username: string;
    email?: string;
    twitter?: string;
    telegram?: string;
    bio?: string;
  }) => Promise<void>;
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
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  useEffect(() => {
    const savedAddress = localStorage.getItem("walletAddress");
    if (savedAddress) {
      setWalletAddressState(savedAddress);
    }
  }, []);

  useEffect(() => {
    if (walletAddress) {
      refreshProfile();
    } else {
      setUserProfile(null);
    }
  }, [walletAddress]);

  const refreshProfile = async () => {
    // if (!walletAddress) return;
    // setIsLoadingProfile(true);
    // try {
    //   const response = await fetch(
    //     `/api/users/profile?walletAddress=${encodeURIComponent(walletAddress)}`,
    //   );
    //   if (response.ok) {
    //     const data = await response.json();
    //     if (data.success && data.data) {
    //       setUserProfile(data.data);
    //     }
    //   } else if (response.status !== 404) {
    //     console.error("Error loading user profile:", response.statusText);
    //   }
    // } catch (error) {
    //   console.error("Error loading user profile:", error);
    // } finally {
    //   setIsLoadingProfile(false);
    // }
  };

  const updateProfile = async (profileData: {
    username: string;
    email?: string;
    twitter?: string;
    telegram?: string;
    bio?: string;
  }) => {
    if (!walletAddress) {
      throw new Error("Wallet not connected");
    }

    const response = await fetch("/api/users/profile", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        walletAddress,
        ...profileData,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to update profile");
    }

    const data = await response.json();
    if (data.success && data.data) {
      setUserProfile(data.data);
    }
  };

  const setWalletAddress = (address: string | null) => {
    setWalletAddressState(address);
    if (address) {
      localStorage.setItem("walletAddress", address);
    } else {
      localStorage.removeItem("walletAddress");
      setUserProfile(null);
    }
  };

  const disconnect = () => {
    setWalletAddress(null);
  };

  const isConnected = walletAddress !== null;
  const hasCompleteProfile = userProfile !== null && !!userProfile.username;

  return (
    <WalletContext.Provider
      value={{
        walletAddress,
        setWalletAddress,
        isConnected,
        disconnect,
        userProfile,
        hasCompleteProfile,
        isLoadingProfile,
        refreshProfile,
        updateProfile,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export default WalletProvider;
