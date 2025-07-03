export interface User {
  id: number;
  walletAddress?: string;
  twitterId?: string;
  username?: string;
  email?: string;
  twitter?: string;
  telegram?: string;
  bio?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Proposal {
  id: number;
  name: string;
  ticker: string;
  description: string;
  website?: string;
  twitter?: string;
  telegram?: string;
  imageUrl: string;
  bannerUrl?: string;
  submittedBy?: number;
  votesUp: number;
  votesDown: number;
  totalVotes: number;
  status:
    | "active"
    | "leader"
    | "inscribing"
    | "inscribed"
    | "rejected"
    | "expired";
  firstTimeAsLeader?: string;
  leaderStartBlock?: number;
  leaderboardMinBlocks: number;
  expirationBlock?: number;
  createdAt: string;
  updatedAt: string;
  submitter?: User;
}

export interface Vote {
  id: number;
  userId: number;
  proposalId: number;
  voteType: "up" | "down";
  createdAt: string;
}

export interface Inscription {
  id: number;
  proposalId: number;
  blockHeight: number;
  blockHash: string;
  txid: string;
  inscriptionId?: string;
  inscriptionUrl?: string;
  feeRate?: number;
  totalFees?: number;
  metadata?: string;
  unisatOrderId?: string;
  orderStatus?: string;
  paymentAddress?: string;
  paymentAmount?: number;
  createdAt: string;
  proposal?: Proposal;
}

export interface InscriptionRecord {
  id: number;
  proposalId: number;
  blockHeight: number;
  blockHash: string;
  txid: string;
  inscriptionId: string | null;
  inscriptionUrl: string | null;
  feeRate: number | null;
  totalFees: number | null;
  metadata: string | null;
  unisatOrderId: string | null;
  orderStatus: string | null;
  paymentAddress: string | null;
  paymentAmount: number | null;
  createdAt: Date;
}

export interface BlockInfo {
  id: string;
  height: number;
  version: number;
  timestamp: number;
  tx_count: number;
  size: number;
  weight: number;
  merkle_root: string;
  previousblockhash: string;
  mediantime: number;
  nonce: number;
  bits: number;
  difficulty: number;
  extras: {
    totalFees: number;
    medianFee: number;
    feeRange: number[];
  };
  inscription?: Inscription | null;
}

export interface UpcomingBlock {
  blockSize: number;
  blockVSize: number;
  nTx: number;
  totalFees: number;
  medianFee: number;
  feeRange: number[];
}

export interface InscriptionPayload {
  project: string;
  type: string;
  block: number;
  coin: {
    name: string;
    ticker: string;
    description: string;
    votes: number;
    website?: string;
    twitter?: string;
    telegram?: string;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface UpcomingBlock {
  blockSize: number;
  blockVSize: number;
  nTx: number;
  totalFees: number;
  medianFee: number;
  feeRange: number[];
}

export interface ProposalSubmission {
  name: string;
  ticker: string;
  description: string;
  website?: string;
  twitter?: string;
  telegram?: string;
  imageUrl: string;
  bannerUrl?: string;
  walletAddress?: string;
}

export interface VoteSubmission {
  proposalId: number;
  voteType: "up" | "down";
  walletAddress?: string;
}

export interface LeaderboardEntry extends Proposal {
  rank: number;
  score: number;
  isWinner?: boolean;
}

export interface BitcoinTransaction {
  txid: string;
  confirmations: number;
  blockHeight?: number;
  blockHash?: string;
  fee: number;
}
