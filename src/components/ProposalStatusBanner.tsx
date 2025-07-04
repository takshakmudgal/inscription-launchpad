import { motion } from "framer-motion";
import React from "react";

interface ProposalStatusBannerProps {
  status: "leader" | "inscribing";
  progress?: number;
  remaining?: number;
}

const ProposalStatusBanner: React.FC<ProposalStatusBannerProps> = ({
  status,
  progress,
  remaining,
}) => {
  const isLeader = status === "leader";
  const isInscribing = status === "inscribing";

  const config = {
    leader: {
      bgColor: "bg-amber-500/10",
      borderColor: "border-amber-500/20",
      textColor: "text-amber-400",
      title: "Blocks to Survival",
      value: remaining,
      progressColor: "bg-amber-500",
    },
    inscribing: {
      bgColor: "bg-blue-500/10",
      borderColor: "border-blue-500/20",
      textColor: "text-blue-400",
      title: "Inscribing Now",
      value: "In Progress",
      progressColor: "bg-blue-500",
    },
  };

  const currentConfig = config[status];

  if (!currentConfig) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className={`overflow-hidden rounded-b-2xl border-t ${currentConfig.borderColor} ${currentConfig.bgColor}`}
    >
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div
            className={`flex items-center gap-2 text-sm font-semibold ${currentConfig.textColor}`}
          >
            <span>{currentConfig.title}</span>
          </div>
          <span className={`text-sm font-bold ${currentConfig.textColor}`}>
            {currentConfig.value}
          </span>
        </div>
        {(isLeader || isInscribing) && (
          <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-gray-700/50">
            <motion.div
              className={`h-full rounded-full ${currentConfig.progressColor}`}
              initial={{ width: "0%" }}
              animate={{
                width: isInscribing ? "100%" : `${progress ?? 0}%`,
              }}
              transition={{
                duration: isInscribing ? 1.5 : 1,
                repeat: isInscribing ? Infinity : 0,
                ease: isInscribing ? "linear" : "easeOut",
              }}
            />
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default ProposalStatusBanner;
