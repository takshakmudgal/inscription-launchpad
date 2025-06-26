"use client";

import { useState, useEffect, useCallback, type ChangeEvent } from "react";

interface OrderData {
  orderId: string;
  payAddress: string;
  amount: number;
  status: string;
  inscriptionId: number;
  proposalId: string;
  receiveAddress: string;
  createdAt: string;
}

interface OrderStatus {
  orderId: string;
  status: string;
  payAddress: string;
  receiveAddress: string;
  amount: number;
  paidAmount: number;
  outputValue: number;
  feeRate: number;
  minerFee: number;
  serviceFee: number;
  devFee: number;
  files: Array<{
    filename: string;
    inscriptionId?: string;
    status: string;
    txid?: string;
  }>;
  count: number;
  pendingCount: number;
  unconfirmedCount: number;
  confirmedCount: number;
  createTime: number;
  refundTxid: string;
  refundAmount: number;
  refundFeeRate: number;
}

interface InscriptionOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  proposal: {
    id: string;
    name: string;
    ticker: string;
    description: string;
    imageUrl: string;
    votes: number;
    creator: string;
    createdAt: Date;
    isWinner?: boolean;
    isInscribed?: boolean;
  };
  existingOrderId: string | null;
  onOrderCreated: (orderId: string) => void;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

const STORAGE_KEY = "inscription_orders";

export function InscriptionOrderModal({
  isOpen,
  onClose,
  proposal,
  existingOrderId: _existingOrderId,
  onOrderCreated,
}: InscriptionOrderModalProps) {
  const [receiveAddress, setReceiveAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [orderStatus, setOrderStatus] = useState<OrderStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [existingOrder, setExistingOrder] = useState<OrderData | null>(null);

  const removeOrderFromStorage = (proposalId: string) => {
    try {
      const savedOrders = localStorage.getItem(STORAGE_KEY);
      if (savedOrders) {
        const orders: OrderData[] = JSON.parse(savedOrders) as OrderData[];
        const filteredOrders = orders.filter(
          (o) => o.proposalId !== proposalId,
        );
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredOrders));
      }
    } catch (error) {
      console.error("Error removing order from storage:", error);
    }
  };

  const checkOrderStatus = useCallback(
    async (orderId?: string) => {
      const targetOrderId = orderId ?? orderData?.orderId;
      if (!targetOrderId) return;

      setCheckingStatus(true);
      try {
        const response = await fetch(`/api/unisat/order/${targetOrderId}`);
        const result = (await response.json()) as ApiResponse<OrderStatus>;

        if (result.success && result.data) {
          setOrderStatus(result.data);
          if (result.data.status === "minted" && proposal && onOrderCreated) {
            try {
              await fetch(`/api/proposals/${proposal.id}/inscribe`, {
                method: "PATCH",
              });
              removeOrderFromStorage(proposal.id);
            } catch (error) {
              console.error("Error updating proposal status:", error);
            }
            onOrderCreated(result.data.orderId);
          }
        } else {
          console.error("Error checking order status:", result.error);
        }
      } catch (err) {
        console.error("Network error checking status:", err);
      } finally {
        setCheckingStatus(false);
      }
    },
    [orderData?.orderId, onOrderCreated, proposal],
  );

  useEffect(() => {
    if (!isOpen || !proposal) return;

    const savedOrders = localStorage.getItem(STORAGE_KEY);
    if (savedOrders) {
      try {
        const orders: OrderData[] = JSON.parse(savedOrders) as OrderData[];
        const existing = orders.find(
          (order) => order.proposalId === proposal.id,
        );
        if (existing) {
          setExistingOrder(existing);
          setOrderData(existing);
          setReceiveAddress(existing.receiveAddress);
          void checkOrderStatus(existing.orderId);
        }
      } catch (error) {
        console.error("Error loading saved orders:", error);
      }
    }
  }, [isOpen, proposal, checkOrderStatus]);

  const saveOrderToStorage = (order: OrderData) => {
    try {
      const savedOrders = localStorage.getItem(STORAGE_KEY);
      const orders: OrderData[] = savedOrders
        ? (JSON.parse(savedOrders) as OrderData[])
        : [];

      const filteredOrders = orders.filter(
        (o) => o.proposalId !== order.proposalId,
      );

      filteredOrders.push(order);

      localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredOrders));
    } catch (error) {
      console.error("Error saving order to storage:", error);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      if (!existingOrder) {
        setReceiveAddress("");
        setOrderData(null);
        setOrderStatus(null);
      }
      setError(null);
      setLoading(false);
      setCheckingStatus(false);
      setExistingOrder(null);
    }
  }, [isOpen, existingOrder]);

  useEffect(() => {
    if (!orderData?.orderId) return;

    const interval = setInterval(() => {
      void checkOrderStatus();
    }, 10000);

    return () => clearInterval(interval);
  }, [orderData?.orderId, checkOrderStatus]);

  const createOrder = async () => {
    if (!proposal || !receiveAddress) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/unisat/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          proposalId: proposal.id,
          receiveAddress,
        }),
      });

      const result = (await response.json()) as ApiResponse<OrderData>;

      if (result.success && result.data) {
        const orderWithDetails = {
          ...result.data,
          proposalId: proposal.id,
          receiveAddress,
          createdAt: new Date().toISOString(),
        };

        setOrderData(orderWithDetails);
        saveOrderToStorage(orderWithDetails);
        await checkOrderStatus(result.data.orderId);
      } else {
        setError(result.error ?? "Failed to create order");
      }
    } catch (err) {
      setError("Network error occurred");
      console.error("Error creating order:", err);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    void navigator.clipboard.writeText(text);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "text-yellow-600";
      case "payment_success":
      case "ready":
      case "inscribing":
        return "text-blue-600";
      case "minted":
      case "confirmed":
        return "text-green-600";
      case "canceled":
      case "refunded":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "pending":
        return "Awaiting Payment";
      case "payment_notenough":
        return "Insufficient Payment";
      case "payment_overpay":
        return "Overpaid - Choose Continue or Refund";
      case "payment_withinscription":
        return "Payment Contains Inscription - Refund Required";
      case "payment_waitconfirmed":
        return "Waiting for Payment Confirmation";
      case "payment_success":
        return "Payment Received";
      case "ready":
        return "Ready to Inscribe";
      case "inscribing":
        return "Inscribing...";
      case "minted":
        return "Inscription Complete";
      case "closed":
        return "Order Closed";
      case "refunded":
        return "Refunded";
      case "cancel":
        return "Canceled";
      default:
        return status;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="p-8">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Inscription Order
              </h2>
              <p className="mt-1 text-gray-500">
                {existingOrder
                  ? "Manage existing order"
                  : "Create new inscription order"}
              </p>
            </div>
          </div>

          <div className="mb-6 rounded-xl bg-gradient-to-r from-purple-50 to-blue-50 p-6">
            <h3 className="text-xl font-semibold text-gray-900">
              {proposal?.name} ({proposal?.ticker})
            </h3>
            <p className="mt-2 text-gray-600">{proposal?.description}</p>
          </div>

          {existingOrder && (
            <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <div className="text-xl text-amber-600">⚠️</div>
                <div>
                  <h4 className="font-semibold text-amber-800">
                    Existing Order Found
                  </h4>
                  <p className="mt-1 text-sm text-amber-700">
                    You already have an order for this proposal. Complete the
                    payment or check the status below.
                  </p>
                </div>
              </div>
            </div>
          )}

          {!orderData ? (
            <div className="space-y-6">
              <div className="space-y-3">
                <label
                  htmlFor="receiveAddress"
                  className="block text-sm font-semibold text-gray-700"
                >
                  Bitcoin Address to Receive Inscription
                </label>
                <input
                  id="receiveAddress"
                  type="text"
                  value={receiveAddress}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setReceiveAddress(e.target.value)
                  }
                  placeholder="Enter your Bitcoin address (tb1... for testnet)"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 font-mono text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <p className="text-xs text-gray-500">
                  This is where your inscription will be sent once completed
                </p>
              </div>

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                  <div className="flex items-start gap-3">
                    <div className="text-xl text-red-600">❌</div>
                    <div>
                      <h4 className="font-semibold text-red-800">Error</h4>
                      <p className="mt-1 text-sm text-red-700">{error}</p>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={() => void createOrder()}
                disabled={loading || !receiveAddress.trim()}
                className="w-full transform rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 font-semibold text-white transition-all hover:scale-[1.02] hover:from-blue-700 hover:to-purple-700 disabled:cursor-not-allowed disabled:from-gray-400 disabled:to-gray-400 disabled:hover:scale-100"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></div>
                    Creating Order...
                  </span>
                ) : (
                  "🎯 Create Inscription Order"
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="rounded-xl border border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 p-6">
                <div className="flex items-start gap-3">
                  <div className="text-2xl text-green-600">✅</div>
                  <div>
                    <h3 className="text-lg font-bold text-green-900">
                      Order Created Successfully!
                    </h3>
                    <p className="mt-1 text-green-700">
                      Order ID:{" "}
                      <span className="rounded bg-green-100 px-2 py-1 font-mono">
                        {orderData.orderId}
                      </span>
                    </p>
                    <p className="mt-2 text-sm text-green-600">
                      Created {new Date(orderData.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
              {orderStatus && (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h4 className="text-lg font-bold text-gray-900">
                      Order Status
                    </h4>
                    <button
                      onClick={() => void checkOrderStatus()}
                      disabled={checkingStatus}
                      className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium transition-colors hover:bg-gray-50 disabled:bg-gray-100"
                    >
                      <div
                        className={`h-4 w-4 ${checkingStatus ? "animate-spin" : ""}`}
                      >
                        🔄
                      </div>
                      {checkingStatus ? "Checking..." : "Refresh"}
                    </button>
                  </div>

                  <div
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold ${getStatusColor(orderStatus.status)} bg-current/10`}
                  >
                    <div className="h-2 w-2 rounded-full bg-current"></div>
                    {getStatusText(orderStatus.status)}
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Payment Progress:</span>
                      <div className="font-semibold">
                        {orderStatus.paidAmount} / {orderStatus.amount} sats
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-500">Files:</span>
                      <div className="font-semibold">
                        {orderStatus.confirmedCount} confirmed,{" "}
                        {orderStatus.pendingCount} pending
                      </div>
                    </div>
                  </div>

                  {orderStatus.files[0]?.inscriptionId && (
                    <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3">
                      <div className="font-semibold text-green-800">
                        🎉 Inscription Complete!
                      </div>
                      <a
                        href={`https://ordinals.com/inscription/${orderStatus.files[0].inscriptionId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 flex items-center gap-1 font-mono text-sm text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {orderStatus.files[0].inscriptionId}
                        <span className="text-xs">🔗</span>
                      </a>
                    </div>
                  )}
                </div>
              )}
              <div className="rounded-xl border border-gray-200 p-6">
                <h4 className="mb-4 text-lg font-bold text-gray-900">
                  💰 Payment Instructions
                </h4>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-gray-700">
                        Amount to Send
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          value={`${orderData.amount} sats`}
                          readOnly
                          className="flex-1 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 font-mono text-sm"
                        />
                        <button
                          onClick={() =>
                            copyToClipboard(orderData.amount.toString())
                          }
                          className="rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors hover:bg-gray-50"
                        >
                          📋
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-gray-700">
                        Network Fee Rate
                      </label>
                      <div className="rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm">
                        15 sat/vB (Testnet)
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-gray-700">
                      Payment Address
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        value={orderData.payAddress}
                        readOnly
                        className="flex-1 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 font-mono text-sm"
                      />
                      <button
                        onClick={() => copyToClipboard(orderData.payAddress)}
                        className="rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors hover:bg-gray-50"
                      >
                        📋
                      </button>
                    </div>
                  </div>

                  <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
                    <div className="flex items-start gap-3">
                      <div className="text-xl text-yellow-600">⚠️</div>
                      <div>
                        <h5 className="font-semibold text-yellow-800">
                          Manual Payment Required
                        </h5>
                        <p className="mt-1 text-sm text-yellow-700">
                          Send exactly{" "}
                          <strong>{orderData.amount} satoshis</strong> to the
                          address above. The inscription will begin once payment
                          is confirmed on the Bitcoin network.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 rounded-xl bg-gray-100 px-6 py-3 font-semibold text-gray-700 transition-colors hover:bg-gray-200"
                >
                  Close
                </button>
                <button
                  onClick={() => void checkOrderStatus()}
                  disabled={checkingStatus}
                  className="flex-1 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-3 font-semibold text-white transition-all hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-400"
                >
                  {checkingStatus ? "Checking..." : "Check Payment Status"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
