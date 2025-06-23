import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { inscriptions, proposals } from "~/server/db/schema";
import { eq, desc } from "drizzle-orm";
import type { ApiResponse } from "~/types";

interface OrderListItem {
  id: number;
  proposalId: number;
  proposalName: string;
  proposalTicker: string;
  blockHeight: number;
  blockHash: string;
  txid: string;
  inscriptionId: string | null;
  inscriptionUrl: string | null;
  unisatOrderId: string | null;
  orderStatus: string | null;
  paymentAddress: string | null;
  paymentAmount: number | null;
  createdAt: string;
}

// GET /api/unisat/orders - List all inscription orders
export async function GET(
  request: NextRequest,
): Promise<
  NextResponse<ApiResponse<{ orders: OrderListItem[]; total: number }>>
> {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") ?? "1");
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 100);
    const offset = (page - 1) * limit;
    const status = searchParams.get("status");

    // Build query based on whether we need filtering
    const results = status
      ? await db
          .select({
            id: inscriptions.id,
            proposalId: inscriptions.proposalId,
            proposalName: proposals.name,
            proposalTicker: proposals.ticker,
            blockHeight: inscriptions.blockHeight,
            blockHash: inscriptions.blockHash,
            txid: inscriptions.txid,
            inscriptionId: inscriptions.inscriptionId,
            inscriptionUrl: inscriptions.inscriptionUrl,
            unisatOrderId: inscriptions.unisatOrderId,
            orderStatus: inscriptions.orderStatus,
            paymentAddress: inscriptions.paymentAddress,
            paymentAmount: inscriptions.paymentAmount,
            createdAt: inscriptions.createdAt,
          })
          .from(inscriptions)
          .leftJoin(proposals, eq(inscriptions.proposalId, proposals.id))
          .where(eq(inscriptions.orderStatus, status))
          .orderBy(desc(inscriptions.createdAt))
          .limit(limit)
          .offset(offset)
      : await db
          .select({
            id: inscriptions.id,
            proposalId: inscriptions.proposalId,
            proposalName: proposals.name,
            proposalTicker: proposals.ticker,
            blockHeight: inscriptions.blockHeight,
            blockHash: inscriptions.blockHash,
            txid: inscriptions.txid,
            inscriptionId: inscriptions.inscriptionId,
            inscriptionUrl: inscriptions.inscriptionUrl,
            unisatOrderId: inscriptions.unisatOrderId,
            orderStatus: inscriptions.orderStatus,
            paymentAddress: inscriptions.paymentAddress,
            paymentAmount: inscriptions.paymentAmount,
            createdAt: inscriptions.createdAt,
          })
          .from(inscriptions)
          .leftJoin(proposals, eq(inscriptions.proposalId, proposals.id))
          .orderBy(desc(inscriptions.createdAt))
          .limit(limit)
          .offset(offset);

    // Transform the results
    const orders: OrderListItem[] = results.map((row) => ({
      id: row.id,
      proposalId: row.proposalId,
      proposalName: row.proposalName ?? "Unknown",
      proposalTicker: row.proposalTicker ?? "UNKNOWN",
      blockHeight: row.blockHeight,
      blockHash: row.blockHash,
      txid: row.txid,
      inscriptionId: row.inscriptionId,
      inscriptionUrl: row.inscriptionUrl,
      unisatOrderId: row.unisatOrderId,
      orderStatus: row.orderStatus,
      paymentAddress: row.paymentAddress,
      paymentAmount: row.paymentAmount,
      createdAt: row.createdAt.toISOString(),
    }));

    // Get total count for pagination
    const totalResult = await db
      .select({ count: inscriptions.id })
      .from(inscriptions);
    const total = totalResult.length;

    return NextResponse.json({
      success: true,
      data: {
        orders,
        total,
      },
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch orders",
      },
      { status: 500 },
    );
  }
}
