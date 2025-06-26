import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { unisatService } from "~/server/services/unisat";
import type { ApiResponse } from "~/types";

interface OrderStatusData {
  orderId: string;
  status: string;
  files: Array<{
    filename: string;
    inscriptionId?: string;
    txid?: string;
  }>;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> },
): Promise<NextResponse<ApiResponse<OrderStatusData>>> {
  const { orderId } = await context.params;

  if (!orderId) {
    return NextResponse.json(
      { success: false, error: "Order ID is required" },
      { status: 400 },
    );
  }

  try {
    const orderStatus = await unisatService.getOrderStatus(orderId);

    return NextResponse.json({
      success: true,
      data: orderStatus,
    });
  } catch (error) {
    console.error("Error checking UniSat order status:", error);
    return NextResponse.json(
      { success: false, error: "Failed to check order status" },
      { status: 500 },
    );
  }
}
