import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { inscriptions } from "~/server/db/schema";
import { eq, desc } from "drizzle-orm";
import type { ApiResponse } from "~/types";

interface InscriptionStatus {
  hasInscription: boolean;
  orderStatus?: string;
  orderId?: string;
  inscriptionId?: string;
  inscriptionUrl?: string;
  paymentAmount?: number;
  paymentAddress?: string;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ proposalId: string }> },
): Promise<NextResponse<ApiResponse<InscriptionStatus>>> {
  try {
    const { proposalId } = await context.params;
    const proposalIdNum = parseInt(proposalId);

    if (isNaN(proposalIdNum)) {
      return NextResponse.json(
        { success: false, error: "Invalid proposal ID" },
        { status: 400 },
      );
    }

    const inscriptionRecords = await db
      .select()
      .from(inscriptions)
      .where(eq(inscriptions.proposalId, proposalIdNum))
      .orderBy(desc(inscriptions.createdAt))
      .limit(1);

    if (inscriptionRecords.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          hasInscription: false,
        },
      });
    }

    const inscription = inscriptionRecords[0]!;

    return NextResponse.json({
      success: true,
      data: {
        hasInscription: true,
        orderStatus: inscription.orderStatus ?? undefined,
        orderId: inscription.unisatOrderId ?? undefined,
        inscriptionId: inscription.inscriptionId ?? undefined,
        inscriptionUrl: inscription.inscriptionUrl ?? undefined,
        paymentAmount: inscription.paymentAmount ?? undefined,
        paymentAddress: inscription.paymentAddress ?? undefined,
      },
    });
  } catch (error) {
    console.error("Error checking inscription status:", error);
    return NextResponse.json(
      { success: false, error: "Failed to check inscription status" },
      { status: 500 },
    );
  }
}
