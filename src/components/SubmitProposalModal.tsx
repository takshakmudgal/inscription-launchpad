"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { z } from "zod";
import type { ProposalSubmission } from "~/types";

const proposalSchema = z.object({
  name: z.string().min(1, "Meme name is required."),
  ticker: z
    .string()
    .min(1, "Ticker is required.")
    .max(10, "Ticker must be 10 characters or less."),
  description: z.string().min(1, "Description is required."),
  twitter: z.string().url("Invalid Twitter URL.").optional().or(z.literal("")),
  telegram: z
    .string()
    .url("Invalid Telegram URL.")
    .optional()
    .or(z.literal("")),
});

interface SubmitProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (proposal: ProposalSubmission) => void;
}

export function SubmitProposalModal({
  isOpen,
  onClose,
  onSubmit,
}: SubmitProposalModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    ticker: "",
    description: "",
    twitter: "",
    telegram: "",
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setFormData({
      name: "",
      ticker: "",
      description: "",
      twitter: "",
      telegram: "",
    });
    setImageFile(null);
    setBannerFile(null);
    setImagePreview(null);
    setBannerPreview(null);
    setIsSubmitting(false);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    resetForm();
    onClose();
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image must be less than 5MB");
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Banner must be less than 5MB");
        return;
      }
      setBannerFile(file);
      const reader = new FileReader();
      reader.onload = () => setBannerPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const uploadFile = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || "Upload failed");
    }

    return result.url;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!imageFile) {
      toast.error("Please select an image");
      return;
    }

    setIsSubmitting(true);

    try {
      // Upload image file
      const imageUrl = await uploadFile(imageFile);

      // Upload banner file if provided
      let bannerUrl: string | undefined;
      if (bannerFile) {
        bannerUrl = await uploadFile(bannerFile);
      }

      const submissionData = {
        ...formData,
        imageUrl,
        bannerUrl,
      };

      const result = proposalSchema.safeParse(submissionData);
      if (!result.success) {
        const errorMessage = result.error.errors[0]?.message;
        toast.error(errorMessage || "Invalid data.");
        return;
      }

      const proposal: ProposalSubmission = {
        name: result.data.name,
        ticker: result.data.ticker.toUpperCase().replace(/[^A-Z0-9]/g, ""),
        description: result.data.description,
        imageUrl,
        bannerUrl,
      };

      if (result.data.twitter) {
        proposal.twitter = result.data.twitter;
      }
      if (result.data.telegram) {
        proposal.telegram = result.data.telegram;
      }

      await onSubmit(proposal);
      resetForm();
    } catch (error) {
      console.error("Failed to submit proposal:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to submit proposal",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 lg:p-6">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="relative max-h-[95vh] w-full max-w-md overflow-y-auto rounded-2xl border border-orange-500/20 bg-gradient-to-br from-gray-900/95 to-gray-800/95 shadow-2xl backdrop-blur-xl sm:max-w-lg"
        >
          {/* Header */}
          <div className="extra-mobile-padding sticky top-0 border-b border-orange-500/20 bg-gray-900/90 p-3 backdrop-blur-xl sm:p-4 lg:p-6">
            <div className="flex items-center justify-between">
              <h2 className="extra-mobile-title bg-gradient-to-r from-orange-400 via-orange-300 to-orange-200 bg-clip-text text-lg font-bold text-transparent sm:text-xl lg:text-2xl">
                Create Meme
              </h2>
              <button
                onClick={handleClose}
                disabled={isSubmitting}
                className="rounded-lg p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50 sm:p-2"
              >
                <svg
                  className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Form */}
          <form
            onSubmit={handleSubmit}
            className="extra-mobile-padding space-y-3 p-3 sm:space-y-4 sm:p-4 lg:space-y-6 lg:p-6"
          >
            {/* Basic Info */}
            <div className="space-y-2.5 sm:space-y-3 lg:space-y-4">
              <div>
                <label className="extra-mobile-text mb-1.5 block text-sm font-medium text-white sm:mb-2">
                  Meme Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Enter your meme's name"
                  className="extra-mobile-padding extra-mobile-text w-full rounded-xl border border-orange-500/20 bg-white/5 px-2.5 py-1.5 text-sm text-white placeholder-white/40 transition-all focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 focus:outline-none sm:px-3 sm:py-2 lg:px-4 lg:py-3 lg:text-base"
                  required
                />
              </div>

              <div>
                <label className="extra-mobile-text mb-1.5 block text-sm font-medium text-white sm:mb-2">
                  Ticker Symbol *
                </label>
                <input
                  type="text"
                  value={formData.ticker}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      ticker: e.target.value.toUpperCase(),
                    })
                  }
                  placeholder="e.g. DOGE"
                  maxLength={10}
                  className="extra-mobile-padding extra-mobile-text w-full rounded-xl border border-orange-500/20 bg-white/5 px-2.5 py-1.5 text-sm text-white uppercase placeholder-white/40 transition-all focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 focus:outline-none sm:px-3 sm:py-2 lg:px-4 lg:py-3 lg:text-base"
                  required
                />
              </div>

              <div>
                <label className="extra-mobile-text mb-1.5 block text-sm font-medium text-white sm:mb-2">
                  Description *
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Describe your meme..."
                  rows={2}
                  className="extra-mobile-padding extra-mobile-text sm:rows-3 w-full rounded-xl border border-orange-500/20 bg-white/5 px-2.5 py-1.5 text-sm text-white placeholder-white/40 transition-all focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 focus:outline-none sm:px-3 sm:py-2 lg:px-4 lg:py-3 lg:text-base"
                  required
                />
              </div>

              <div>
                <label className="extra-mobile-text mb-1.5 block text-sm font-medium text-white sm:mb-2">
                  Twitter Handle (optional)
                </label>
                <input
                  type="text"
                  value={formData.twitter}
                  onChange={(e) =>
                    setFormData({ ...formData, twitter: e.target.value })
                  }
                  placeholder="https://x.com/username"
                  className="extra-mobile-padding extra-mobile-text w-full rounded-xl border border-orange-500/20 bg-white/5 px-2.5 py-1.5 text-sm text-white placeholder-white/40 transition-all focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 focus:outline-none sm:px-3 sm:py-2 lg:px-4 lg:py-3 lg:text-base"
                />
              </div>

              <div>
                <label className="extra-mobile-text mb-1.5 block text-sm font-medium text-white sm:mb-2">
                  Telegram Link (optional)
                </label>
                <input
                  type="text"
                  value={formData.telegram}
                  onChange={(e) =>
                    setFormData({ ...formData, telegram: e.target.value })
                  }
                  placeholder="https://t.me/username"
                  className="extra-mobile-padding extra-mobile-text w-full rounded-xl border border-orange-500/20 bg-white/5 px-2.5 py-1.5 text-sm text-white placeholder-white/40 transition-all focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 focus:outline-none sm:px-3 sm:py-2 lg:px-4 lg:py-3 lg:text-base"
                />
              </div>
            </div>

            {/* Image Upload */}
            <div className="space-y-2.5 sm:space-y-3 lg:space-y-4">
              <div>
                <label className="extra-mobile-text mb-1.5 block text-sm font-medium text-white sm:mb-2">
                  Meme Image * (Max 5MB)
                </label>
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                    required={!imageFile}
                  />
                  <div className="flex h-24 items-center justify-center rounded-xl border-2 border-dashed border-orange-500/50 bg-white/5 transition-colors hover:border-orange-500/70 hover:bg-white/8 sm:h-32 lg:h-40">
                    {imagePreview ? (
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="h-full w-full rounded-xl object-cover"
                      />
                    ) : (
                      <div className="text-center">
                        <div className="text-xl text-orange-400 sm:text-2xl lg:text-3xl">
                          📸
                        </div>
                        <p className="extra-mobile-text mt-1 text-xs text-white/60 sm:text-sm">
                          Click to upload image
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="extra-mobile-text mb-1.5 block text-sm font-medium text-white sm:mb-2">
                  Banner Image (optional, Max 5MB)
                </label>
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleBannerChange}
                    className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                  />
                  <div className="flex h-20 items-center justify-center rounded-xl border-2 border-dashed border-orange-500/50 bg-white/5 transition-colors hover:border-orange-500/70 hover:bg-white/8 sm:h-24 lg:h-32">
                    {bannerPreview ? (
                      <img
                        src={bannerPreview}
                        alt="Banner Preview"
                        className="h-full w-full rounded-xl object-cover"
                      />
                    ) : (
                      <div className="text-center">
                        <div className="text-lg text-orange-400 sm:text-xl lg:text-2xl">
                          🖼️
                        </div>
                        <p className="extra-mobile-text mt-1 text-xs text-white/60 sm:text-sm">
                          Click to upload banner
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex gap-2 pt-1 sm:gap-3 sm:pt-2 lg:gap-4">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="ultra-mobile-button flex-1 rounded-xl border border-orange-500/20 bg-white/5 py-2 text-sm font-medium text-white transition-all hover:border-orange-500/30 hover:bg-white/8 disabled:opacity-50 sm:py-2.5 lg:py-3 lg:text-base"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="ultra-mobile-button flex-1 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 py-2 text-sm font-medium text-white transition-all hover:from-orange-400 hover:to-orange-500 disabled:opacity-50 sm:py-2.5 lg:py-3 lg:text-base"
              >
                {isSubmitting ? (
                  <div className="flex items-center justify-center gap-1.5">
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border border-white/30 border-t-white sm:h-4 sm:w-4" />
                    <span>Submitting...</span>
                  </div>
                ) : (
                  "Submit Proposal"
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
