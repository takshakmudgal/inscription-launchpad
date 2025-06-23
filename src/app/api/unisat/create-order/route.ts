import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { unisatService } from "~/server/services/unisat";
import { db } from "~/server/db";
import { proposals, inscriptions } from "~/server/db/schema";
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

// POST /api/unisat/create-order - Create a new inscription order
export async function POST(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<CreateOrderResponse>>> {
  try {
    const body = (await request.json()) as CreateOrderRequest;
    const { proposalId, receiveAddress, blockHeight } = body;

    if (!proposalId || !receiveAddress) {
      return NextResponse.json(
        {
          success: false,
          error: "Proposal ID and receive address are required",
        },
        { status: 400 },
      );
    }

    // Get the proposal
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

    // Check if proposal is active
    if (proposalData?.status !== "active") {
      return NextResponse.json(
        { success: false, error: "Proposal is not active" },
        { status: 400 },
      );
    }

    // Use current block height if not provided
    const currentBlockHeight = blockHeight ?? 850000; // Default for testnet

    // Transform proposal data to match expected type
    const proposalForInscription = {
      ...proposalData,
      website: proposalData.website ?? undefined,
      twitter: proposalData.twitter ?? undefined,
      telegram: proposalData.telegram ?? undefined,
      bannerUrl: proposalData.bannerUrl ?? undefined,
      submittedBy: proposalData.submittedBy ?? undefined,
      createdAt: proposalData.createdAt.toISOString(),
      updatedAt: proposalData.updatedAt.toISOString(),
    };

    // Create UniSat order
    const order = await unisatService.createInscriptionOrder(
      proposalForInscription,
      currentBlockHeight,
      receiveAddress,
    );

    // Store inscription record in database
    await db.insert(inscriptions).values({
      proposalId: proposalData.id,
      blockHeight: currentBlockHeight,
      blockHash: "pending", // Will be updated when order is completed
      txid: "pending", // Will be updated when order is completed
      inscriptionId: undefined,
      inscriptionUrl: undefined,
      feeRate: parseInt(process.env.INSCRIPTION_FEE_RATE ?? "15"),
      unisatOrderId: order.orderId,
      orderStatus: "pending",
      paymentAddress: order.payAddress,
      paymentAmount: order.amount,
      metadata: JSON.stringify(
        unisatService.generateInscriptionPayload(
          proposalForInscription,
          currentBlockHeight,
        ),
      ),
    });

    return NextResponse.json({
      success: true,
      data: {
        orderId: order.orderId,
        payAddress: order.payAddress,
        amount: order.amount,
        status: "pending",
        inscriptionId: proposalData.id, // Use proposal ID as reference
      },
    });
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
