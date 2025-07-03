import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { proposals, users } from "~/server/db/schema";
import { desc, eq, inArray } from "drizzle-orm";
import type { ApiResponse, LeaderboardEntry } from "~/types";

export async function GET(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<LeaderboardEntry[]>>> {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") ?? "10");
    const status = searchParams.get("status") ?? "active";

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
        firstTimeAsLeader: proposals.firstTimeAsLeader,
        leaderboardMinBlocks: proposals.leaderboardMinBlocks,
        expirationBlock: proposals.expirationBlock,
        createdAt: proposals.createdAt,
        updatedAt: proposals.updatedAt,
        submitterWallet: users.walletAddress,
        submitterUsername: users.username,
        submitterCreatedAt: users.createdAt,
        submitterUpdatedAt: users.updatedAt,
      })
      .from(proposals)
      .leftJoin(users, eq(proposals.submittedBy, users.id));

    const results =
      status === "active"
        ? await baseQuery
            .where(
              inArray(proposals.status, ["active", "leader", "inscribing"]),
            )
            .orderBy(desc(proposals.totalVotes))
            .limit(limit)
        : status !== "all"
          ? await baseQuery
              .where(eq(proposals.status, status as "inscribed" | "rejected"))
              .orderBy(desc(proposals.totalVotes))
              .limit(limit)
          : await baseQuery.orderBy(desc(proposals.totalVotes)).limit(limit);

    const leaderboard: LeaderboardEntry[] = results.map((row, index) => {
      const score = row.votesUp - row.votesDown * 0.5;
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
        firstTimeAsLeader: row.firstTimeAsLeader?.toISOString(),
        leaderboardMinBlocks: row.leaderboardMinBlocks,
        expirationBlock: row.expirationBlock ?? undefined,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        submitter:
          row.submitterWallet &&
          row.submittedBy &&
          row.submitterCreatedAt &&
          row.submitterUpdatedAt
            ? {
                id: row.submittedBy,
                walletAddress: row.submitterWallet,
                username: row.submitterUsername ?? undefined,
                createdAt: row.submitterCreatedAt.toISOString(),
                updatedAt: row.submitterUpdatedAt.toISOString(),
              }
            : undefined,
        rank: index + 1,
        score: score,
        isWinner: index === 0 && status === "active",
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
