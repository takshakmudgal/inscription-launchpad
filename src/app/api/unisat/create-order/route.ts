import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { proposals } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import type { ApiResponse } from "~/types";

interface CreateOrderRequest {
  proposalId: number;
  receiveAddress: string;
  blockHeight?: number;
}

interface CreateOrderResponse {
  orderId: string;
  payAddress: string;
  amount: number;
  status: string;
  inscriptionId: number;
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<CreateOrderResponse>>> {
  try {
    const body = (await request.json()) as CreateOrderRequest;
    const { proposalId, receiveAddress } = body;

    if (!proposalId || !receiveAddress) {
      return NextResponse.json(
        {
          success: false,
          error: "Proposal ID and receive address are required",
        },
        { status: 400 },
      );
    }

    const proposal = await db
      .select()
      .from(proposals)
      .where(eq(proposals.id, proposalId))
      .limit(1);

    if (proposal.length === 0) {
      return NextResponse.json(
        { success: false, error: "Proposal not found" },
        { status: 404 },
      );
    }

    const proposalData = proposal[0];

    if (proposalData?.status !== "active") {
      return NextResponse.json(
        { success: false, error: "Proposal is not active" },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error:
          "Manual inscription is disabled. Proposals are now automatically inscribed based on voting leaderboard.",
      },
      { status: 403 },
    );
  } catch (error) {
    console.error("Error creating UniSat order:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create order",
      },
      { status: 500 },
    );
  }
}
