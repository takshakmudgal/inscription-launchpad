import { NextResponse } from "next/server";
import { mempoolService } from "~/server/btc/mempool";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const upcomingBlocks = await mempoolService.getMempoolBlocks();
    return NextResponse.json({
      success: true,
      data: { blocks: upcomingBlocks },
    });
  } catch (error) {
    console.error("Error in /api/blocks/upcoming:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 },
    );
  }
}
