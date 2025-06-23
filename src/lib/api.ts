import type {
  ApiResponse,
  Proposal,
  ProposalSubmission,
  Vote,
  VoteSubmission,
  LeaderboardEntry,
  BlockInfo,
} from "~/types";

const API_BASE = process.env.NODE_ENV === "production" ? "" : "";

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const url = `${API_BASE}/api${endpoint}`;

  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.statusText}`);
  }

  return response.json() as Promise<ApiResponse<T>>;
}

// Proposals API
export async function getProposals(
  page = 1,
  limit = 20,
  sortBy = "totalVotes",
  order = "desc",
  status = "active",
): Promise<ApiResponse<{ proposals: Proposal[]; total: number }>> {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    sortBy,
    order,
    status,
  });

  return apiRequest(`/proposals?${params}`);
}

export async function createProposal(
  proposal: ProposalSubmission,
): Promise<ApiResponse<Proposal>> {
  return apiRequest("/proposals", {
    method: "POST",
    body: JSON.stringify(proposal),
  });
}

// Voting API
export async function submitVote(
  vote: VoteSubmission,
): Promise<ApiResponse<Vote>> {
  return apiRequest("/vote", {
    method: "POST",
    body: JSON.stringify(vote),
  });
}

export async function getUserVotes(
  walletAddress: string,
  proposalId?: number,
): Promise<ApiResponse<Vote[]>> {
  const params = new URLSearchParams({ walletAddress });
  if (proposalId) {
    params.append("proposalId", proposalId.toString());
  }

  return apiRequest(`/vote?${params}`);
}

// Leaderboard API
export async function getLeaderboard(
  limit = 10,
  status = "active",
): Promise<ApiResponse<LeaderboardEntry[]>> {
  const params = new URLSearchParams({
    limit: limit.toString(),
    status,
  });

  return apiRequest(`/leaderboard?${params}`);
}

// Blocks API
export async function getLatestBlock(): Promise<ApiResponse<BlockInfo>> {
  return apiRequest("/blocks/latest");
}

// Client-side helpers
export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function handleApiResponse<T>(
  apiCall: () => Promise<ApiResponse<T>>,
): Promise<T> {
  try {
    const response = await apiCall();

    if (!response.success) {
      throw new ApiError(
        response.error ?? "Unknown API error",
        500,
        "API_ERROR",
      );
    }

    return response.data!;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(
      error instanceof Error ? error.message : "Network error",
      0,
      "NETWORK_ERROR",
    );
  }
}
