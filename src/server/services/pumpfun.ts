import { Connection, Keypair, VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";
import { env } from "~/env";
import type { Proposal } from "~/types";
import { db } from "../db";
import { pumpFunTokens } from "../db/schema";

class PumpFunService {
  private readonly connection: Connection;
  private readonly platformWallet: Keypair;

  constructor() {
    if (!env.HELIUS_RPC_URL) {
      throw new Error("HELIUS_RPC_URL is not set in the environment");
    }
    if (!env.SOLANA_PLATFORM_WALLET_PRIVATE_KEY) {
      throw new Error(
        "SOLANA_PLATFORM_WALLET_PRIVATE_KEY is not set in the environment",
      );
    }
    this.connection = new Connection(env.HELIUS_RPC_URL, "confirmed");
    this.platformWallet = Keypair.fromSecretKey(
      bs58.decode(env.SOLANA_PLATFORM_WALLET_PRIVATE_KEY),
    );
  }

  async createToken(proposal: Proposal) {
    console.log(`Creating pump.fun token for proposal: ${proposal.name}`);
    const mintKeypair = Keypair.generate();

    try {
      if (!proposal.bannerUrl) {
        throw new Error("Proposal has no banner image for token creation.");
      }

      const imageResponse = await fetch(proposal.bannerUrl);
      if (!imageResponse.ok) {
        throw new Error(
          `Failed to fetch image from ${proposal.bannerUrl}: ${imageResponse.statusText}`,
        );
      }
      const imageBlob = await imageResponse.blob();

      const formData = new FormData();
      formData.append("file", imageBlob, `${proposal.ticker}-logo.png`);
      formData.append("name", proposal.name);
      formData.append("symbol", proposal.ticker);
      formData.append("description", proposal.description);
      formData.append("twitter", proposal.twitter || "");
      formData.append("telegram", proposal.telegram || "");
      // Use our website's proposal page as the website URL
      const proposalUrl = `https://bitmemes.com/proposals/${proposal.id}`;
      formData.append("website", proposalUrl);
      formData.append("showName", "true");

      console.log("Uploading metadata to pump.fun IPFS...");
      const metadataResponse = await fetch("https://pump.fun/api/ipfs", {
        method: "POST",
        body: formData,
      });

      if (!metadataResponse.ok) {
        const errorText = await metadataResponse.text();
        throw new Error(
          `Failed to upload metadata to pump.fun: ${metadataResponse.statusText} - ${errorText}`,
        );
      }

      const metadataResponseJSON = await metadataResponse.json();
      console.log("Metadata uploaded:", metadataResponseJSON);

      console.log("Requesting create transaction from pumpportal.fun...");
      const createTxResponse = await fetch(
        "https://pumpportal.fun/api/trade-local",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            publicKey: this.platformWallet.publicKey.toBase58(),
            action: "create",
            tokenMetadata: {
              name: metadataResponseJSON.metadata.name,
              symbol: metadataResponseJSON.metadata.symbol,
              uri: metadataResponseJSON.metadataUri,
            },
            mint: mintKeypair.publicKey.toBase58(),
            denominatedInSol: "true",
            amount: 0.15, // 0.15 $SOL initial buy for dev_account
            slippage: 10,
            priorityFee: 0.0005,
            pool: "pump",
          }),
        },
      );

      if (!createTxResponse.ok) {
        const errorText = await createTxResponse.text();
        throw new Error(
          `Failed to get create transaction from pumpportal: ${createTxResponse.statusText} - ${errorText}`,
        );
      }

      const txData = await createTxResponse.arrayBuffer();
      const tx = VersionedTransaction.deserialize(new Uint8Array(txData));
      tx.sign([mintKeypair, this.platformWallet]);

      console.log("Sending transaction to Solana network...");
      const signature = await this.connection.sendTransaction(tx, {
        maxRetries: 5,
      });
      console.log(`Transaction sent with signature: ${signature}`);

      const confirmation = await this.connection.confirmTransaction(
        signature,
        "confirmed",
      );
      if (confirmation.value.err) {
        throw new Error(
          `Transaction failed to confirm: ${JSON.stringify(confirmation.value.err)}`,
        );
      }

      console.log(
        `🚀 Successfully created pump.fun token: https://solscan.io/tx/${signature}`,
      );

      await db.insert(pumpFunTokens).values({
        proposalId: proposal.id,
        mintAddress: mintKeypair.publicKey.toBase58(),
        transactionSignature: signature,
        metadataUri: metadataResponseJSON.metadataUri,
      });

      return {
        signature,
        mintAddress: mintKeypair.publicKey.toBase58(),
      };
    } catch (error) {
      console.error(
        `❌ Error creating pump.fun token for proposal ${proposal.id}:`,
        error,
      );
    }
  }
}

export const pumpFunService = new PumpFunService();
