/**
 * Server initialization - starts background services automatically
 */

import { inscriptionEngine } from "./jobs/inscription-engine";
import { unisatMonitor } from "./jobs/unisat-monitor";

console.log("🚀 Initializing BitMemes background services...");

// The services are automatically started when imported due to their constructors
// This ensures they run immediately when the server starts

console.log("✅ Background services initialized:");
console.log(
  "   📝 Inscription Engine - monitors new blocks and inscribes winning proposals",
);
console.log(
  "   🔍 UniSat Monitor - tracks UniSat order statuses and updates inscriptions",
);
console.log("   🔄 All services run automatically on their own schedules");

// Export for potential manual control if needed
export { inscriptionEngine, unisatMonitor };
