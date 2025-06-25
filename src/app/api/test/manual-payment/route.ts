import { NextRequest, NextResponse } from "next/server";
import { bitcoinWallet } from "~/server/services/bitcoin-wallet";
import { unisatService } from "~/server/services/unisat";
import { db } from "~/server/db";
import { inscriptions, proposals } from "~/server/db/schema";
import { eq, sql } from "drizzle-orm";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { orderId, forceComplete, inscriptionId, txid } = body;

  if (!orderId) {
    return NextResponse.json({ error: "orderId is required" }, { status: 400 });
  }

  try {
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

    if (forceComplete && inscriptionId && txid) {
      // Manual completion with provided inscription ID and txid
      await db
        .update(inscriptions)
        .set({
          inscriptionId: inscriptionId,
          txid: txid,
          orderStatus: "manually_completed",
        })
        .where(eq(inscriptions.id, inscriptionRecord.id));

      // Update proposal to inscribed
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
      // Force complete without inscription ID (payment issue resolution)
      await db
        .update(inscriptions)
        .set({
          orderStatus: "force_completed_no_inscription",
        })
        .where(eq(inscriptions.id, inscriptionRecord.id));

      // Reset proposal to active for retry
      await db
        .update(proposals)
        .set({ status: "active" })
        .where(eq(proposals.id, inscriptionRecord.proposalId));

      return NextResponse.json({
        success: true,
        message: "Inscription marked as failed, proposal reset to active",
      });
    }

    // Just return current status
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

export async function GET(request: NextRequest) {
  try {
    // Get wallet status for manual payments
    const balance = await bitcoinWallet.getBalance();
    const address = await bitcoinWallet.getAddress();
    const utxos = await bitcoinWallet.getUTXOs();

    return NextResponse.json({
      success: true,
      data: {
        walletAddress: address,
        balance,
        utxosCount: utxos.length,
        canPay: utxos.length > 0 && balance > 10000, // At least 10k sats
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
