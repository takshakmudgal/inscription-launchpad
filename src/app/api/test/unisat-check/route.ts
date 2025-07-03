import { type NextRequest, NextResponse } from "next/server";
import { unisatService } from "~/server/services/unisat";
import { db } from "~/server/db";
import { inscriptions, proposals } from "~/server/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("orderId");

  if (!orderId) {
    return NextResponse.json(
      { error: "orderId parameter is required" },
      { status: 400 },
    );
  }

  try {
    const orderStatus = await unisatService.getOrderStatus(orderId);
    const inscription = await db
      .select()
      .from(inscriptions)
      .where(eq(inscriptions.unisatOrderId, orderId))
      .limit(1);

    let proposal = null;
    if (inscription.length > 0) {
      const proposalRecord = await db
        .select()
        .from(proposals)
        .where(eq(proposals.id, inscription[0]!.proposalId))
        .limit(1);

      if (proposalRecord.length > 0) {
        proposal = proposalRecord[0];
      }
    }

    return NextResponse.json({
      orderId,
      unisatStatus: orderStatus,
      databaseInscription: inscription[0] || null,
      databaseProposal: proposal,
      needsUpdate:
        orderStatus.status === "sent" || orderStatus.status === "minted",
    });
  } catch (error) {
    console.error("Error checking UniSat order:", error);
    return NextResponse.json(
      { error: "Failed to check order status", details: String(error) },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { orderId, forceComplete } = body;

  if (!orderId) {
    return NextResponse.json({ error: "orderId is required" }, { status: 400 });
  }

  try {
    const orderStatus = await unisatService.getOrderStatus(orderId);
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
    const updateData: any = {
      orderStatus: orderStatus.status,
    };

    const file = orderStatus.files[0];
    const hasInscriptionId = file?.inscriptionId;
    const hasTxid = file?.txid;

    console.log(`Order ${orderId} details:`, {
      status: orderStatus.status,
      hasInscriptionId,
      inscriptionId: file?.inscriptionId,
      hasTxid,
      txid: file?.txid,
      forceComplete,
    });

    if (
      orderStatus.status === "confirmed" ||
      (orderStatus.status === "sent" && hasInscriptionId && hasTxid) ||
      forceComplete
    ) {
      if (file?.txid) {
        updateData.txid = file.txid;
      }
      if (file?.inscriptionId) {
        updateData.inscriptionId = file.inscriptionId;
        updateData.inscriptionUrl = `https://ordinals.com/inscription/${file.inscriptionId}`;
      }

      await db
        .update(proposals)
        .set({
          status: "inscribed",
          updatedAt: new Date(),
        })
        .where(eq(proposals.id, inscriptionRecord.proposalId));

      console.log(
        `✅ Proposal ${inscriptionRecord.proposalId} marked as inscribed (status: ${orderStatus.status})`,
      );
    } else if (orderStatus.status === "minted" && hasInscriptionId && hasTxid) {
      // For minted status, keep as inscribing unless we have all data
      if (file?.txid) {
        updateData.txid = file.txid;
      }
      if (file?.inscriptionId) {
        updateData.inscriptionId = file.inscriptionId;
        updateData.inscriptionUrl = `https://ordinals.com/inscription/${file.inscriptionId}`;
      }

      await db
        .update(proposals)
        .set({
          status: "inscribing",
          updatedAt: new Date(),
        })
        .where(eq(proposals.id, inscriptionRecord.proposalId));

      console.log(
        `⏳ Proposal ${inscriptionRecord.proposalId} kept as inscribing (minted but not confirmed)`,
      );
    }

    await db
      .update(inscriptions)
      .set(updateData)
      .where(eq(inscriptions.id, inscriptionRecord.id));

    return NextResponse.json({
      success: true,
      orderId,
      oldStatus: inscriptionRecord.orderStatus,
      newStatus: orderStatus.status,
      updated: updateData,
      inscriptionFound: hasInscriptionId,
      inscriptionId: file?.inscriptionId,
      txid: file?.txid,
      proposalUpdated: updateData.inscriptionId ? true : false,
    });
  } catch (error) {
    console.error("Error in unisat-check:", error);
    return NextResponse.json(
      { error: "Failed to check/update order", details: String(error) },
      { status: 500 },
    );
  }
}
