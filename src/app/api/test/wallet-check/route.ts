import { NextRequest, NextResponse } from "next/server";
import { bitcoinWallet } from "~/server/services/bitcoin-wallet";
import { env } from "~/env";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const checkBalance = searchParams.get("balance") === "true";
    const checkUTXOs = searchParams.get("utxos") === "true";

    const result: any = {
      walletConfigured: false,
      address: null,
      balance: null,
      utxos: null,
      errors: [],
    };

    const requiredEnvVars = [
      "PLATFORM_WALLET_PRIVATE_KEY_WIF",
      "PLATFORM_WALLET_PRIVATE_KEY_HEX",
      "PLATFORM_WALLET_ADDRESS",
    ];

    const missingVars = requiredEnvVars.filter(
      (varName) => !env[varName as keyof typeof env],
    );
    if (missingVars.length > 0) {
      result.errors.push(
        `Missing environment variables: ${missingVars.join(", ")}`,
      );
    }

    try {
      result.address = await bitcoinWallet.getAddress();
      result.walletConfigured = true;
    } catch (error) {
      result.errors.push(
        `Wallet initialization failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (checkBalance && result.walletConfigured) {
      try {
        result.balance = await bitcoinWallet.getBalance();
      } catch (error) {
        result.errors.push(
          `Balance check failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    if (checkUTXOs && result.walletConfigured) {
      try {
        result.utxos = await bitcoinWallet.getUTXOs();
      } catch (error) {
        result.errors.push(
          `UTXO fetch failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error checking wallet:", error);
    return NextResponse.json(
      { error: "Failed to check wallet status", details: String(error) },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, toAddress, amount } = body;

    if (action === "test_payment" && toAddress && amount) {
      try {
        const balance = await bitcoinWallet.getBalance();
        const utxos = await bitcoinWallet.getUTXOs();

        const result = {
          canPay: balance >= amount,
          balance,
          required: amount,
          deficit: Math.max(0, amount - balance),
          utxosCount: utxos.length,
          totalValue: utxos.reduce((sum, utxo) => sum + utxo.value, 0),
        };

        return NextResponse.json({
          success: true,
          data: result,
        });
      } catch (error) {
        return NextResponse.json(
          { error: "Payment test failed", details: String(error) },
          { status: 500 },
        );
      }
    }

    return NextResponse.json(
      { error: "Invalid action or missing parameters" },
      { status: 400 },
    );
  } catch (error) {
    console.error("Error testing payment:", error);
    return NextResponse.json(
      { error: "Failed to test payment", details: String(error) },
      { status: 500 },
    );
  }
}
