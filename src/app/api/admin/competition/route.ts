import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getInscriptionEngineInstance } from "~/server/jobs/inscription-engine";
import type { ApiResponse } from "~/types";

interface CompetitionAction {
  action: "eliminate" | "reset" | "trigger" | "status";
  proposalId?: number;
  reason?: string;
}

const inscriptionEngine = getInscriptionEngineInstance();

export async function POST(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<any>>> {
  try {
    const body = (await request.json()) as CompetitionAction;
    const { action, proposalId, reason } = body;

    console.log(`🔧 Admin competition action: ${action}`, {
      proposalId,
      reason,
    });

    switch (action) {
      case "eliminate":
        if (!proposalId) {
          return NextResponse.json(
            {
              success: false,
              error: "Proposal ID is required for elimination",
            },
            { status: 400 },
          );
        }

        const eliminationResult = await inscriptionEngine.forceExpireProposal(
          proposalId,
          reason || "Manual admin elimination",
        );

        return NextResponse.json({
          success: true,
          data: eliminationResult,
          message: `Proposal ${proposalId} eliminated successfully`,
        });

      case "reset":
        const resetResult = await inscriptionEngine.resetCompetition(
          reason || "Manual admin reset",
        );

        return NextResponse.json({
          success: true,
          data: resetResult,
          message: "Competition reset successfully",
        });

      case "trigger":
        await inscriptionEngine.triggerManually();

        return NextResponse.json({
          success: true,
          data: { triggered: true },
          message: "Inscription engine triggered manually",
        });

      case "status":
        const status = await inscriptionEngine.getStatus();

        return NextResponse.json({
          success: true,
          data: status,
          message: "Current competition status retrieved",
        });

      default:
        return NextResponse.json(
          {
            success: false,
            error: `Unknown action: ${action}`,
          },
          { status: 400 },
        );
    }
  } catch (error) {
    console.error("Error in competition admin action:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Competition action failed",
      },
      { status: 500 },
    );
  }
}

export async function GET(): Promise<NextResponse<ApiResponse<any>>> {
  try {
    const status = await inscriptionEngine.getStatus();

    return NextResponse.json({
      success: true,
      data: {
        competition: status.competition,
        engine: {
          isRunning: status.isRunning,
          currentBlock: status.currentBlock,
          lastProcessedBlock: status.lastProcessedBlock,
          blocksBehind: status.blocksBehind,
        },
        help: {
          endpoints: {
            "POST /api/admin/competition": "Admin competition management",
            "GET /api/admin/competition": "Get competition status",
          },
          actions: {
            eliminate: "Force eliminate a proposal (requires proposalId)",
            reset: "Reset all proposals to active status",
            trigger: "Manually trigger inscription engine",
            status: "Get detailed competition status",
          },
          examples: {
            eliminate: {
              action: "eliminate",
              proposalId: 123,
              reason: "Spam content",
            },
            reset: { action: "reset", reason: "New competition round" },
            trigger: { action: "trigger" },
            status: { action: "status" },
          },
        },
      },
      message: "Competition management interface ready",
    });
  } catch (error) {
    console.error("Error getting competition status:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to get competition status",
      },
      { status: 500 },
    );
  }
}
