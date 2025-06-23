import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { votes, proposals, users } from "~/server/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { z } from "zod";
import type { ApiResponse, Vote } from "~/types";

// Validation schema for vote submission
const voteSchema = z.object({
  proposalId: z.number().int().positive(),
  voteType: z.enum(["up", "down"]),
  walletAddress: z.string().min(1), // Required for voting
});

// POST /api/vote - Submit a vote
export async function POST(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<Vote>>> {
  try {
    const body = (await request.json()) as unknown;
    const validatedData = voteSchema.parse(body);

    // Check if proposal exists and is active
    const proposal = await db
      .select()
      .from(proposals)
      .where(eq(proposals.id, validatedData.proposalId))
      .limit(1);

    if (proposal.length === 0) {
      return NextResponse.json(
        { success: false, error: "Proposal not found" },
        { status: 404 },
      );
    }

    if (proposal[0]?.status !== "active") {
      return NextResponse.json(
        { success: false, error: "Proposal is not active for voting" },
        { status: 400 },
      );
    }

    // Find or create user
    const user = await db
      .select()
      .from(users)
      .where(eq(users.walletAddress, validatedData.walletAddress))
      .limit(1);

    let userId: number;
    if (user.length === 0) {
      const newUser = await db
        .insert(users)
        .values({
          walletAddress: validatedData.walletAddress,
        })
        .returning();
      userId = newUser[0]!.id;
    } else {
      userId = user[0]!.id;
    }

    // Check if user has already voted on this proposal
    const existingVote = await db
      .select()
      .from(votes)
      .where(
        and(
          eq(votes.userId, userId),
          eq(votes.proposalId, validatedData.proposalId),
        ),
      )
      .limit(1);

    if (existingVote.length > 0) {
      return NextResponse.json(
        { success: false, error: "You have already voted on this proposal" },
        { status: 400 },
      );
    }

    // Create the vote
    const newVote = await db
      .insert(votes)
      .values({
        userId,
        proposalId: validatedData.proposalId,
        voteType: validatedData.voteType,
      })
      .returning();

    const vote = newVote[0]!;

    // Update proposal vote counts
    const voteIncrement = validatedData.voteType === "up" ? 1 : 0;
    const downVoteIncrement = validatedData.voteType === "down" ? 1 : 0;

    await db
      .update(proposals)
      .set({
        votesUp: sql`${proposals.votesUp} + ${voteIncrement}`,
        votesDown: sql`${proposals.votesDown} + ${downVoteIncrement}`,
        totalVotes: sql`${proposals.totalVotes} + 1`,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(proposals.id, validatedData.proposalId));

    const transformedVote: Vote = {
      id: vote.id,
      userId: vote.userId,
      proposalId: vote.proposalId,
      voteType: vote.voteType,
      createdAt: vote.createdAt.toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: transformedVote,
      message: "Vote submitted successfully",
    });
  } catch (error) {
    console.error("Error submitting vote:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid vote data",
          message: error.errors[0]?.message,
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { success: false, error: "Failed to submit vote" },
      { status: 500 },
    );
  }
}

// GET /api/vote - Get user's votes (optional, for user profile)
export async function GET(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<Vote[]>>> {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get("walletAddress");
    const proposalId = searchParams.get("proposalId");

    if (!walletAddress) {
      return NextResponse.json(
        { success: false, error: "Wallet address is required" },
        { status: 400 },
      );
    }

    // Find user
    const user = await db
      .select()
      .from(users)
      .where(eq(users.walletAddress, walletAddress))
      .limit(1);

    if (user.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    const userId = user[0]!.id;

    // Build and execute query with conditional filtering
    const userVotes = proposalId
      ? await db
          .select()
          .from(votes)
          .where(
            and(
              eq(votes.userId, userId),
              eq(votes.proposalId, parseInt(proposalId)),
            ),
          )
          .orderBy(votes.createdAt)
      : await db
          .select()
          .from(votes)
          .where(eq(votes.userId, userId))
          .orderBy(votes.createdAt);

    const transformedVotes: Vote[] = userVotes.map((vote) => ({
      id: vote.id,
      userId: vote.userId,
      proposalId: vote.proposalId,
      voteType: vote.voteType,
      createdAt: vote.createdAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      data: transformedVotes,
    });
  } catch (error) {
    console.error("Error fetching votes:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch votes" },
      { status: 500 },
    );
  }
}
