import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { proposals } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import type { ApiResponse } from "~/types";

/**
 * WARNING: This endpoint directly marks a proposal as "inscribed" without validation.
 * It should ONLY be used when an inscription has been CONFIRMED on the Bitcoin blockchain.
 * Using this endpoint prematurely will cause proposals to appear in the "Launched Champions"
 * section before they are actually inscribed, leading to inconsistent platform behavior.
 *
 * Consider adding authentication and proper validation before production use.
 */
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
