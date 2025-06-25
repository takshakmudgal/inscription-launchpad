import * as bitcoin from "bitcoinjs-lib";
import * as ecc from "tiny-secp256k1";
import { ECPairFactory } from "ecpair";
import { env } from "~/env";

// Initialize ECC library
bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);

export interface UTXO {
  txid: string;
  vout: number;
  value: number;
  scriptPubKey: string;
}

export interface PaymentRequest {
  toAddress: string;
  amount: number; // in satoshis
  feeRate?: number; // sats/vB
}

export interface PaymentResult {
  txid: string;
  rawTx: string;
  fee: number;
  totalInput: number;
  totalOutput: number;
}

// Lazy wallet service that initializes only when needed
export const bitcoinWallet = {
  async getAddress(): Promise<string> {
    const wallet = await this.getWallet();
    return wallet.address;
  },

  async getBalance(): Promise<number> {
    const utxos = await this.getUTXOs();
    return utxos.reduce((sum, utxo) => sum + utxo.value, 0);
  },

  async getUTXOs(): Promise<UTXO[]> {
    const wallet = await this.getWallet();

    // Import EsploraService for authenticated API calls
    const { EsploraService } = await import("~/server/btc/esplora");
    const esploraService = new EsploraService();

    try {
      // Use enterprise API endpoint directly
      const esploraUrl =
        env.BITCOIN_NETWORK === "mainnet"
          ? "https://enterprise.blockstream.info/api"
          : "https://enterprise.blockstream.info/testnet/api";

      // Ensure we have a valid token first
      await (esploraService as any).ensureValidToken();

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(
        `${esploraUrl}/address/${wallet.address}/utxo`,
        {
          headers: {
            Authorization: `Bearer ${(esploraService as any).accessToken}`,
            "Content-Type": "application/json",
          },
          signal: controller.signal,
        },
      );

      clearTimeout(timeoutId);
      if (!response.ok) {
        throw new Error(`Failed to fetch UTXOs: ${response.statusText}`);
      }

      const utxos = (await response.json()) as Array<{
        txid: string;
        vout: number;
        value: number;
        status: { confirmed: boolean };
      }>;

      // Only return confirmed UTXOs and add scriptPubKey
      const confirmedUTXOs: UTXO[] = [];

      for (const utxo of utxos) {
        if (utxo.status.confirmed) {
          // Get scriptPubKey from transaction output
          const txController = new AbortController();
          const txTimeoutId = setTimeout(() => txController.abort(), 30000);

          const txResponse = await fetch(`${esploraUrl}/tx/${utxo.txid}`, {
            headers: {
              Authorization: `Bearer ${(esploraService as any).accessToken}`,
              "Content-Type": "application/json",
            },
            signal: txController.signal,
          });

          clearTimeout(txTimeoutId);

          if (txResponse.ok) {
            const txData = (await txResponse.json()) as {
              vout: Array<{ scriptpubkey: string }>;
            };

            confirmedUTXOs.push({
              txid: utxo.txid,
              vout: utxo.vout,
              value: utxo.value,
              scriptPubKey: txData.vout[utxo.vout]?.scriptpubkey || "",
            });
          }
        }
      }

      return confirmedUTXOs;
    } catch (error) {
      console.error("Failed to fetch UTXOs:", error);
      throw new Error(
        `Failed to fetch UTXOs: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  },

  async sendPayment(payment: PaymentRequest): Promise<PaymentResult> {
    const { toAddress, amount, feeRate = 15 } = payment;
    const wallet = await this.getWallet();

    console.log(`💸 Creating payment: ${amount} sats to ${toAddress}`);

    // Get UTXOs
    const utxos = await this.getUTXOs();
    if (utxos.length === 0) {
      throw new Error("No UTXOs available for spending");
    }

    // Calculate total available
    const totalAvailable = utxos.reduce((sum, utxo) => sum + utxo.value, 0);
    console.log(`💰 Total available: ${totalAvailable} sats`);

    // Select UTXOs (simple: use all available for now)
    let totalInput = 0;
    const selectedUTXOs: UTXO[] = [];

    for (const utxo of utxos) {
      selectedUTXOs.push(utxo);
      totalInput += utxo.value;

      // Estimate transaction size and fee
      const estimatedSize = this.estimateTransactionSize(
        selectedUTXOs.length,
        2,
      ); // 2 outputs (payment + change)
      const estimatedFee = estimatedSize * feeRate;

      if (totalInput >= amount + estimatedFee) {
        break; // We have enough
      }
    }

    // Final fee calculation
    const txSize = this.estimateTransactionSize(selectedUTXOs.length, 2);
    const fee = txSize * feeRate;
    const change = totalInput - amount - fee;

    if (totalInput < amount + fee) {
      throw new Error(
        `Insufficient funds: need ${amount + fee} sats, have ${totalInput} sats`,
      );
    }

    console.log(`📊 Transaction breakdown:`);
    console.log(`   Amount: ${amount} sats`);
    console.log(`   Fee: ${fee} sats`);
    console.log(`   Change: ${change} sats`);

    // Create transaction
    const psbt = new bitcoin.Psbt({ network: wallet.network });

    // Add inputs
    for (const utxo of selectedUTXOs) {
      psbt.addInput({
        hash: utxo.txid,
        index: utxo.vout,
        witnessUtxo: {
          script: Buffer.from(utxo.scriptPubKey, "hex"),
          value: utxo.value,
        },
      });
    }

    // Add output for payment
    psbt.addOutput({
      address: toAddress,
      value: amount,
    });

    // Add change output if needed
    if (change > 546) {
      // Dust limit
      psbt.addOutput({
        address: wallet.address,
        value: change,
      });
    }

    // Sign all inputs
    const signer = {
      publicKey: Buffer.from(wallet.keyPair.publicKey),
      sign: (hash: Buffer) => Buffer.from(wallet.keyPair.sign(hash)),
    };

    for (let i = 0; i < selectedUTXOs.length; i++) {
      psbt.signInput(i, signer);
    }

    // Finalize and extract transaction
    psbt.finalizeAllInputs();
    const tx = psbt.extractTransaction();
    const rawTx = tx.toHex();
    const txid = tx.getId();

    console.log(`✅ Transaction created: ${txid}`);

    // Broadcast transaction
    await this.broadcastTransaction(rawTx);

    console.log(`🚀 Transaction broadcasted successfully!`);

    return {
      txid,
      rawTx,
      fee,
      totalInput,
      totalOutput: amount + (change > 546 ? change : 0),
    };
  },

  async waitForConfirmation(
    txid: string,
    maxWaitTime = 3600000,
  ): Promise<boolean> {
    const startTime = Date.now();
    const checkInterval = 30000; // Check every 30 seconds

    console.log(`⏳ Monitoring transaction confirmation: ${txid}`);

    // Import EsploraService for authenticated API calls
    const { EsploraService } = await import("~/server/btc/esplora");
    const esploraService = new EsploraService();

    while (Date.now() - startTime < maxWaitTime) {
      try {
        // Ensure we have a valid token
        await (esploraService as any).ensureValidToken();

        const esploraUrl =
          env.BITCOIN_NETWORK === "mainnet"
            ? "https://enterprise.blockstream.info/api"
            : "https://enterprise.blockstream.info/testnet/api";

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const response = await fetch(`${esploraUrl}/tx/${txid}`, {
          headers: {
            Authorization: `Bearer ${(esploraService as any).accessToken}`,
            "Content-Type": "application/json",
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const txData = (await response.json()) as {
            status: { confirmed: boolean };
          };

          if (txData.status.confirmed) {
            console.log(`✅ Transaction confirmed: ${txid}`);
            return true;
          }
        }

        // Wait before next check
        await new Promise((resolve) => setTimeout(resolve, checkInterval));
      } catch (error) {
        console.error("Error checking transaction status:", error);
      }
    }

    console.log(`⏰ Transaction confirmation timeout: ${txid}`);
    return false;
  },

  // Private methods
  async getWallet() {
    if (!env.PLATFORM_WALLET_PRIVATE_KEY_WIF) {
      throw new Error("Platform wallet private key not configured");
    }

    // Set network
    const network =
      env.BITCOIN_NETWORK === "mainnet"
        ? bitcoin.networks.bitcoin
        : bitcoin.networks.testnet;

    // Initialize key pair from WIF private key
    const keyPair = ECPair.fromWIF(
      env.PLATFORM_WALLET_PRIVATE_KEY_WIF,
      network,
    );

    // Derive address (P2WPKH - native segwit)
    const { address } = bitcoin.payments.p2wpkh({
      pubkey: Buffer.from(keyPair.publicKey),
      network: network,
    });

    if (!address) {
      throw new Error("Failed to derive address from private key");
    }

    return { network, keyPair, address };
  },

  async broadcastTransaction(rawTx: string): Promise<void> {
    // Import EsploraService for authenticated API calls
    const { EsploraService } = await import("~/server/btc/esplora");
    const esploraService = new EsploraService();

    try {
      // Ensure we have a valid token
      await (esploraService as any).ensureValidToken();

      const esploraUrl =
        env.BITCOIN_NETWORK === "mainnet"
          ? "https://enterprise.blockstream.info/api"
          : "https://enterprise.blockstream.info/testnet/api";

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(`${esploraUrl}/tx`, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
          Authorization: `Bearer ${(esploraService as any).accessToken}`,
        },
        body: rawTx,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Broadcast failed: ${error}`);
      }

      console.log("📡 Transaction broadcasted to network");
    } catch (error) {
      console.error("Broadcast error:", error);
      throw new Error(
        `Failed to broadcast transaction: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  },

  estimateTransactionSize(inputs: number, outputs: number): number {
    // Rough estimation for P2WPKH transactions
    const baseSize = 10; // version, locktime, etc.
    const inputSize = 68; // P2WPKH input size in witness
    const outputSize = 31; // P2WPKH output size

    return baseSize + inputs * inputSize + outputs * outputSize;
  },
};
