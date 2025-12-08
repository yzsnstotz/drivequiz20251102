#!/usr/bin/env tsx
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(__dirname, "../.env.local") });
config({ path: resolve(__dirname, "../.env") });

if (process.env.AI_DATABASE_URL?.includes("supabase.co")) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

import { aiDb } from "../src/lib/aiDb";

async function verify() {
  console.log("Checking ai_logs...");
  const log = await aiDb
    .selectFrom("ai_logs")
    .selectAll()
    .orderBy("created_at", "desc")
    .limit(1)
    .executeTakeFirst();
  
  if (log) {
      console.log("Latest Log:", JSON.stringify(log, null, 2));
      if (log.question === "Hello AI, this is a test for logging.") {
          console.log("✅ Verification SUCCESS: Found the test log.");
      } else {
          console.log("⚠️ Found a log, but it might not be the one we just sent.");
          console.log("Expected question: 'Hello AI, this is a test for logging.'");
          console.log("Actual question:", log.question);
      }
  } else {
      console.log("❌ No logs found.");
  }
}

verify().catch(console.error).finally(() => process.exit(0));