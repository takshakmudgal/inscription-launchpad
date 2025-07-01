import { NextResponse } from "next/server";
import { esploraService } from "~/server/btc/esplora";
import type { ApiResponse, BlockInfo } from "~/types";

interface RecentBlocksResponse {
  blocks: BlockInfo[];
}

export async function GET(): Promise<
  NextResponse<ApiResponse<RecentBlocksResponse>>
> {
  try {
    const recentBlocks = await esploraService.getRecentBlocks(12);

    return NextResponse.json({
      success: true,
      data: { blocks: recentBlocks },
    });
  } catch (error) {
    console.error("Error fetching recent blocks:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch recent blocks" },
      { status: 500 },
    );
  }
}
