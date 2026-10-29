// npm run sync [-- --creator <creatorId>]
// Meant to be run once a day by a scheduled job (cron or the host's equivalent).

import { db } from "../src/lib/db";
import { runSync } from "../src/lib/sync";

const creatorFlag = process.argv.indexOf("--creator");
const creatorId = creatorFlag > -1 ? process.argv[creatorFlag + 1] : undefined;

try {
  const summary = await runSync({ trigger: "cli", creatorId });
  console.log(
    `Sync ${summary.status}: ${summary.creatorCount} creator(s), ${summary.reelCount} Reel(s), ${summary.snapshotCount} snapshot(s) in ${summary.durationMs} ms` +
      (summary.maxUsagePercent !== null ? `, max rate-limit usage ${summary.maxUsagePercent}%` : ""),
  );
  for (const error of summary.errors) {
    console.error(`  ✗ ${error.creator}${error.reel ? ` / Reel ${error.reel}` : ""} [${error.kind}] ${error.message}`);
  }
  process.exitCode = summary.status === "failed" ? 1 : 0;
} catch (error) {
  console.error("Sync crashed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
