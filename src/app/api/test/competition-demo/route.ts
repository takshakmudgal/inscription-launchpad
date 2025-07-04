import { NextResponse } from "next/server";
import type { ApiResponse } from "~/types";

interface CompetitionScenario {
  title: string;
  description: string;
  steps: Array<{
    block: number;
    action: string;
    winner: string;
    eliminated?: string[];
    status: Record<string, string>;
  }>;
}

export async function GET(): Promise<NextResponse<ApiResponse<any>>> {
  const competitiveSystemDemo: CompetitionScenario = {
    title: "🏟️ COMPETITIVE ELIMINATION SYSTEM DEMO",
    description: "How only the strongest proposals survive to inscription",
    steps: [
      {
        block: 100,
        action: "🥊 10 proposals enter the battle arena",
        winner: "None yet",
        status: {
          DOGE: "active (1500 votes)",
          PEPE: "active (1200 votes)",
          SHIB: "active (1100 votes)",
          MEME: "active (900 votes)",
          WOJAK: "active (800 votes)",
          CHAD: "active (700 votes)",
          MOON: "active (600 votes)",
          HODL: "active (500 votes)",
          REKT: "active (400 votes)",
          FOMO: "active (300 votes)",
        },
      },
      {
        block: 101,
        action: "👑 DOGE takes #1 position, becomes leader",
        winner: "DOGE",
        status: {
          DOGE: "leader (1500 votes, 0/1 blocks)",
          PEPE: "active (1200 votes)",
          SHIB: "active (1100 votes)",
          Others: "active (fighting for position)",
        },
      },
      {
        block: 102,
        action: "🎉 DOGE SURVIVES! Earns inscription after 1 block",
        winner: "DOGE",
        status: {
          DOGE: "🏆 CHAMPION! → inscribing",
          PEPE: "💀 ELIMINATED (too late)",
          SHIB: "💀 ELIMINATED (too late)",
          Others: "💀 ELIMINATED",
        },
      },
      {
        block: 103,
        action: "⚔️ PEPE takes #1, becomes new leader",
        winner: "PEPE",
        status: {
          PEPE: "leader (1700 votes, 0/1 blocks)",
          SHIB: "active (1400 votes)",
          Others: "active",
        },
      },
      {
        block: 104,
        action: "🎉 PEPE SURVIVES! Earns inscription after 1 block",
        winner: "PEPE",
        status: {
          PEPE: "🏆 CHAMPION! → inscribing",
          SHIB: "💀 ELIMINATED",
          MEME: "💀 ELIMINATED",
          Others: "💀 ELIMINATED",
        },
      },
      {
        block: 105,
        action: "💀 SHIB OVERTAKES! PEPE eliminated, more carnage",
        winner: "SHIB",
        eliminated: ["PEPE", "WOJAK", "CHAD"],
        status: {
          SHIB: "leader (1900 votes, 0/2 blocks)",
          PEPE: "💀 ELIMINATED (failed after 1 block)",
          MEME: "active (1500 votes)",
          MOON: "active (1200 votes)",
          DOGE: "💀 ELIMINATED",
          WOJAK: "💀 ELIMINATED",
          CHAD: "💀 ELIMINATED",
        },
      },
      {
        block: 106,
        action: "🏆 SHIB survives first block, getting stronger",
        winner: "SHIB",
        status: {
          SHIB: "leader (2000 votes, 1/2 blocks)",
          MEME: "active (1600 votes, still fighting)",
          MOON: "active (1300 votes)",
          Others: "💀 ELIMINATED",
        },
      },
      {
        block: 107,
        action: "🎉 SHIB SURVIVES! Earns inscription after 2 blocks",
        winner: "SHIB",
        status: {
          SHIB: "🏆 CHAMPION! → inscribing",
          MEME: "💀 ELIMINATED (too late)",
          MOON: "💀 ELIMINATED (too late)",
          Others: "💀 ELIMINATED",
        },
      },
    ],
  };

  const systemRules = {
    title: "⚔️ BATTLE RULES",
    rules: [
      "🥊 Only #1 proposal can become 'leader'",
      "👑 Leaders must defend #1 position for 1 consecutive block",
      "💀 Lose #1 position = immediate elimination (no second chances)",
      "⏰ Leaders have 5 blocks max to complete 1-block challenge",
      "🏆 Only proposals that survive 1 block get inscribed",
      "💪 Strongest proposals with sustained community support win",
    ],
  };

  const advantages = {
    title: "🎯 WHY THIS SYSTEM WORKS",
    benefits: [
      "🚫 Prevents pump & dump schemes - requires sustained support",
      "⚡ Creates exciting real-time competition",
      "🏆 Only truly popular memes get permanent inscription",
      "💎 Rewards proposals that can maintain momentum",
      "🔥 Natural elimination reduces noise and spam",
      "⚔️ Community engagement through competitive voting",
    ],
  };

  return NextResponse.json({
    success: true,
    data: {
      demo: competitiveSystemDemo,
      rules: systemRules,
      advantages: advantages,
      summary: {
        startingProposals: 10,
        survivors: 2,
        eliminationRate: "80%",
        survivorCriteria: "Maintained #1 position for 1+ consecutive blocks",
        inscriptionRate: "Only 2 in 10 proposals gets inscribed",
      },
      realWorldExample: {
        scenario: "If 100 proposals compete over 20 blocks",
        expectedOutcome: "~4-10 champions inscribed",
        eliminatedProposals: "90-96 proposals eliminated",
        result: "Only the absolute strongest survive",
      },
    },
    message:
      "🏟️ Competitive elimination ensures only the strongest proposals become Bitcoin legends!",
  });
}
