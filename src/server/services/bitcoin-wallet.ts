import * as bitcoin from "bitcoinjs-lib";
import * as ecc from "tiny-secp256k1";
import { ECPairFactory } from "ecpair";
import { env } from "~/env";

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
  amount: number;
  feeRate?: number;
}

export interface PaymentResult {
  txid: string;
  rawTx: string;
  fee: number;
  totalInput: number;
  totalOutput: number;
}

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

    const { EsploraService } = await import("~/server/btc/esplora");
    const esploraService = new EsploraService();

    try {
      const esploraUrl =
        env.BITCOIN_NETWORK === "mainnet"
          ? "https://enterprise.blockstream.info/api"
          : "https://enterprise.blockstream.info/testnet/api";

      await (esploraService as any).ensureValidToken();

      // Use axios instead of fetch for better reliability in Node.js environments
      const axios = (await import("axios")).default;

      const response = await axios.get(
        `${esploraUrl}/address/${wallet.address}/utxo`,
        {
          headers: {
            Authorization: `Bearer ${(esploraService as any).accessToken}`,
            "Content-Type": "application/json",
          },
          timeout: 10000,
        },
      );

      const utxos = response.data as Array<{
        txid: string;
        vout: number;
        value: number;
        status: { confirmed: boolean };
      }>;

      const confirmedUTXOs: UTXO[] = [];

      for (const utxo of utxos) {
        const txResponse = await axios.get(`${esploraUrl}/tx/${utxo.txid}`, {
          headers: {
            Authorization: `Bearer ${(esploraService as any).accessToken}`,
            "Content-Type": "application/json",
          },
          timeout: 10000,
        });

        if (txResponse.status === 200) {
          const txData = txResponse.data as {
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

    const utxos = await this.getUTXOs();
    if (utxos.length === 0) {
      throw new Error("No UTXOs available for spending");
    }

    const totalAvailable = utxos.reduce((sum, utxo) => sum + utxo.value, 0);
    console.log(`💰 Total available: ${totalAvailable} sats`);

    let totalInput = 0;
    const selectedUTXOs: UTXO[] = [];

    for (const utxo of utxos) {
      selectedUTXOs.push(utxo);
      totalInput += utxo.value;

      const estimatedSize = this.estimateTransactionSize(
        selectedUTXOs.length,
        2,
      );
      const estimatedFee = estimatedSize * feeRate;

      if (totalInput >= amount + estimatedFee) {
        break;
      }
    }

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

    const psbt = new bitcoin.Psbt({ network: wallet.network });
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

    psbt.addOutput({
      address: toAddress,
      value: amount,
    });

    if (change > 546) {
      psbt.addOutput({
        address: wallet.address,
        value: change,
      });
    }

    const signer = {
      publicKey: Buffer.from(wallet.keyPair.publicKey),
      sign: (hash: Buffer) => Buffer.from(wallet.keyPair.sign(hash)),
    };

    for (let i = 0; i < selectedUTXOs.length; i++) {
      psbt.signInput(i, signer);
    }

    psbt.finalizeAllInputs();
    const tx = psbt.extractTransaction();
    const rawTx = tx.toHex();
    const txid = tx.getId();

    console.log(`✅ Transaction created: ${txid}`);

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
    const checkInterval = 30000;

    console.log(`⏳ Monitoring transaction confirmation: ${txid}`);
    const { EsploraService } = await import("~/server/btc/esplora");
    const esploraService = new EsploraService();

    while (Date.now() - startTime < maxWaitTime) {
      try {
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

        await new Promise((resolve) => setTimeout(resolve, checkInterval));
      } catch (error) {
        console.error("Error checking transaction status:", error);
      }
    }

    console.log(`⏰ Transaction confirmation timeout: ${txid}`);
    return false;
  },

  async getWallet() {
    if (!env.PLATFORM_WALLET_PRIVATE_KEY_WIF) {
      throw new Error("Platform wallet private key not configured");
    }

    const network =
      env.BITCOIN_NETWORK === "mainnet"
        ? bitcoin.networks.bitcoin
        : bitcoin.networks.testnet;

    const keyPair = ECPair.fromWIF(
      env.PLATFORM_WALLET_PRIVATE_KEY_WIF,
      network,
    );

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
    const { EsploraService } = await import("~/server/btc/esplora");
    const esploraService = new EsploraService();

    try {
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
    const baseSize = 10;
    const inputSize = 68;
    const outputSize = 31;

    return baseSize + inputs * inputSize + outputs * outputSize;
  },
};
