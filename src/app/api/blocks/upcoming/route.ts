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
    // Log the error but don't spam logs with expected network errors
    if (error instanceof Error && error.message.includes("ETIMEDOUT")) {
      console.warn("Mempool API timeout in /api/blocks/upcoming");
    } else {
      console.error("Error in /api/blocks/upcoming:", error);
    }

    // Return success with empty data instead of 500 error
    // This prevents frontend errors and reduces log spam
    return NextResponse.json({
      success: true,
      data: { blocks: [] },
      warning: "API temporarily unavailable",
    });
  }
}
