import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { proposals, users } from "~/server/db/schema";
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
      if (sortBy === "totalVotes") {
        results =
          order === "desc"
            ? await baseQuery
                .where(
                  eq(
                    proposals.status,
                    status as "active" | "inscribed" | "rejected",
                  ),
                )
                .orderBy(desc(proposals.totalVotes))
                .limit(limit)
                .offset(offset)
            : await baseQuery
                .where(
                  eq(
                    proposals.status,
                    status as "active" | "inscribed" | "rejected",
                  ),
                )
                .orderBy(proposals.totalVotes)
                .limit(limit)
                .offset(offset);
      } else if (sortBy === "createdAt") {
        results =
          order === "desc"
            ? await baseQuery
                .where(
                  eq(
                    proposals.status,
                    status as "active" | "inscribed" | "rejected",
                  ),
                )
                .orderBy(desc(proposals.createdAt))
                .limit(limit)
                .offset(offset)
            : await baseQuery
                .where(
                  eq(
                    proposals.status,
                    status as "active" | "inscribed" | "rejected",
                  ),
                )
                .orderBy(proposals.createdAt)
                .limit(limit)
                .offset(offset);
      } else {
        results =
          order === "desc"
            ? await baseQuery
                .where(
                  eq(
                    proposals.status,
                    status as "active" | "inscribed" | "rejected",
                  ),
                )
                .orderBy(desc(proposals.name))
                .limit(limit)
                .offset(offset)
            : await baseQuery
                .where(
                  eq(
                    proposals.status,
                    status as "active" | "inscribed" | "rejected",
                  ),
                )
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
              eq(
                proposals.status,
                status as "active" | "inscribed" | "rejected",
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
      votesUp: created.votesUp,
      votesDown: created.votesDown,
      totalVotes: created.totalVotes,
      status: created.status,
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
