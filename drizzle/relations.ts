import { relations } from "drizzle-orm/relations";
import { bitmemesUser, bitmemesProposal, bitmemesInscription, bitmemesPumpFunTokens, bitmemesVote } from "./schema";

export const bitmemesProposalRelations = relations(bitmemesProposal, ({one, many}) => ({
	bitmemesUser: one(bitmemesUser, {
		fields: [bitmemesProposal.submittedBy],
		references: [bitmemesUser.id]
	}),
	bitmemesInscriptions: many(bitmemesInscription),
	bitmemesPumpFunTokens: many(bitmemesPumpFunTokens),
	bitmemesVotes: many(bitmemesVote),
}));

export const bitmemesUserRelations = relations(bitmemesUser, ({many}) => ({
	bitmemesProposals: many(bitmemesProposal),
	bitmemesVotes: many(bitmemesVote),
}));

export const bitmemesInscriptionRelations = relations(bitmemesInscription, ({one}) => ({
	bitmemesProposal: one(bitmemesProposal, {
		fields: [bitmemesInscription.proposalId],
		references: [bitmemesProposal.id]
	}),
}));

export const bitmemesPumpFunTokensRelations = relations(bitmemesPumpFunTokens, ({one}) => ({
	bitmemesProposal: one(bitmemesProposal, {
		fields: [bitmemesPumpFunTokens.proposalId],
		references: [bitmemesProposal.id]
	}),
}));

export const bitmemesVoteRelations = relations(bitmemesVote, ({one}) => ({
	bitmemesUser: one(bitmemesUser, {
		fields: [bitmemesVote.userId],
		references: [bitmemesUser.id]
	}),
	bitmemesProposal: one(bitmemesProposal, {
		fields: [bitmemesVote.proposalId],
		references: [bitmemesProposal.id]
	}),
}));