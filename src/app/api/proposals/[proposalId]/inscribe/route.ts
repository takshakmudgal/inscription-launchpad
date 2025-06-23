import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { proposals } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import type { ApiResponse } from "~/types";

// PATCH /api/proposals/[proposalId]/inscribe - Mark proposal as inscribed
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ proposalId: string }> },
): Promise<NextResponse<ApiResponse<{ success: boolean }>>> {
  try {
    const { proposalId } = await context.params;
    const proposalIdNum = parseInt(proposalId);

    if (isNaN(proposalIdNum)) {
      return NextResponse.json(
        { success: false, error: "Invalid proposal ID" },
        { status: 400 },
      );
    }

    // Update proposal status to inscribed
    await db
      .update(proposals)
      .set({
        status: "inscribed",
        updatedAt: new Date(),
      })
      .where(eq(proposals.id, proposalIdNum));

    return NextResponse.json({
      success: true,
      data: { success: true },
    });
  } catch (error) {
    console.error("Error updating proposal status:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to update proposal status",
      },
      { status: 500 },
    );
  }
}
