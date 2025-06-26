import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { users } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import type { ApiResponse } from "~/types";

interface UserProfileData {
  walletAddress: string;
  username: string;
  email?: string;
  twitter?: string;
  telegram?: string;
  bio?: string;
}

interface UserProfileResponse {
  id: number;
  walletAddress: string;
  username: string;
  email?: string;
  twitter?: string;
  telegram?: string;
  bio?: string;
  createdAt: string;
  updatedAt: string;
}

export async function GET(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<UserProfileResponse>>> {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get("walletAddress");

    if (!walletAddress) {
      return NextResponse.json(
        { success: false, error: "Wallet address is required" },
        { status: 400 },
      );
    }

    const userRecords = await db
      .select()
      .from(users)
      .where(eq(users.walletAddress, walletAddress))
      .limit(1);

    if (userRecords.length === 0) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 },
      );
    }

    const user = userRecords[0]!;

    const response: UserProfileResponse = {
      id: user.id,
      walletAddress: user.walletAddress!,
      username: user.username!,
      email: user.email ?? undefined,
      twitter: user.twitter ?? undefined,
      telegram: user.telegram ?? undefined,
      bio: user.bio ?? undefined,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch user profile" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<UserProfileResponse>>> {
  try {
    const body = (await request.json()) as UserProfileData;
    const { walletAddress, username, email, twitter, telegram, bio } = body;

    if (!walletAddress || !username) {
      return NextResponse.json(
        { success: false, error: "Wallet address and username are required" },
        { status: 400 },
      );
    }

    const existingUsers = await db
      .select()
      .from(users)
      .where(eq(users.username, username));

    const existingUser = existingUsers.find(
      (u) => u.walletAddress !== walletAddress,
    );
    if (existingUser) {
      return NextResponse.json(
        { success: false, error: "Username is already taken" },
        { status: 400 },
      );
    }

    const userRecords = await db
      .select()
      .from(users)
      .where(eq(users.walletAddress, walletAddress))
      .limit(1);

    let user;

    if (userRecords.length === 0) {
      const insertResult = await db
        .insert(users)
        .values({
          walletAddress,
          username,
          email: email || null,
          twitter: twitter || null,
          telegram: telegram || null,
          bio: bio || null,
        })
        .returning();

      user = insertResult[0]!;
    } else {
      const updateResult = await db
        .update(users)
        .set({
          username,
          email: email || null,
          twitter: twitter || null,
          telegram: telegram || null,
          bio: bio || null,
          updatedAt: new Date(),
        })
        .where(eq(users.walletAddress, walletAddress))
        .returning();

      user = updateResult[0]!;
    }

    const response: UserProfileResponse = {
      id: user.id,
      walletAddress: user.walletAddress!,
      username: user.username!,
      email: user.email ?? undefined,
      twitter: user.twitter ?? undefined,
      telegram: user.telegram ?? undefined,
      bio: user.bio ?? undefined,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error("Error saving user profile:", error);
    return NextResponse.json(
      { success: false, error: "Failed to save user profile" },
      { status: 500 },
    );
  }
}
