import { inscriptionEngine } from "./jobs/inscription-engine";
import { unisatMonitor } from "./jobs/unisat-monitor";

declare global {
  var servicesInitialized: boolean;
}

if (!global.servicesInitialized) {
  console.log("🚀 Initializing BitPill background services...");
  // The individual services will log their own initialization.
  global.servicesInitialized = true;
  console.log("✅ Background services initialized.");
}

export { inscriptionEngine, unisatMonitor };
