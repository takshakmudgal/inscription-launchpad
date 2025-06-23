#!/usr/bin/env tsx

/**
 * Test script for UniSat API implementation
 *
 * Usage:
 * 1. Set your environment variables in .env
 * 2. Run: npx tsx src/test-unisat.ts
 */

import { unisatService } from "~/server/services/unisat";
import { env } from "~/env";

async function testUnisatImplementation() {
  console.log("🚀 Testing UniSat API Implementation");
  console.log("=====================================");

  // Check environment variables
  console.log("\n1. Checking Environment Variables:");
  console.log(`   BITCOIN_NETWORK: ${env.BITCOIN_NETWORK}`);
  console.log(`   UNISAT_API: ${env.UNISAT_API ? "✅ Set" : "❌ Missing"}`);
  console.log(
    `   UNISAT_RECEIVE_ADDRESS: ${env.UNISAT_RECEIVE_ADDRESS ? "✅ Set" : "❌ Missing"}`,
  );
  console.log(`   INSCRIPTION_FEE_RATE: ${env.INSCRIPTION_FEE_RATE}`);

  if (!env.UNISAT_API) {
    console.log(
      "\n❌ UNISAT_API key is required. Please set it in your .env file.",
    );
    return;
  }

  if (!env.UNISAT_RECEIVE_ADDRESS) {
    console.log(
      "\n❌ UNISAT_RECEIVE_ADDRESS is required. Please set it in your .env file.",
    );
    return;
  }

  // Test API connectivity by creating a test order
  console.log("\n2. Testing UniSat API Connectivity:");

  const testProposal = {
    id: 999,
    name: "Test Meme Coin",
    ticker: "TEST",
    description: "A test proposal for validating UniSat API integration",
    totalVotes: 100,
    votesUp: 80,
    votesDown: 20,
    website: "https://example.com",
    twitter: "https://twitter.com/test",
    telegram: "https://t.me/test",
    status: "active" as const,
    imageUrl: "https://example.com/test.jpg",
    bannerUrl: undefined,
    submittedBy: undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    console.log("   Creating test inscription order...");

    const order = await unisatService.createInscriptionOrder(
      testProposal,
      850000, // Test block height
      env.UNISAT_RECEIVE_ADDRESS,
    );

    console.log("   ✅ Order created successfully!");
    console.log(`   Order ID: ${order.orderId}`);
    console.log(`   Payment Address: ${order.payAddress}`);
    console.log(`   Amount: ${order.amount} sats`);

    // Test order status check
    console.log("\n3. Testing Order Status Check:");

    const status = await unisatService.getOrderStatus(order.orderId);
    console.log("   ✅ Order status retrieved successfully!");
    console.log(`   Status: ${status.status}`);
    console.log(`   Files: ${status.files.length}`);
    console.log(`   Paid Amount: ${status.paidAmount}/${status.amount} sats`);

    console.log(
      "\n🎉 All tests passed! UniSat integration is working correctly.",
    );
    console.log("\n📋 Next Steps:");
    console.log("   1. Send payment to complete the test order (if desired)");
    console.log("   2. Monitor order status using the built-in monitor");
    console.log(
      "   3. Use the web interface to create orders for real proposals",
    );

    console.log("\n💡 Manual Payment Instructions:");
    console.log(`   Amount: ${order.amount} satoshis`);
    console.log(`   Address: ${order.payAddress}`);
    console.log(`   Order ID: ${order.orderId}`);
  } catch (error) {
    console.log("   ❌ Test failed!");
    console.error("   Error:", error);

    if (error instanceof Error) {
      if (error.message.includes("401")) {
        console.log("\n💡 This appears to be an authentication error.");
        console.log("   Please check your UNISAT_API key in your .env file.");
      } else if (error.message.includes("network")) {
        console.log("\n💡 This appears to be a network connectivity issue.");
        console.log("   Please check your internet connection and try again.");
      }
    }
  }
}

// Run the test
testUnisatImplementation().catch(console.error);
