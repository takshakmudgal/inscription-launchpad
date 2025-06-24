import { useEffect, useCallback } from "react";
import {
  getActiveOrdersFromStorage,
  removeOrderFromStorage,
} from "~/components/InscriptionModal";

interface OrderMonitorOptions {
  enabled?: boolean;
  interval?: number; // in milliseconds
  onOrderComplete?: (orderId: string, status: string) => void;
  onOrderFailed?: (orderId: string, status: string) => void;
}

export function useBackgroundOrderMonitor({
  enabled = true,
  interval = 60000, // 1 minute default
  onOrderComplete,
  onOrderFailed,
}: OrderMonitorOptions = {}) {
  const updateProposalStatus = useCallback(async (orderId: string) => {
    try {
      // Find the proposal associated with this order and update its status
      const response = await fetch("/api/proposals", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId,
          action: "mark_inscribed",
        }),
      });

      if (response.ok) {
        console.log(`✅ Proposal status updated for order ${orderId}`);
      } else {
        console.error(`Failed to update proposal status for order ${orderId}`);
      }
    } catch (error) {
      console.error(
        `Error updating proposal status for order ${orderId}:`,
        error,
      );
    }
  }, []);

  const checkOrderStatus = useCallback(
    async (orderId: string) => {
      try {
        const response = await fetch(`/api/unisat/order/${orderId}`);
        const data = await response.json();

        if (response.ok && data.success) {
          const status = data.data.status;

          // Check if order is complete
          if (status === "minted" || status === "sent") {
            removeOrderFromStorage(orderId);

            // Update the proposal status in the database
            await updateProposalStatus(orderId);

            onOrderComplete?.(orderId, status);
            console.log(
              `🎉 Background monitor: Inscription complete for order ${orderId}`,
            );
            return true;
          }

          // Check if order failed
          if (status === "canceled" || status === "refunded") {
            removeOrderFromStorage(orderId);
            onOrderFailed?.(orderId, status);
            console.log(`❌ Background monitor: Order ${orderId} ${status}`);
            return true;
          }

          // Order still pending
          console.log(
            `⏳ Background monitor: Order ${orderId} still ${status}`,
          );
          return false;
        } else {
          console.error(
            `Background monitor: Failed to check order ${orderId}:`,
            data.error,
          );
        }
      } catch (error) {
        console.error(
          `Background monitor: Error checking order ${orderId}:`,
          error,
        );
      }
      return false;
    },
    [onOrderComplete, onOrderFailed, updateProposalStatus],
  );

  const checkAllActiveOrders = useCallback(async () => {
    try {
      const activeOrders = getActiveOrdersFromStorage();
      const orderIds = Object.keys(activeOrders);

      if (orderIds.length === 0) {
        return;
      }

      console.log(
        `🔍 Background monitor: Checking ${orderIds.length} active orders`,
      );

      // Check all orders in parallel
      const results = await Promise.allSettled(
        orderIds.map((orderId) => checkOrderStatus(orderId)),
      );

      const completedCount = results.filter(
        (result) => result.status === "fulfilled" && result.value === true,
      ).length;

      if (completedCount > 0) {
        console.log(
          `✅ Background monitor: ${completedCount} orders completed`,
        );
      }
    } catch (error) {
      console.error("Background monitor: Error checking active orders:", error);
    }
  }, [checkOrderStatus]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    // Check immediately on mount
    checkAllActiveOrders();

    // Set up interval for regular checks
    const intervalId = setInterval(checkAllActiveOrders, interval);

    // Add visibility change listener to check when user returns to tab
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        checkAllActiveOrders();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Check on focus (when user returns to window)
    const handleFocus = () => {
      checkAllActiveOrders();
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [enabled, interval, checkAllActiveOrders]);

  return {
    checkOrderStatus,
    checkAllActiveOrders,
  };
}
