import { inscriptionEngine } from "./jobs/inscription-engine";
import { unisatMonitor } from "./jobs/unisat-monitor";

console.log("🚀 Initializing BitMemes background services...");
console.log("✅ Background services initialized:");
console.log(
  "   📝 Inscription Engine - monitors new blocks and inscribes winning proposals",
);
console.log(
  "   🔍 UniSat Monitor - tracks UniSat order statuses and updates inscriptions",
);
console.log("   🔄 All services run automatically on their own schedules");

export { inscriptionEngine, unisatMonitor };
