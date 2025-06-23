import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { proposals, users } from "~/server/db/schema";
import { desc, eq } from "drizzle-orm";
import type { ApiResponse, LeaderboardEntry } from "~/types";

// GET /api/leaderboard - Get top proposals ranked by votes
export async function GET(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<LeaderboardEntry[]>>> {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") ?? "10");
    const status = searchParams.get("status") ?? "active"; // active, inscribed, all

    // Build query based on status filter
    const baseQuery = db
      .select({
        id: proposals.id,
        name: proposals.name,
        ticker: proposals.ticker,
        description: proposals.description,
        website: proposals.website,
        twitter: proposals.twitter,
        telegram: proposals.telegram,
        imageUrl: proposals.imageUrl,
        bannerUrl: proposals.bannerUrl,
        submittedBy: proposals.submittedBy,
        votesUp: proposals.votesUp,
        votesDown: proposals.votesDown,
        totalVotes: proposals.totalVotes,
        status: proposals.status,
        createdAt: proposals.createdAt,
        updatedAt: proposals.updatedAt,
        submitterWallet: users.walletAddress,
        submitterUsername: users.username,
      })
      .from(proposals)
      .leftJoin(users, eq(proposals.submittedBy, users.id));

    // Execute query with conditional filtering
    const results =
      status !== "all"
        ? await baseQuery
            .where(
              eq(
                proposals.status,
                status as "active" | "inscribed" | "rejected",
              ),
            )
            .orderBy(desc(proposals.totalVotes))
            .limit(limit)
        : await baseQuery.orderBy(desc(proposals.totalVotes)).limit(limit);

    // Transform results to leaderboard entries
    const leaderboard: LeaderboardEntry[] = results.map((row, index) => {
      // Calculate score (could be more sophisticated)
      const score = row.votesUp - row.votesDown * 0.5; // Downvotes have less impact

      return {
        id: row.id,
        name: row.name,
        ticker: row.ticker,
        description: row.description,
        website: row.website ?? undefined,
        twitter: row.twitter ?? undefined,
        telegram: row.telegram ?? undefined,
        imageUrl: row.imageUrl,
        bannerUrl: row.bannerUrl ?? undefined,
        submittedBy: row.submittedBy ?? undefined,
        votesUp: row.votesUp,
        votesDown: row.votesDown,
        totalVotes: row.totalVotes,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        submitter: row.submitterWallet
          ? {
              id: row.submittedBy!,
              walletAddress: row.submitterWallet,
              username: row.submitterUsername ?? undefined,
              createdAt: "",
              updatedAt: "",
            }
          : undefined,
        rank: index + 1,
        score: score,
        isWinner: index === 0 && status === "active", // Top proposal is current winner
      };
    });

    return NextResponse.json({
      success: true,
      data: leaderboard,
    });
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch leaderboard" },
      { status: 500 },
    );
  }
}
