"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Notification {
  id: string;
  type: "success" | "error" | "info";
  title: string;
  message: string;
  autoClose?: boolean;
  duration?: number;
}

interface OrderNotificationProps {
  notifications: Notification[];
  onRemove: (id: string) => void;
}

export function OrderNotification({
  notifications,
  onRemove,
}: OrderNotificationProps) {
  useEffect(() => {
    notifications.forEach((notification) => {
      if (notification.autoClose !== false) {
        const timer = setTimeout(() => {
          onRemove(notification.id);
        }, notification.duration || 5000);

        return () => clearTimeout(timer);
      }
    });
  }, [notifications, onRemove]);

  const getNotificationStyles = (type: string) => {
    switch (type) {
      case "success":
        return {
          bg: "from-green-500/20 to-emerald-500/20",
          border: "border-green-500/30",
          icon: "🎉",
          iconBg: "bg-green-500",
        };
      case "error":
        return {
          bg: "from-red-500/20 to-pink-500/20",
          border: "border-red-500/30",
          icon: "❌",
          iconBg: "bg-red-500",
        };
      case "info":
      default:
        return {
          bg: "from-blue-500/20 to-purple-500/20",
          border: "border-blue-500/30",
          icon: "ℹ️",
          iconBg: "bg-blue-500",
        };
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 space-y-3">
      <AnimatePresence>
        {notifications.map((notification) => {
          const styles = getNotificationStyles(notification.type);

          return (
            <motion.div
              key={notification.id}
              initial={{ opacity: 0, x: 300, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 300, scale: 0.9 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className={`w-80 rounded-xl border ${styles.border} bg-gradient-to-r ${styles.bg} p-4 shadow-2xl backdrop-blur-xl`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${styles.iconBg} text-white shadow-lg`}
                >
                  <span className="text-lg">{styles.icon}</span>
                </div>

                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-semibold text-white">
                    {notification.title}
                  </h4>
                  <p className="mt-1 text-xs leading-relaxed text-gray-300">
                    {notification.message}
                  </p>
                </div>

                <button
                  onClick={() => onRemove(notification.id)}
                  className="shrink-0 rounded-full bg-white/10 p-1 text-white/70 transition-all hover:bg-white/20 hover:text-white"
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
              {notification.autoClose !== false && (
                <motion.div
                  className="mt-3 h-1 overflow-hidden rounded-full bg-white/20"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <motion.div
                    className="h-full rounded-full bg-white/50"
                    initial={{ width: "100%" }}
                    animate={{ width: "0%" }}
                    transition={{
                      duration: (notification.duration || 5000) / 1000,
                      ease: "linear",
                    }}
                  />
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = (notification: Omit<Notification, "id">) => {
    const id = Math.random().toString(36).substr(2, 9);
    setNotifications((prev) => [...prev, { ...notification, id }]);
  };

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  return {
    notifications,
    addNotification,
    removeNotification,
    clearAll,
  };
}
