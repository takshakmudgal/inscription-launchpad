import { NextRequest, NextResponse } from "next/server";
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
    // Check UniSat order status
    const orderStatus = await unisatService.getOrderStatus(orderId);

    // Also get database records
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
    // Force update order status
    const orderStatus = await unisatService.getOrderStatus(orderId);

    // Get inscription record
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

    // Update inscription record
    const updateData: any = {
      orderStatus: orderStatus.status,
    };

    // Check if inscription is actually complete despite status
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

    // If completed or has inscription ID (even with problematic status), update with transaction details
    if (
      orderStatus.status === "sent" ||
      orderStatus.status === "minted" ||
      hasInscriptionId ||
      forceComplete
    ) {
      if (file?.txid) {
        updateData.txid = file.txid;
      }
      if (file?.inscriptionId) {
        updateData.inscriptionId = file.inscriptionId;
        updateData.inscriptionUrl = `https://ordinals.com/inscription/${file.inscriptionId}`;
      }

      // Update proposal status to inscribed
      await db
        .update(proposals)
        .set({
          status: "inscribed",
          updatedAt: new Date(),
        })
        .where(eq(proposals.id, inscriptionRecord.proposalId));

      console.log(
        `✅ Proposal ${inscriptionRecord.proposalId} marked as inscribed`,
      );
    }

    // Special handling for payment_withinscription that might be complete
    else if (orderStatus.status === "payment_withinscription") {
      console.log(
        `⚠️ Order has payment_withinscription status - checking for completion indicators`,
      );

      // If we found inscription details, mark as complete
      if (hasInscriptionId) {
        console.log(
          `🎯 Found inscription ID despite problematic status - marking as complete`,
        );
        if (file?.inscriptionId) {
          updateData.inscriptionId = file.inscriptionId;
          updateData.inscriptionUrl = `https://ordinals.com/inscription/${file.inscriptionId}`;
        }
        if (file?.txid) {
          updateData.txid = file.txid;
        }

        // Update proposal status to inscribed
        await db
          .update(proposals)
          .set({
            status: "inscribed",
            updatedAt: new Date(),
          })
          .where(eq(proposals.id, inscriptionRecord.proposalId));

        console.log(
          `✅ Proposal ${inscriptionRecord.proposalId} marked as inscribed (despite payment_withinscription)`,
        );
      }
    }

    // Update the inscription record
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
