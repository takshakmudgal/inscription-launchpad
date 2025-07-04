"use client";

import { motion, AnimatePresence } from "framer-motion";
import { XMarkIcon } from "@heroicons/react/24/outline";

interface HowItWorksModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const steps = [
  {
    title: "Submit Your Meme",
    description:
      "Create a proposal with your meme's name, ticker, description, and image. This enters your meme into the active competition.",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/20",
    icon: "SUBMIT",
  },
  {
    title: "Battle for Votes",
    description:
      "Your meme competes against others for community votes. The more popular your meme, the higher it ranks on the leaderboard.",
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/20",
    icon: "VOTE",
  },
  {
    title: "Claim Leadership",
    description:
      "When your meme reaches #1 on the leaderboard, it becomes the leader and starts the survival challenge.",
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/20",
    icon: "LEADER",
  },
  {
    title: "Survive the Challenge",
    description:
      "Leaders must maintain their #1 position for 1 consecutive block. Lose the lead = immediate elimination.",
    color: "text-orange-400",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/20",
    icon: "SURVIVE",
  },
  {
    title: "Achieve Immortality",
    description:
      "Survive 1 block as leader and your meme gets permanently inscribed on Bitcoin and launched as a token on Solana.",
    color: "text-green-400",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/20",
    icon: "IMMORTAL",
  },
];

export default function HowItWorksModal({
  isOpen,
  onClose,
}: HowItWorksModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-4 z-50 overflow-y-auto rounded-2xl border border-orange-500/20 bg-black/95 backdrop-blur-xl sm:inset-8 lg:inset-16"
          >
            <div className="flex min-h-full flex-col">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-gray-800 p-4 sm:p-6">
                <h2 className="text-xl font-bold text-white sm:text-2xl">
                  How BitPill Works
                </h2>
                <button
                  onClick={onClose}
                  className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 p-4 sm:p-6">
                <div className="space-y-6 sm:space-y-8">
                  {steps.map((step, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className={`rounded-xl border p-4 ${step.borderColor} ${step.bgColor} sm:p-6`}
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0">
                          <div
                            className={`flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-sm font-bold ${step.color} sm:h-12 sm:w-12 sm:text-base`}
                          >
                            {index + 1}
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="mb-2 flex items-center gap-3">
                            <h3 className="text-lg font-bold text-white sm:text-xl">
                              {step.title}
                            </h3>
                            <span
                              className={`rounded-full px-2 py-1 text-xs font-bold ${step.bgColor} ${step.color} border ${step.borderColor}`}
                            >
                              {step.icon}
                            </span>
                          </div>
                          <p className="text-sm text-gray-300 sm:text-base">
                            {step.description}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Key Rules */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="mt-8 rounded-xl border border-red-500/20 bg-red-500/10 p-4 sm:p-6"
                >
                  <h3 className="mb-4 text-lg font-bold text-red-400 sm:text-xl">
                    Key Rules
                  </h3>
                  <ul className="space-y-2 text-sm text-gray-300 sm:text-base">
                    <li className="flex items-start gap-2">
                      <span className="text-red-400">•</span>
                      <span>
                        Leaders must defend their position for exactly 1 block
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-400">•</span>
                      <span>
                        Losing the #1 position means immediate elimination
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-400">•</span>
                      <span>
                        Only one meme can be inscribed per successful cycle
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-400">•</span>
                      <span>
                        Inscribed memes achieve permanent Bitcoin immortality
                      </span>
                    </li>
                  </ul>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
