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

interface FormErrors {
  name?: string;
  ticker?: string;
  description?: string;
  imageUrl?: string;
  submit?: string;
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
  const [errors, setErrors] = useState<FormErrors>({});
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;

    // Auto-format ticker to uppercase
    const finalValue = name === "ticker" ? value.toUpperCase() : value;

    setFormData((prev) => ({ ...prev, [name]: finalValue }));

    // Clear specific field error when user starts typing
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Name validation
    if (!formData.name.trim()) {
      newErrors.name = "Meme name is required";
    } else if (formData.name.length < 2) {
      newErrors.name = "Name must be at least 2 characters";
    } else if (formData.name.length > 50) {
      newErrors.name = "Name must be less than 50 characters";
    }

    // Ticker validation
    if (!formData.ticker.trim()) {
      newErrors.ticker = "Ticker is required";
    } else if (formData.ticker.length < 2) {
      newErrors.ticker = "Ticker must be at least 2 characters";
    } else if (formData.ticker.length > 10) {
      newErrors.ticker = "Ticker must be 10 characters or less";
    } else if (!/^[A-Z0-9]+$/.test(formData.ticker)) {
      newErrors.ticker = "Ticker can only contain letters and numbers";
    }

    // Description validation
    if (!formData.description.trim()) {
      newErrors.description = "Description is required";
    } else if (formData.description.length < 10) {
      newErrors.description = "Description must be at least 10 characters";
    } else if (formData.description.length > 280) {
      newErrors.description = "Description must be less than 280 characters";
    }

    // Image validation
    if (!formData.imageUrl && !imageFile) {
      newErrors.imageUrl = "Meme image is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setErrors((prev) => ({
        ...prev,
        imageUrl: "Please select a valid image file",
      }));
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      setErrors((prev) => ({
        ...prev,
        imageUrl: "Image file size must be less than 5MB",
      }));
      return;
    }

    setImageFile(file);
    setErrors((prev) => ({ ...prev, imageUrl: undefined }));

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
    setErrors((prev) => ({ ...prev, imageUrl: undefined }));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      await onSubmit(formData);
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
      setErrors({ submit: "Failed to submit proposal. Please try again." });
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
                  Meme Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="e.g., Doge Rocket"
                  maxLength={50}
                  className={`w-full rounded-xl border bg-white/5 px-4 py-3 text-white placeholder-gray-500 ring-1 transition-all focus:outline-none ${
                    errors.name
                      ? "border-red-500/50 ring-red-500/20 focus:border-red-500 focus:ring-red-500/30"
                      : "border-white/20 ring-white/10 focus:border-white/30 focus:ring-white/20"
                  }`}
                  required
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-400">{errors.name}</p>
                )}
                <div className="mt-1 text-xs text-gray-500">
                  {formData.name.length}/50 characters
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">
                  Ticker <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  name="ticker"
                  value={formData.ticker}
                  onChange={handleInputChange}
                  placeholder="e.g., DGRKT"
                  maxLength={10}
                  className={`w-full rounded-xl border bg-white/5 px-4 py-3 font-mono text-white uppercase placeholder-gray-500 ring-1 transition-all focus:outline-none ${
                    errors.ticker
                      ? "border-red-500/50 ring-red-500/20 focus:border-red-500 focus:ring-red-500/30"
                      : "border-white/20 ring-white/10 focus:border-white/30 focus:ring-white/20"
                  }`}
                  required
                />
                {errors.ticker && (
                  <p className="mt-1 text-sm text-red-400">{errors.ticker}</p>
                )}
                <div className="mt-1 text-xs text-gray-500">
                  {formData.ticker.length}/10 characters
                </div>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Description <span className="text-red-400">*</span>
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Describe your meme coin... What makes it special? Why should the community vote for it?"
                rows={4}
                maxLength={280}
                className={`w-full resize-none rounded-xl border bg-white/5 px-4 py-3 text-white placeholder-gray-500 ring-1 transition-all focus:outline-none ${
                  errors.description
                    ? "border-red-500/50 ring-red-500/20 focus:border-red-500 focus:ring-red-500/30"
                    : "border-white/20 ring-white/10 focus:border-white/30 focus:ring-white/20"
                }`}
                required
              />
              {errors.description && (
                <p className="mt-1 text-sm text-red-400">
                  {errors.description}
                </p>
              )}
              <div className="mt-1 text-xs text-gray-500">
                {formData.description.length}/280 characters
              </div>
            </div>

            {/* Image Upload */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Meme Image <span className="text-red-400">*</span>
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
                    className={`w-full rounded-xl border-2 border-dashed bg-white/5 px-6 py-8 text-center transition-all ${
                      errors.imageUrl
                        ? "border-red-500/50 hover:border-red-500/70"
                        : "border-white/20 hover:border-white/30 hover:bg-white/10"
                    }`}
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
                        <p className="text-sm text-gray-400">
                          PNG, JPG, GIF up to 5MB
                        </p>
                      </div>
                    </div>
                  </button>
                  {errors.imageUrl && (
                    <p className="mt-2 text-sm text-red-400">
                      {errors.imageUrl}
                    </p>
                  )}
                </div>
              ) : (
                <div className="relative">
                  <div className="overflow-hidden rounded-xl border border-white/20">
                    <img
                      src={imagePreview}
                      alt="Meme preview"
                      className="h-48 w-full object-cover"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={removeImage}
                    className="absolute -top-2 -right-2 rounded-full bg-red-500 p-1 text-white shadow-lg transition-all hover:bg-red-600"
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
                  <p className="mt-2 text-sm text-gray-400">
                    Upload a meme image for your proposal. This will be
                    displayed to voters.
                  </p>
                </div>
              )}
            </div>

            {/* Submit Error */}
            {errors.submit && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                <p className="text-sm text-red-400">{errors.submit}</p>
              </div>
            )}

            {/* Action Buttons */}
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
                className="flex-1 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 px-6 py-3 font-semibold text-white transition-all hover:from-purple-600 hover:to-pink-600 disabled:cursor-not-allowed disabled:opacity-50"
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
