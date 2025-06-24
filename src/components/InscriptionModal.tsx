"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface InscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  proposalId: number;
  proposalName: string;
  proposalTicker: string;
  receiveAddress: string;
  existingOrderId?: string; // For recovering existing orders
}

interface InscriptionOrder {
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

interface OrderStatus {
  orderId: string;
  status: string;
  files: Array<{
    filename: string;
    inscriptionId?: string;
    txid?: string;
  }>;
  payAddress: string;
  amount: number;
  paidAmount: number;
}

// LocalStorage key for persisting orders
const ACTIVE_ORDERS_KEY = "bitmemes_active_orders";

// Utility functions for order persistence
const saveOrderToStorage = (order: InscriptionOrder) => {
  try {
    const activeOrders = getActiveOrdersFromStorage();
    activeOrders[order.orderId] = order;
    localStorage.setItem(ACTIVE_ORDERS_KEY, JSON.stringify(activeOrders));
  } catch (error) {
    console.error("Failed to save order to storage:", error);
  }
};

const getActiveOrdersFromStorage = (): Record<string, InscriptionOrder> => {
  try {
    const stored = localStorage.getItem(ACTIVE_ORDERS_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.error("Failed to get orders from storage:", error);
    return {};
  }
};

const removeOrderFromStorage = (orderId: string) => {
  try {
    const activeOrders = getActiveOrdersFromStorage();
    delete activeOrders[orderId];
    localStorage.setItem(ACTIVE_ORDERS_KEY, JSON.stringify(activeOrders));
  } catch (error) {
    console.error("Failed to remove order from storage:", error);
  }
};

export function InscriptionModal({
  isOpen,
  onClose,
  proposalId,
  proposalName,
  proposalTicker,
  receiveAddress,
  existingOrderId,
}: InscriptionModalProps) {
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [order, setOrder] = useState<InscriptionOrder | null>(null);
  const [orderStatus, setOrderStatus] = useState<OrderStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"confirm" | "payment" | "success">(
    "confirm",
  );
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);

  // Function to check order status
  const checkOrderStatus = useCallback(async (orderId: string) => {
    try {
      const response = await fetch(`/api/unisat/order/${orderId}`);
      const data = await response.json();

      if (response.ok && data.success) {
        setOrderStatus(data.data);

        // Check if inscription is complete
        if (data.data.status === "minted" || data.data.status === "sent") {
          setStep("success");
          setIsMonitoring(false);
          // Remove from active orders since it's complete
          removeOrderFromStorage(orderId);
          return true; // Order complete
        } else if (
          data.data.status === "canceled" ||
          data.data.status === "refunded"
        ) {
          setError("Order was canceled or refunded");
          setIsMonitoring(false);
          // Remove from active orders since it failed
          removeOrderFromStorage(orderId);
          return true; // Order failed
        }
      } else {
        console.error("Failed to check order status:", data.error);
      }
    } catch (error) {
      console.error("Error checking order status:", error);
    }
    return false; // Order still pending
  }, []);

  // Function to recover an existing order
  const recoverOrder = useCallback(
    async (orderId: string) => {
      setIsRecovering(true);
      setError(null);

      try {
        // First check if order exists in localStorage
        const activeOrders = getActiveOrdersFromStorage();
        const storedOrder = activeOrders[orderId];

        if (storedOrder) {
          setOrder(storedOrder);
          setStep("payment");
          setIsMonitoring(true);

          // Check current status
          await checkOrderStatus(orderId);
        } else {
          // Try to get order details from API
          const response = await fetch(`/api/unisat/order/${orderId}`);
          const data = await response.json();

          if (response.ok && data.success) {
            // Reconstruct order object
            const recoveredOrder: InscriptionOrder = {
              orderId,
              payAddress: data.data.payAddress,
              amount: data.data.amount,
              status: data.data.status,
              proposalId,
              proposalName,
              proposalTicker,
              receiveAddress,
              createdAt: Date.now(),
            };

            setOrder(recoveredOrder);
            setOrderStatus(data.data);

            // Determine step based on status
            if (data.data.status === "minted" || data.data.status === "sent") {
              setStep("success");
            } else {
              setStep("payment");
              setIsMonitoring(true);
              // Save to storage for future recovery
              saveOrderToStorage(recoveredOrder);
            }
          } else {
            setError(
              "Could not recover order. It may have expired or been canceled.",
            );
          }
        }
      } catch (error) {
        console.error("Error recovering order:", error);
        setError("Failed to recover order. Please try again.");
      } finally {
        setIsRecovering(false);
      }
    },
    [
      proposalId,
      proposalName,
      proposalTicker,
      receiveAddress,
      checkOrderStatus,
    ],
  );

  // Effect to handle existing order recovery
  useEffect(() => {
    if (isOpen && existingOrderId && !order) {
      recoverOrder(existingOrderId);
    }
  }, [isOpen, existingOrderId, order, recoverOrder]);

  // Background monitoring effect
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    if (isMonitoring && order?.orderId) {
      // Check immediately
      checkOrderStatus(order.orderId);

      // Then check every 30 seconds
      intervalId = setInterval(async () => {
        const isComplete = await checkOrderStatus(order.orderId);
        if (isComplete) {
          setIsMonitoring(false);
        }
      }, 30000); // 30 seconds
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isMonitoring, order?.orderId, checkOrderStatus]);

  const handleCreateOrder = async () => {
    setIsCreatingOrder(true);
    setError(null);

    try {
      const response = await fetch("/api/unisat/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposalId,
          receiveAddress,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        const newOrder: InscriptionOrder = {
          orderId: data.data.orderId,
          payAddress: data.data.payAddress,
          amount: data.data.amount,
          status: data.data.status,
          proposalId,
          proposalName,
          proposalTicker,
          receiveAddress,
          createdAt: Date.now(),
        };

        setOrder(newOrder);
        setStep("payment");
        setIsMonitoring(true);

        // Save to localStorage for recovery
        saveOrderToStorage(newOrder);
      } else {
        setError(data.error || "Failed to create inscription order");
      }
    } catch (error) {
      console.error("Error creating inscription order:", error);
      setError("Failed to create inscription order. Please try again.");
    } finally {
      setIsCreatingOrder(false);
    }
  };

  const formatSatoshis = (sats: number) => {
    const btc = sats / 100000000;
    return `${btc.toFixed(8)} BTC (${sats.toLocaleString()} sats)`;
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // Could add a toast notification here
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const handleClose = () => {
    // Don't clear order data if it's still pending - keep for recovery
    if (order && (step === "payment" || isMonitoring)) {
      // Keep order in localStorage for recovery
      // Only clear UI state
      setOrderStatus(null);
      setStep("confirm");
      setError(null);
      setIsMonitoring(false);
    } else {
      // Order is complete or failed, safe to clear everything
      if (order) {
        removeOrderFromStorage(order.orderId);
      }
      setOrder(null);
      setOrderStatus(null);
      setStep("confirm");
      setError(null);
      setIsMonitoring(false);
    }
    onClose();
  };

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case "pending":
        return {
          text: "Waiting for Payment",
          color: "text-yellow-400",
          icon: "⏳",
        };
      case "payment_received":
      case "payment_success":
        return { text: "Payment Received", color: "text-blue-400", icon: "💳" };
      case "inscribing":
        return {
          text: "Creating Inscription",
          color: "text-purple-400",
          icon: "⚡",
        };
      case "minted":
      case "sent":
        return {
          text: "Inscription Complete",
          color: "text-green-400",
          icon: "✅",
        };
      case "canceled":
        return { text: "Canceled", color: "text-red-400", icon: "❌" };
      case "refunded":
        return { text: "Refunded", color: "text-orange-400", icon: "↩️" };
      default:
        return { text: status, color: "text-gray-400", icon: "?" };
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
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-lg rounded-2xl border border-white/20 bg-gradient-to-br from-gray-900/95 to-black/95 p-6 shadow-2xl backdrop-blur-xl"
        >
          {/* Header */}
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 text-2xl shadow-lg">
              {existingOrderId ? "🔄" : "⚡"}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                {existingOrderId ? "Resume Inscription" : "Inscribe Proposal"}
              </h2>
              <p className="text-sm text-gray-400">
                {proposalName} (${proposalTicker})
              </p>
            </div>
          </div>

          {/* Recovery Loading */}
          {isRecovering && (
            <div className="mb-6 text-center">
              <div className="mb-4 inline-flex h-12 w-12 animate-spin items-center justify-center rounded-full border-4 border-purple-500/30 border-t-purple-500"></div>
              <p className="text-gray-400">
                Recovering your inscription order...
              </p>
            </div>
          )}

          {/* Step Indicator */}
          {!isRecovering && (
            <div className="mb-6 flex items-center justify-center space-x-4">
              <div
                className={`flex items-center gap-2 ${step === "confirm" ? "text-purple-400" : step === "payment" || step === "success" ? "text-green-400" : "text-gray-500"}`}
              >
                <div
                  className={`h-3 w-3 rounded-full ${step === "confirm" ? "bg-purple-400" : step === "payment" || step === "success" ? "bg-green-400" : "bg-gray-500"}`}
                />
                <span className="text-sm font-medium">Confirm</span>
              </div>
              <div
                className={`h-px w-8 ${step === "payment" || step === "success" ? "bg-green-400" : "bg-gray-500"}`}
              />
              <div
                className={`flex items-center gap-2 ${step === "payment" ? "text-purple-400" : step === "success" ? "text-green-400" : "text-gray-500"}`}
              >
                <div
                  className={`h-3 w-3 rounded-full ${step === "payment" ? "bg-purple-400" : step === "success" ? "bg-green-400" : "bg-gray-500"}`}
                />
                <span className="text-sm font-medium">Payment</span>
              </div>
              <div
                className={`h-px w-8 ${step === "success" ? "bg-green-400" : "bg-gray-500"}`}
              />
              <div
                className={`flex items-center gap-2 ${step === "success" ? "text-purple-400" : "text-gray-500"}`}
              >
                <div
                  className={`h-3 w-3 rounded-full ${step === "success" ? "bg-purple-400" : "bg-gray-500"}`}
                />
                <span className="text-sm font-medium">Complete</span>
              </div>
            </div>
          )}

          {/* Content */}
          {!isRecovering && (
            <div className="space-y-6">
              {step === "confirm" && (
                <>
                  <div className="rounded-xl bg-white/5 p-4">
                    <h3 className="mb-3 font-semibold text-white">
                      Inscription Details
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Proposal:</span>
                        <span className="text-white">{proposalName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Ticker:</span>
                        <span className="text-white">${proposalTicker}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Receive Address:</span>
                        <span className="font-mono text-white">
                          {receiveAddress.slice(0, 8)}...
                          {receiveAddress.slice(-8)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4">
                    <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-blue-400">
                      <span>ℹ️</span>
                      What happens next?
                    </h3>
                    <p className="text-xs text-blue-300/80">
                      We'll create a Bitcoin inscription order containing this
                      proposal's data. You'll receive a payment address to send
                      Bitcoin to complete the inscription.
                    </p>
                  </div>

                  <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4">
                    <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-green-400">
                      <span>🔒</span>
                      Safe & Recoverable
                    </h3>
                    <p className="text-xs text-green-300/80">
                      Your inscription order will be automatically saved. If you
                      close this window, you can always come back and resume
                      your order from where you left off.
                    </p>
                  </div>

                  {error && (
                    <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
                      {error}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={handleClose}
                      className="flex-1 rounded-xl border border-white/20 bg-white/5 px-4 py-3 font-semibold text-gray-300 transition-all hover:bg-white/10 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateOrder}
                      disabled={isCreatingOrder}
                      className="flex-1 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-3 font-semibold text-white transition-all hover:from-purple-600 hover:to-pink-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isCreatingOrder ? (
                        <div className="flex items-center justify-center gap-2">
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                          Creating Order...
                        </div>
                      ) : (
                        "⚡ Create Inscription Order"
                      )}
                    </button>
                  </div>
                </>
              )}

              {step === "payment" && order && (
                <>
                  <div className="text-center">
                    <div className="mb-3 text-4xl">💳</div>
                    <h3 className="mb-2 text-xl font-bold text-white">
                      Payment Required
                    </h3>
                    <p className="text-gray-400">
                      Send Bitcoin to the address below to complete your
                      inscription
                    </p>
                  </div>

                  {/* Real-time Status */}
                  {orderStatus && (
                    <div className="rounded-xl bg-white/5 p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-300">
                          Order Status
                        </span>
                        {isMonitoring && (
                          <div className="flex items-center gap-2 text-xs text-blue-400">
                            <div className="h-2 w-2 animate-pulse rounded-full bg-blue-400" />
                            Monitoring...
                          </div>
                        )}
                      </div>
                      <div
                        className={`flex items-center gap-2 ${getStatusDisplay(orderStatus.status).color}`}
                      >
                        <span className="text-lg">
                          {getStatusDisplay(orderStatus.status).icon}
                        </span>
                        <span className="font-medium">
                          {getStatusDisplay(orderStatus.status).text}
                        </span>
                      </div>
                      {orderStatus.paidAmount > 0 && (
                        <div className="mt-2 text-xs text-gray-400">
                          Paid: {formatSatoshis(orderStatus.paidAmount)} /{" "}
                          {formatSatoshis(orderStatus.amount)}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-4">
                    <div className="rounded-xl bg-white/5 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-300">
                          Payment Address
                        </span>
                        <button
                          onClick={() => copyToClipboard(order.payAddress)}
                          className="rounded-lg bg-white/10 px-3 py-1 text-xs font-medium text-white transition-all hover:bg-white/20"
                        >
                          Copy
                        </button>
                      </div>
                      <div className="rounded-lg bg-black/30 p-3 font-mono text-sm break-all text-white">
                        {order.payAddress}
                      </div>
                    </div>

                    <div className="rounded-xl bg-white/5 p-4">
                      <div className="mb-2 text-sm font-medium text-gray-300">
                        Amount to Send
                      </div>
                      <div className="text-xl font-bold text-white">
                        {formatSatoshis(order.amount)}
                      </div>
                    </div>

                    <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4">
                      <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-yellow-400">
                        <span>⚠️</span>
                        Important
                      </h3>
                      <ul className="space-y-1 text-xs text-yellow-300/80">
                        <li>• Send the exact amount shown above</li>
                        <li>• Use only the provided payment address</li>
                        <li>• Status updates automatically every 30 seconds</li>
                        <li>• Safe to close - your order will be saved!</li>
                      </ul>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handleClose}
                      className="flex-1 rounded-xl border border-white/20 bg-white/5 px-4 py-3 font-semibold text-gray-300 transition-all hover:bg-white/10 hover:text-white"
                    >
                      {isMonitoring ? "🔒 Close (Saves Progress)" : "Close"}
                    </button>
                    <button
                      onClick={() => checkOrderStatus(order.orderId)}
                      disabled={isMonitoring}
                      className="flex-1 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 px-4 py-3 font-semibold text-white transition-all hover:from-green-600 hover:to-emerald-600 disabled:opacity-50"
                    >
                      {isMonitoring ? (
                        <div className="flex items-center justify-center gap-2">
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                          Auto-Monitoring
                        </div>
                      ) : (
                        "🔄 Check Now"
                      )}
                    </button>
                  </div>
                </>
              )}

              {step === "success" && (
                <>
                  <div className="text-center">
                    <div className="mb-4 text-6xl">🎉</div>
                    <h3 className="mb-2 text-2xl font-bold text-white">
                      Inscription Complete!
                    </h3>
                    <p className="text-gray-400">
                      Your meme proposal has been successfully inscribed on
                      Bitcoin
                    </p>
                  </div>

                  {orderStatus?.files?.[0]?.inscriptionId && (
                    <div className="rounded-xl bg-white/5 p-4">
                      <div className="mb-2 text-sm font-medium text-gray-300">
                        Inscription ID
                      </div>
                      <div className="rounded-lg bg-black/30 p-3 font-mono text-sm break-all text-white">
                        {orderStatus.files[0].inscriptionId}
                      </div>
                      <button
                        onClick={() =>
                          copyToClipboard(
                            orderStatus.files[0]?.inscriptionId || "",
                          )
                        }
                        className="mt-2 rounded-lg bg-white/10 px-3 py-1 text-xs font-medium text-white transition-all hover:bg-white/20"
                      >
                        Copy Inscription ID
                      </button>
                    </div>
                  )}

                  <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4">
                    <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-green-400">
                      <span>✅</span>
                      Success!
                    </h3>
                    <ul className="space-y-1 text-xs text-green-300/80">
                      <li>• Your payment has been confirmed on Bitcoin</li>
                      <li>
                        • The inscription has been created and assigned to your
                        address
                      </li>
                      <li>• You now own a permanent Bitcoin inscription</li>
                      <li>• Your meme is part of Bitcoin history forever!</li>
                    </ul>
                  </div>

                  <button
                    onClick={handleClose}
                    className="w-full rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-3 font-semibold text-white transition-all hover:from-purple-600 hover:to-pink-600"
                  >
                    🚀 Awesome!
                  </button>
                </>
              )}
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// Export utility functions for use in other components
export { getActiveOrdersFromStorage, removeOrderFromStorage };
