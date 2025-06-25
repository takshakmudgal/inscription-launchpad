import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { proposals, users, inscriptions } from "~/server/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { ApiResponse, Proposal } from "~/types";

// Validation schema for proposal submission
const proposalSchema = z.object({
  name: z.string().min(1).max(50),
  ticker: z.string().min(1).max(10).toUpperCase(),
  description: z.string().min(1).max(280),
  website: z.string().url().optional().or(z.literal("")),
  twitter: z.string().url().optional().or(z.literal("")),
  telegram: z.string().url().optional().or(z.literal("")),
  imageUrl: z.string().url(),
  bannerUrl: z.string().url().optional().or(z.literal("")),
  walletAddress: z.string().optional(),
});

// GET /api/proposals - Fetch all proposals with pagination and sorting
export async function GET(
  request: NextRequest,
): Promise<
  NextResponse<ApiResponse<{ proposals: Proposal[]; total: number }>>
> {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") ?? "1");
    const limit = parseInt(searchParams.get("limit") ?? "20");
    const sortBy = searchParams.get("sortBy") ?? "totalVotes"; // totalVotes, createdAt, name
    const order = searchParams.get("order") ?? "desc"; // asc, desc
    const status = searchParams.get("status") ?? "active"; // active, inscribed, rejected, all

    const offset = (page - 1) * limit;

    // Build base query
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
        // New automatic inscription timing fields
        firstTimeAsLeader: proposals.firstTimeAsLeader,
        leaderStartBlock: proposals.leaderStartBlock,
        leaderboardMinBlocks: proposals.leaderboardMinBlocks,
        expirationBlock: proposals.expirationBlock,
        createdAt: proposals.createdAt,
        updatedAt: proposals.updatedAt,
        submitterWallet: users.walletAddress,
        submitterUsername: users.username,
      })
      .from(proposals)
      .leftJoin(users, eq(proposals.submittedBy, users.id));

    // Build complete query with filters, sorting, and pagination
    let results;

    if (status !== "all") {
      const statusCondition =
        status === "active"
          ? sql`${proposals.status} IN ('active', 'leader')` // Active excludes expired
          : eq(
              proposals.status,
              status as "inscribed" | "rejected" | "expired",
            );

      if (sortBy === "totalVotes") {
        results =
          order === "desc"
            ? await baseQuery
                .where(statusCondition)
                .orderBy(desc(proposals.totalVotes))
                .limit(limit)
                .offset(offset)
            : await baseQuery
                .where(statusCondition)
                .orderBy(proposals.totalVotes)
                .limit(limit)
                .offset(offset);
      } else if (sortBy === "createdAt") {
        results =
          order === "desc"
            ? await baseQuery
                .where(statusCondition)
                .orderBy(desc(proposals.createdAt))
                .limit(limit)
                .offset(offset)
            : await baseQuery
                .where(statusCondition)
                .orderBy(proposals.createdAt)
                .limit(limit)
                .offset(offset);
      } else {
        results =
          order === "desc"
            ? await baseQuery
                .where(statusCondition)
                .orderBy(desc(proposals.name))
                .limit(limit)
                .offset(offset)
            : await baseQuery
                .where(statusCondition)
                .orderBy(proposals.name)
                .limit(limit)
                .offset(offset);
      }
    } else {
      if (sortBy === "totalVotes") {
        results =
          order === "desc"
            ? await baseQuery
                .orderBy(desc(proposals.totalVotes))
                .limit(limit)
                .offset(offset)
            : await baseQuery
                .orderBy(proposals.totalVotes)
                .limit(limit)
                .offset(offset);
      } else if (sortBy === "createdAt") {
        results =
          order === "desc"
            ? await baseQuery
                .orderBy(desc(proposals.createdAt))
                .limit(limit)
                .offset(offset)
            : await baseQuery
                .orderBy(proposals.createdAt)
                .limit(limit)
                .offset(offset);
      } else {
        results =
          order === "desc"
            ? await baseQuery
                .orderBy(desc(proposals.name))
                .limit(limit)
                .offset(offset)
            : await baseQuery
                .orderBy(proposals.name)
                .limit(limit)
                .offset(offset);
      }
    }

    // Get total count
    const totalResult =
      status !== "all"
        ? await db
            .select({ count: sql<number>`count(*)` })
            .from(proposals)
            .where(
              status === "active"
                ? sql`${proposals.status} IN ('active', 'leader')` // Active excludes expired
                : eq(
                    proposals.status,
                    status as "inscribed" | "rejected" | "expired",
                  ),
            )
        : await db.select({ count: sql<number>`count(*)` }).from(proposals);

    const total = totalResult[0]?.count ?? 0;

    // Transform results
    const transformedProposals: Proposal[] = results.map((row) => ({
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
      // New automatic inscription timing fields
      firstTimeAsLeader: row.firstTimeAsLeader?.toISOString(),
      leaderStartBlock: row.leaderStartBlock ?? undefined,
      leaderboardMinBlocks: row.leaderboardMinBlocks,
      expirationBlock: row.expirationBlock ?? undefined,
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
    }));

    return NextResponse.json({
      success: true,
      data: {
        proposals: transformedProposals,
        total,
      },
    });
  } catch (error) {
    console.error("Error fetching proposals:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch proposals" },
      { status: 500 },
    );
  }
}

// POST /api/proposals - Create new proposal
export async function POST(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<Proposal>>> {
  try {
    const body = (await request.json()) as unknown;
    const validatedData = proposalSchema.parse(body);

    // Check if ticker already exists
    const existingProposal = await db
      .select()
      .from(proposals)
      .where(eq(proposals.ticker, validatedData.ticker))
      .limit(1);

    if (existingProposal.length > 0) {
      return NextResponse.json(
        { success: false, error: "Ticker already exists" },
        { status: 400 },
      );
    }

    // Find or create user if wallet address provided
    let userId: number | undefined;
    if (validatedData.walletAddress) {
      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.walletAddress, validatedData.walletAddress))
        .limit(1);

      if (existingUser.length > 0) {
        userId = existingUser[0]!.id;
      } else {
        const newUser = await db
          .insert(users)
          .values({
            walletAddress: validatedData.walletAddress,
          })
          .returning();
        userId = newUser[0]!.id;
      }
    }

    // Create proposal
    const newProposal = await db
      .insert(proposals)
      .values({
        name: validatedData.name,
        ticker: validatedData.ticker,
        description: validatedData.description,
        website: validatedData.website ?? null,
        twitter: validatedData.twitter ?? null,
        telegram: validatedData.telegram ?? null,
        imageUrl: validatedData.imageUrl,
        bannerUrl: validatedData.bannerUrl ?? null,
        submittedBy: userId,
      })
      .returning();

    const created = newProposal[0]!;

    // Get submitter details if available
    let submitterDetails;
    if (userId) {
      const submitter = await db
        .select({
          id: users.id,
          walletAddress: users.walletAddress,
          username: users.username,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (submitter.length > 0) {
        submitterDetails = {
          id: submitter[0]!.id,
          walletAddress: submitter[0]!.walletAddress!,
          username: submitter[0]!.username ?? undefined,
          createdAt: "",
          updatedAt: "",
        };
      }
    }

    const transformedProposal: Proposal = {
      id: created.id,
      name: created.name,
      ticker: created.ticker,
      description: created.description,
      website: created.website ?? undefined,
      twitter: created.twitter ?? undefined,
      telegram: created.telegram ?? undefined,
      imageUrl: created.imageUrl,
      bannerUrl: created.bannerUrl ?? undefined,
      submittedBy: created.submittedBy ?? undefined,
      submitter: submitterDetails,
      votesUp: created.votesUp,
      votesDown: created.votesDown,
      totalVotes: created.totalVotes,
      status: created.status,
      // New automatic inscription timing fields
      firstTimeAsLeader: created.firstTimeAsLeader?.toISOString(),
      leaderStartBlock: created.leaderStartBlock ?? undefined,
      leaderboardMinBlocks: created.leaderboardMinBlocks,
      expirationBlock: created.expirationBlock ?? undefined,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: transformedProposal,
      message: "Proposal created successfully",
    });
  } catch (error) {
    console.error("Error creating proposal:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid proposal data",
          message: error.errors[0]?.message,
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { success: false, error: "Failed to create proposal" },
      { status: 500 },
    );
  }
}

// PATCH /api/proposals - Update proposal status
export async function PATCH(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<{ success: boolean }>>> {
  try {
    const body = (await request.json()) as {
      orderId?: string;
      action?: string;
    };

    if (body.action === "mark_inscribed" && body.orderId) {
      // Find the inscription with this order ID
      const inscription = await db
        .select()
        .from(inscriptions)
        .where(eq(inscriptions.unisatOrderId, body.orderId))
        .limit(1);

      if (inscription.length === 0) {
        return NextResponse.json(
          { success: false, error: "Inscription not found for this order" },
          { status: 404 },
        );
      }

      const proposalId = inscription[0]!.proposalId;

      // Update the proposal status to inscribed
      await db
        .update(proposals)
        .set({
          status: "inscribed",
          updatedAt: new Date(),
        })
        .where(eq(proposals.id, proposalId));

      console.log(`✅ Proposal ${proposalId} marked as inscribed via API`);

      return NextResponse.json({
        success: true,
        data: { success: true },
        message: "Proposal status updated successfully",
      });
    }

    return NextResponse.json(
      { success: false, error: "Invalid action" },
      { status: 400 },
    );
  } catch (error) {
    console.error("Error updating proposal:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update proposal" },
      { status: 500 },
    );
  }
}
