import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getInscriptionEngineInstance } from "~/server/jobs/inscription-engine";
import { getUnisatMonitorInstance } from "~/server/jobs/unisat-monitor";
import { esploraService } from "~/server/btc/esplora";
import { db } from "~/server/db";
import { proposals, inscriptions } from "~/server/db/schema";
import { sql } from "drizzle-orm";
import { env } from "~/env";
import type { ApiResponse } from "~/types";

interface SystemStatus {
  timestamp: string;
  inscriptionEngine: {
    isRunning: boolean;
    currentBlock: number;
    lastProcessedBlock: number;
    lastProcessedHash?: string;
    lastChecked?: string;
    blocksBehind: number;
    competition: {
      totalActive: number;
      currentLeaders: number;
      currentlyInscribing: number;
      totalExpired: number;
      totalInscribed: number;
      topProposal: {
        ticker: string;
        votes: number;
        status: string;
        blocksAsLeader: number;
      } | null;
    };
    error?: string;
  };
  unisatMonitor: {
    isRunning: boolean;
    lastChecked: string;
  };
  database: {
    connected: boolean;
    totalProposals: number;
    activeProposals: number;
    totalInscriptions: number;
    pendingUnisatOrders: number;
  };
  bitcoin: {
    network: string;
    esploraConnected: boolean;
    currentBlockHeight?: number;
  };
}

const inscriptionEngine = getInscriptionEngineInstance();
const unisatMonitor = getUnisatMonitorInstance();

export async function GET(): Promise<NextResponse<ApiResponse<SystemStatus>>> {
  try {
    const engineStatus = await inscriptionEngine.getStatus();
    const unisatStatus = unisatMonitor.getStatus();
    let dbConnected = true;
    let totalProposals = 0;
    let activeProposals = 0;
    let totalInscriptions = 0;
    let pendingUnisatOrders = 0;

    try {
      const [proposalStats, inscriptionStats, pendingOrders] =
        await Promise.all([
          db
            .select({
              total: sql<number>`count(*)`,
              active: sql<number>`count(*) filter (where status = 'active')`,
            })
            .from(proposals),
          db.select({ count: sql<number>`count(*)` }).from(inscriptions),
          db
            .select({ count: sql<number>`count(*)` })
            .from(inscriptions)
            .where(sql`order_status = 'pending'`),
        ]);

      totalProposals = proposalStats[0]?.total ?? 0;
      activeProposals = proposalStats[0]?.active ?? 0;
      totalInscriptions = inscriptionStats[0]?.count ?? 0;
      pendingUnisatOrders = pendingOrders[0]?.count ?? 0;
    } catch (error) {
      console.error("Database connection test failed:", error);
      dbConnected = false;
    }

    let esploraConnected = true;
    let currentBlockHeight: number | undefined;

    try {
      currentBlockHeight = await esploraService.getCurrentBlockHeight();
    } catch (error) {
      console.error("Esplora connection test failed:", error);
      esploraConnected = false;
    }

    const status: SystemStatus = {
      timestamp: new Date().toISOString(),
      inscriptionEngine: engineStatus as SystemStatus["inscriptionEngine"],
      unisatMonitor: unisatStatus,
      database: {
        connected: dbConnected,
        totalProposals,
        activeProposals,
        totalInscriptions,
        pendingUnisatOrders,
      },
      bitcoin: {
        network: env.BITCOIN_NETWORK,
        esploraConnected,
        currentBlockHeight,
      },
    };

    return NextResponse.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error("Error getting system status:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get system status" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<string>>> {
  try {
    const cronSecret = env.CRON_SECRET;
    const authHeader = request.headers.get("authorization");
    if (cronSecret && (!authHeader || authHeader !== `Bearer ${cronSecret}`)) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    await inscriptionEngine.triggerManually();

    return NextResponse.json({
      success: true,
      data: "Inscription engine triggered manually",
      message: "Inscription engine has been triggered to process new blocks",
    });
  } catch (error) {
    console.error("Error triggering inscription engine:", error);
    return NextResponse.json(
      { success: false, error: "Failed to trigger inscription engine" },
      { status: 500 },
    );
  }
}
