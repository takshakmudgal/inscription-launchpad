import { type NextRequest, NextResponse } from "next/server";
import { bitcoinWallet } from "~/server/services/bitcoin-wallet";
import { db } from "~/server/db";
import { inscriptions, proposals } from "~/server/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { orderId, forceComplete, inscriptionId, txid } = body;

  if (!orderId) {
    return NextResponse.json({ error: "orderId is required" }, { status: 400 });
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

    if (forceComplete && inscriptionId && txid) {
      await db
        .update(inscriptions)
        .set({
          inscriptionId: inscriptionId,
          txid: txid,
          orderStatus: "manually_completed",
        })
        .where(eq(inscriptions.id, inscriptionRecord.id));

      await db
        .update(proposals)
        .set({ status: "inscribed" })
        .where(eq(proposals.id, inscriptionRecord.proposalId));

      return NextResponse.json({
        success: true,
        message: "Inscription manually marked as completed",
        inscriptionId,
        txid,
      });
    }

    if (forceComplete) {
      await db
        .update(inscriptions)
        .set({
          orderStatus: "force_completed_no_inscription",
        })
        .where(eq(inscriptions.id, inscriptionRecord.id));

      await db
        .update(proposals)
        .set({ status: "active" })
        .where(eq(proposals.id, inscriptionRecord.proposalId));

      return NextResponse.json({
        success: true,
        message: "Inscription marked as failed, proposal reset to active",
      });
    }

    return NextResponse.json({
      success: true,
      inscription: inscriptionRecord,
      message: "Current inscription status",
    });
  } catch (error) {
    console.error("Error in manual payment handler:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    const balance = await bitcoinWallet.getBalance();
    const address = await bitcoinWallet.getAddress();
    const utxos = await bitcoinWallet.getUTXOs();

    return NextResponse.json({
      success: true,
      data: {
        walletAddress: address,
        balance,
        utxosCount: utxos.length,
        canPay: utxos.length > 0 && balance > 10000,
      },
    });
  } catch (error) {
    console.error("Error getting wallet status:", error);
    return NextResponse.json(
      { error: "Failed to get wallet status", details: String(error) },
      { status: 500 },
    );
  }
}
