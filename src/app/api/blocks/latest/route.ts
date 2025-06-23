import { NextResponse } from "next/server";
import { esploraService } from "~/server/btc/esplora";
import type { ApiResponse, BlockInfo } from "~/types";

// GET /api/blocks/latest - Get latest Bitcoin block information
export async function GET(): Promise<NextResponse<ApiResponse<BlockInfo>>> {
  try {
    const latestBlock = await esploraService.getLatestBlock();

    return NextResponse.json({
      success: true,
      data: latestBlock,
    });
  } catch (error) {
    console.error("Error fetching latest block:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch latest block" },
      { status: 500 },
    );
  }
}
