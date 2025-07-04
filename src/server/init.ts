import { getInscriptionEngineInstance } from "./jobs/inscription-engine";
import { getUnisatMonitorInstance } from "./jobs/unisat-monitor";

declare global {
  var servicesInitialized: boolean;
}

if (!global.servicesInitialized) {
  console.log("🚀 Initializing Bitmemes background services...");
  getInscriptionEngineInstance();
  getUnisatMonitorInstance();
  global.servicesInitialized = true;
  console.log("✅ Background services initialized.");
}
