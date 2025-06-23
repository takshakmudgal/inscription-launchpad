"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface SubmitProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (proposal: {
    name: string;
    ticker: string;
    description: string;
    imageUrl: string;
    creator: string;
  }) => void;
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
    imageUrl: "",
    creator: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file");
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      setError("Image file size must be less than 5MB");
      return;
    }

    setImageFile(file);
    setError(null);

    // Create preview URL
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result && typeof e.target.result === "string") {
        setImagePreview(e.target.result);
        setFormData((prev) => ({
          ...prev,
          imageUrl: e.target?.result as string,
        }));
      }
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setFormData((prev) => ({ ...prev, imageUrl: "" }));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    // Basic validation
    if (
      !formData.name ||
      !formData.ticker ||
      !formData.description ||
      !formData.creator
    ) {
      setError("Please fill in all required fields");
      return;
    }

    if (formData.ticker.length > 10) {
      setError("Ticker must be 10 characters or less");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      onSubmit(formData);
      // Reset form
      setFormData({
        name: "",
        ticker: "",
        description: "",
        imageUrl: "",
        creator: "",
      });
      removeImage();
      onClose();
    } catch (error) {
      console.error("Error submitting proposal:", error);
      setError("Failed to submit proposal. Please try again.");
    } finally {
      setIsSubmitting(false);
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
          className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-3xl border border-white/20 bg-gradient-to-br from-gray-900/95 to-black/95 shadow-2xl ring-1 ring-white/10 backdrop-blur-xl"
        >
          {/* Header */}
          <div className="sticky top-0 z-10 border-b border-white/20 bg-gradient-to-r from-white/10 to-gray-800/20 p-6 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">
                  🚀 Submit Meme Proposal
                </h2>
                <p className="mt-1 text-gray-400">
                  Create your meme coin to compete for Bitcoin inscription
                </p>
              </div>
              <button
                onClick={onClose}
                className="rounded-full bg-white/10 p-2 text-white/70 transition-all hover:bg-white/20 hover:text-white"
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6 p-6">
            {/* Name & Ticker Row */}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">
                  Meme Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="e.g., Doge Rocket"
                  className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white placeholder-gray-500 ring-1 ring-white/10 transition-all focus:border-white/30 focus:ring-white/20 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">
                  Ticker *
                </label>
                <input
                  type="text"
                  name="ticker"
                  value={formData.ticker}
                  onChange={handleInputChange}
                  placeholder="e.g., DGRKT"
                  maxLength={10}
                  className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 font-mono text-white uppercase placeholder-gray-500 ring-1 ring-white/10 transition-all focus:border-white/30 focus:ring-white/20 focus:outline-none"
                  required
                />
                <div className="mt-1 text-xs text-gray-500">
                  {formData.ticker.length}/10 characters
                </div>
              </div>
            </div>

            {/* Creator */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Creator Name *
              </label>
              <input
                type="text"
                name="creator"
                value={formData.creator}
                onChange={handleInputChange}
                placeholder="e.g., SatoshiMemes"
                className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white placeholder-gray-500 ring-1 ring-white/10 transition-all focus:border-white/30 focus:ring-white/20 focus:outline-none"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Description *
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Describe your meme coin... What makes it special? Why should the community vote for it?"
                rows={4}
                className="w-full resize-none rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white placeholder-gray-500 ring-1 ring-white/10 transition-all focus:border-white/30 focus:ring-white/20 focus:outline-none"
                required
              />
            </div>

            {/* Image Upload */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Meme Image
              </label>

              {!imagePreview ? (
                <div className="relative">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full rounded-xl border-2 border-dashed border-white/20 bg-white/5 px-6 py-8 text-center transition-all hover:border-white/30 hover:bg-white/10"
                  >
                    <div className="flex flex-col items-center gap-3">
                      <div className="rounded-full bg-white/10 p-3">
                        <svg
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="text-gray-400"
                        >
                          <rect
                            width="18"
                            height="18"
                            x="3"
                            y="3"
                            rx="2"
                            ry="2"
                          />
                          <circle cx="9" cy="9" r="2" />
                          <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium text-white">
                          Click to upload image
                        </p>
                        <p className="mt-1 text-sm text-gray-400">
                          PNG, JPG, GIF up to 5MB
                        </p>
                      </div>
                    </div>
                  </button>
                </div>
              ) : (
                <div className="rounded-xl border border-white/20 bg-white/5 p-4">
                  <div className="mb-3 flex items-start justify-between">
                    <label className="text-sm font-medium text-gray-300">
                      Image Preview
                    </label>
                    <button
                      type="button"
                      onClick={removeImage}
                      className="rounded-full bg-red-500/20 p-1 text-red-400 transition-all hover:bg-red-500/30"
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                      </svg>
                    </button>
                  </div>
                  <div className="relative aspect-square w-full max-w-xs overflow-hidden rounded-lg">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  {imageFile && (
                    <p className="mt-2 text-xs text-gray-400">
                      {imageFile.name} •{" "}
                      {(imageFile.size / 1024 / 1024).toFixed(2)}MB
                    </p>
                  )}
                </div>
              )}

              <p className="mt-2 text-xs text-gray-500">
                Upload a meme image for your proposal. This will be displayed to
                voters.
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-400">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl border border-white/20 bg-white/5 px-6 py-3 font-semibold text-gray-300 transition-all hover:bg-white/10 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 rounded-xl bg-gradient-to-r from-zinc-700 via-gray-600 to-zinc-700 px-6 py-3 font-semibold text-white ring-1 ring-white/20 transition-all hover:from-zinc-600 hover:via-gray-500 hover:to-zinc-600 hover:ring-white/30 disabled:from-gray-800 disabled:via-gray-700 disabled:to-gray-800 disabled:text-gray-500 disabled:ring-white/10"
              >
                {isSubmitting ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Submitting...
                  </div>
                ) : (
                  "🚀 Submit Proposal"
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
