import { type NextRequest, NextResponse } from "next/server";
import { db } from "~/server/db";
import { inscriptions, proposals } from "~/server/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { orderId, inscriptionId, txid } = body;

  if (!orderId || !inscriptionId || !txid) {
    return NextResponse.json(
      { error: "orderId, inscriptionId, and txid are required" },
      { status: 400 },
    );
  }

  try {
    const inscription = await db
      .select()
      .from(inscriptions)
      .where(eq(inscriptions.unisatOrderId, orderId))
      .limit(1);

    if (inscription.length === 0) {
      return NextResponse.json(
        { error: "Inscription not found" },
        { status: 404 },
      );
    }

    const inscriptionRecord = inscription[0]!;
    await db
      .update(inscriptions)
      .set({
        inscriptionId: inscriptionId,
        txid: txid,
        inscriptionUrl: `https://ordinals.com/inscription/${inscriptionId}`,
        orderStatus: "manually_completed",
      })
      .where(eq(inscriptions.id, inscriptionRecord.id));

    await db
      .update(proposals)
      .set({
        status: "inscribed",
        updatedAt: new Date(),
      })
      .where(eq(proposals.id, inscriptionRecord.proposalId));

    console.log(
      `✅ Manually completed inscription ${inscriptionId} for proposal ${inscriptionRecord.proposalId}`,
    );

    return NextResponse.json({
      success: true,
      message: "Inscription manually completed",
      orderId,
      inscriptionId,
      txid,
      proposalId: inscriptionRecord.proposalId,
    });
  } catch (error) {
    console.error("Error manually completing inscription:", error);
    return NextResponse.json(
      { error: "Failed to manually complete inscription" },
      { status: 500 },
    );
  }
}
