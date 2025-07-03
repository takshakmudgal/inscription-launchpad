"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface UserProfileData {
  username: string;
  email?: string;
  twitter?: string;
  telegram?: string;
  bio?: string;
}

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (profileData: UserProfileData) => void;
  walletAddress: string;
  isRequired?: boolean;
}

export function UserProfileModal({
  isOpen,
  onClose,
  onSubmit,
  walletAddress,
  isRequired = false,
}: UserProfileModalProps) {
  const [formData, setFormData] = useState<UserProfileData>({
    username: "",
    email: "",
    twitter: "",
    telegram: "",
    bio: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.username.trim()) {
      newErrors.username = "Username is required";
    } else if (formData.username.length < 3) {
      newErrors.username = "Username must be at least 3 characters";
    } else if (!/^[a-zA-Z0-9_-]+$/.test(formData.username)) {
      newErrors.username =
        "Username can only contain letters, numbers, _ and -";
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (
      formData.twitter &&
      !/^@?[a-zA-Z0-9_]{1,15}$/.test(formData.twitter.replace("@", ""))
    ) {
      newErrors.twitter = "Please enter a valid Twitter handle";
    }

    if (
      formData.telegram &&
      !/^@?[a-zA-Z0-9_]{5,32}$/.test(formData.telegram.replace("@", ""))
    ) {
      newErrors.telegram = "Please enter a valid Telegram username";
    }

    if (formData.bio && formData.bio.length > 500) {
      newErrors.bio = "Bio must be less than 500 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const cleanedData = {
        ...formData,
        twitter: formData.twitter
          ? formData.twitter.replace("@", "")
          : undefined,
        telegram: formData.telegram
          ? formData.telegram.replace("@", "")
          : undefined,
        email: formData.email || undefined,
        bio: formData.bio || undefined,
      };

      await onSubmit(cleanedData);
      onClose();
    } catch (error) {
      console.error("Error submitting profile:", error);
      setErrors({ submit: "Failed to save profile. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof UserProfileData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const handleClose = () => {
    if (!isRequired) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        onClick={handleClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-md rounded-2xl border border-white/20 bg-gradient-to-br from-gray-900/95 to-black/95 p-6 shadow-2xl backdrop-blur-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 text-2xl shadow-lg">
                👤
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">
                  Complete Your Profile
                </h2>
                <p className="text-sm text-gray-400">Tell us about yourself</p>
              </div>
            </div>
            {!isRequired && (
              <button
                onClick={handleClose}
                className="rounded-full bg-white/10 p-2 text-white/70 transition-all hover:bg-white/20 hover:text-white"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                </svg>
              </button>
            )}
          </div>
          <div className="mb-6 rounded-xl bg-white/5 p-4">
            <div className="mb-2 text-sm font-medium text-gray-300">
              Connected Wallet
            </div>
            <div className="font-mono text-sm break-all text-white">
              {walletAddress}
            </div>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Username <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => handleInputChange("username", e.target.value)}
                className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-white placeholder-gray-400 backdrop-blur-sm transition-all focus:border-purple-500 focus:bg-white/10 focus:outline-none"
                placeholder="Enter your username"
                maxLength={30}
              />
              {errors.username && (
                <p className="mt-1 text-sm text-red-400">{errors.username}</p>
              )}
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Email (optional)
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-white placeholder-gray-400 backdrop-blur-sm transition-all focus:border-purple-500 focus:bg-white/10 focus:outline-none"
                placeholder="your@email.com"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-400">{errors.email}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">
                  Twitter
                </label>
                <input
                  type="text"
                  value={formData.twitter}
                  onChange={(e) => handleInputChange("twitter", e.target.value)}
                  className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-white placeholder-gray-400 backdrop-blur-sm transition-all focus:border-purple-500 focus:bg-white/10 focus:outline-none"
                  placeholder="@username"
                />
                {errors.twitter && (
                  <p className="mt-1 text-sm text-red-400">{errors.twitter}</p>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">
                  Telegram
                </label>
                <input
                  type="text"
                  value={formData.telegram}
                  onChange={(e) =>
                    handleInputChange("telegram", e.target.value)
                  }
                  className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-white placeholder-gray-400 backdrop-blur-sm transition-all focus:border-purple-500 focus:bg-white/10 focus:outline-none"
                  placeholder="@username"
                />
                {errors.telegram && (
                  <p className="mt-1 text-sm text-red-400">{errors.telegram}</p>
                )}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Bio (optional)
              </label>
              <textarea
                value={formData.bio}
                onChange={(e) => handleInputChange("bio", e.target.value)}
                className="w-full resize-none rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-white placeholder-gray-400 backdrop-blur-sm transition-all focus:border-purple-500 focus:bg-white/10 focus:outline-none"
                placeholder="Tell us about yourself..."
                rows={3}
                maxLength={500}
              />
              <div className="mt-1 text-right text-xs text-gray-400">
                {formData.bio?.length || 0}/500
              </div>
              {errors.bio && (
                <p className="mt-1 text-sm text-red-400">{errors.bio}</p>
              )}
            </div>
            {errors.submit && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                <p className="text-sm text-red-400">{errors.submit}</p>
              </div>
            )}

            <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
              <h4 className="mb-1 flex items-center gap-2 text-sm font-medium text-blue-400">
                <span>🔒</span>
                Privacy & Data
              </h4>
              <p className="text-xs text-blue-300/80">
                Your profile information will be stored securely and only used
                for the BitPill platform. You can update or delete your data
                anytime.
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              {!isRequired && (
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 rounded-xl border border-white/20 bg-white/5 px-4 py-3 font-semibold text-gray-300 transition-all hover:bg-white/10 hover:text-white"
                >
                  Skip for Now
                </button>
              )}
              <button
                type="submit"
                disabled={isSubmitting}
                className={`${isRequired ? "flex-1" : "flex-1"} rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-3 font-semibold text-white transition-all hover:from-purple-600 hover:to-pink-600 disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {isSubmitting ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Saving...
                  </div>
                ) : (
                  "Save Profile"
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
