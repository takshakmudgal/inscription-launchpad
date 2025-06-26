"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  getActiveOrdersFromStorage,
  removeOrderFromStorage,
} from "./InscriptionModal";

interface ActiveOrder {
  orderId: string;
  payAddress: string;
  amount: number;
  status: string;
  proposalId: number;
  proposalName: string;
  proposalTicker: string;
  receiveAddress: string;
  createdAt: number;
}

interface ActiveOrdersWidgetProps {
  onResumeOrder: (
    orderId: string,
    proposalId: number,
    proposalName: string,
    proposalTicker: string,
    receiveAddress: string,
  ) => void;
}

export function ActiveOrdersWidget({ onResumeOrder }: ActiveOrdersWidgetProps) {
  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [checkingOrders, setCheckingOrders] = useState<Set<string>>(new Set());
  const [orderStatuses, setOrderStatuses] = useState<Record<string, string>>(
    {},
  );

  useEffect(() => {
    const loadActiveOrders = () => {
      try {
        const orders = getActiveOrdersFromStorage();
        const orderList = Object.values(orders).sort(
          (a, b) => b.createdAt - a.createdAt,
        );
        setActiveOrders(orderList);
        orderList.forEach((order) => {
          checkOrderStatus(order, false);
        });
      } catch (error) {
        console.error("Failed to load active orders:", error);
      }
    };
    loadActiveOrders();
    const interval = setInterval(loadActiveOrders, 30000);
    return () => clearInterval(interval);
  }, []);

  const checkOrderStatus = async (order: ActiveOrder, showSpinner = true) => {
    if (showSpinner) {
      setCheckingOrders((prev) => new Set(prev).add(order.orderId));
    }

    try {
      const response = await fetch(`/api/unisat/order/${order.orderId}`);
      const data = await response.json();

      if (response.ok && data.success) {
        const status = data.data.status;
        setOrderStatuses((prev) => ({
          ...prev,
          [order.orderId]: status,
        }));

        if (
          status === "minted" ||
          status === "sent" ||
          status === "canceled" ||
          status === "refunded"
        ) {
          removeOrderFromStorage(order.orderId);
          setActiveOrders((prev) =>
            prev.filter((o) => o.orderId !== order.orderId),
          );

          if (status === "minted" || status === "sent") {
            console.log(`Inscription complete for order ${order.orderId}`);
          }
        }
      }
    } catch (error) {
      console.error("Failed to check order status:", error);
    } finally {
      if (showSpinner) {
        setCheckingOrders((prev) => {
          const newSet = new Set(prev);
          newSet.delete(order.orderId);
          return newSet;
        });
      }
    }
  };

  const formatSatoshis = (sats: number) => {
    const btc = sats / 100000000;
    return `${btc.toFixed(8)} BTC`;
  };

  const formatTimeAgo = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return "Just now";
  };

  const getStatusDisplay = (orderId: string) => {
    const status = orderStatuses[orderId] || "pending";

    switch (status) {
      case "pending":
        return { text: "Payment Pending", color: "text-yellow-400" };
      case "payment_received":
      case "payment_success":
        return { text: "Payment Received", color: "text-blue-400" };
      case "inscribing":
        return { text: "Creating Inscription", color: "text-purple-400" };
      case "minted":
      case "sent":
        return { text: "Inscription Complete", color: "text-green-400" };
      case "canceled":
        return { text: "Canceled", color: "text-red-400" };
      case "refunded":
        return { text: "Refunded", color: "text-orange-400" };
      default:
        return { text: "Payment Pending", color: "text-yellow-400" };
    }
  };

  const handleResumeOrder = (order: ActiveOrder) => {
    onResumeOrder(
      order.orderId,
      order.proposalId,
      order.proposalName,
      order.proposalTicker,
      order.receiveAddress,
    );
  };

  if (activeOrders.length === 0) {
    return null;
  }

  return (
    <div className="fixed right-4 bottom-4 z-40">
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="mb-4 w-80 rounded-xl border border-white/20 bg-gradient-to-br from-gray-900/95 to-black/95 p-4 shadow-2xl backdrop-blur-xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold text-white">Active Orders</h3>
              <button
                onClick={() => setIsExpanded(false)}
                className="rounded-full bg-white/10 p-1 text-white/70 transition-all hover:bg-white/20 hover:text-white"
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

            <div className="max-h-80 space-y-3 overflow-y-auto">
              {activeOrders.map((order) => {
                const statusDisplay = getStatusDisplay(order.orderId);
                return (
                  <div
                    key={order.orderId}
                    className="rounded-lg border border-white/10 bg-white/5 p-3"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-white">
                          {order.proposalName}
                        </p>
                        <p className="text-xs text-gray-400">
                          ${order.proposalTicker} •{" "}
                          {formatTimeAgo(order.createdAt)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-medium text-yellow-400">
                          {formatSatoshis(order.amount)}
                        </p>
                        <p className={`text-xs ${statusDisplay.color}`}>
                          {statusDisplay.text}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleResumeOrder(order)}
                        className="flex-1 rounded-md bg-gradient-to-r from-purple-500 to-pink-500 px-3 py-1.5 text-xs font-medium text-white transition-all hover:from-purple-600 hover:to-pink-600"
                      >
                        Resume
                      </button>
                      <button
                        onClick={() => checkOrderStatus(order)}
                        disabled={checkingOrders.has(order.orderId)}
                        className="rounded-md bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition-all hover:bg-white/20 disabled:opacity-50"
                      >
                        {checkingOrders.has(order.orderId) ? (
                          <div className="h-3 w-3 animate-spin rounded-full border border-white/30 border-t-white" />
                        ) : (
                          "Check"
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 rounded-lg border border-blue-500/30 bg-blue-500/10 p-2">
              <p className="text-xs text-blue-300/80">
                💡 These orders are saved locally. You can safely close the app
                and resume later.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={() => setIsExpanded(!isExpanded)}
        className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg transition-all hover:scale-105 hover:from-purple-600 hover:to-pink-600"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <div className="relative">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="currentColor"
            className={`transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
          >
            <path d="M13 7h-2v4H7v2h4v4h2v-4h4v-2h-4V7z" />
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
          </svg>

          {activeOrders.length > 0 && (
            <div className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
              {activeOrders.length}
            </div>
          )}
        </div>
      </motion.button>
    </div>
  );
}
