import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "~/server/db";
import {
  proposals,
  users,
  inscriptions,
  pumpFunTokens,
} from "~/server/db/schema";
import { eq, sql, desc } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ proposalId: string }> },
) {
  try {
    const resolvedParams = await params;
    const proposalId = parseInt(resolvedParams.proposalId);

    if (isNaN(proposalId)) {
      return NextResponse.json(
        { success: false, error: "Invalid proposal ID" },
        { status: 400 },
      );
    }

    // Fetch the proposal with detailed information
    const result = await db
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
        votesUp: proposals.votesUp,
        votesDown: proposals.votesDown,
        totalVotes: proposals.totalVotes,
        status: proposals.status,
        firstTimeAsLeader: proposals.firstTimeAsLeader,
        leaderStartBlock: proposals.leaderStartBlock,
        leaderboardMinBlocks: proposals.leaderboardMinBlocks,
        expirationBlock: proposals.expirationBlock,
        createdAt: proposals.createdAt,
        updatedAt: proposals.updatedAt,
        submitter: {
          id: users.id,
          username: users.username,
          email: users.email,
          twitter: users.twitter,
          telegram: users.telegram,
          bio: users.bio,
        },
      })
      .from(proposals)
      .leftJoin(users, eq(proposals.submittedBy, users.id))
      .where(eq(proposals.id, proposalId))
      .limit(1);

    if (result.length === 0) {
      return NextResponse.json(
        { success: false, error: "Proposal not found" },
        { status: 404 },
      );
    }

    const proposal = result[0];
    if (!proposal) {
      return NextResponse.json(
        { success: false, error: "Proposal not found" },
        { status: 404 },
      );
    }

    // Calculate rank (simplified - just using total votes for now)
    const rankResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(proposals)
      .where(sql`${proposals.totalVotes} > ${proposal.totalVotes}`);

    const rank = (rankResult[0]?.count ?? 0) + 1;

    // Fetch latest inscription (if any)
    const inscriptionResult = await db
      .select()
      .from(inscriptions)
      .where(eq(inscriptions.proposalId, proposalId))
      .orderBy(desc(inscriptions.createdAt))
      .limit(1);

    const pumpFunTokenResult = await db
      .select()
      .from(pumpFunTokens)
      .where(eq(pumpFunTokens.proposalId, proposalId))
      .limit(1);

    const proposalWithRank = {
      ...proposal,
      rank,
      score: proposal.totalVotes, // Simple scoring for now
      isWinner: rank === 1 && proposal.status === "inscribed",
      inscription: inscriptionResult[0] ?? null,
      pumpFunToken: pumpFunTokenResult[0] ?? null,
    };

    return NextResponse.json({
      success: true,
      data: proposalWithRank,
    });
  } catch (error) {
    console.error("Error fetching proposal:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
