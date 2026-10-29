// Daily synchronisation: for each connected creator, list Reels, fetch their insights
// and store one snapshot per Reel per day. Used by POST /api/sync, the admin button
// and `npm run sync` (for a scheduled job).

import { toDay } from "@passaparola/shared/metrics";
import { isFatalForAccount, MetaApiError, redactDeep, type MetaClient } from "@passaparola/shared/meta";
import { db } from "./db";
import { createServerMetaClient } from "./meta";
import { decryptToken } from "./tokens";

export type SyncTrigger = "cli" | "api" | "admin";

export interface SyncError {
  creator: string;
  reel?: string;
  kind: string;
  message: string;
}

export interface SyncSummary {
  runId: string;
  status: "success" | "partial" | "failed";
  creatorCount: number;
  reelCount: number;
  snapshotCount: number;
  errors: SyncError[];
  maxUsagePercent: number | null;
  durationMs: number;
}

function describe(error: unknown): { kind: string; message: string } {
  if (error instanceof MetaApiError) return { kind: error.kind, message: `${error.message} — ${error.hint}` };
  return { kind: "error", message: error instanceof Error ? error.message : String(error) };
}

export async function runSync(options: { trigger: SyncTrigger; creatorId?: string; now?: Date; client?: MetaClient }): Promise<SyncSummary> {
  const started = Date.now();
  const now = options.now ?? new Date();
  const day = toDay(now);
  let maxUsagePercent: number | null = null;
  const meta =
    options.client ??
    createServerMetaClient({
      onResponse: (response) => {
        if (response.usage.maxPercent !== null) maxUsagePercent = Math.max(maxUsagePercent ?? 0, response.usage.maxPercent);
      },
    });

  const run = await db.syncRun.create({ data: { status: "running", trigger: options.trigger } });
  const creators = await db.creator.findMany({
    where: { accessTokenEnc: { not: null }, ...(options.creatorId ? { id: options.creatorId } : {}) },
    orderBy: { username: "asc" },
  });

  const errors: SyncError[] = [];
  let reelCount = 0;
  let snapshotCount = 0;
  let failedCreators = 0;
  let stopRun = false;

  for (const creator of creators) {
    if (stopRun) break;
    const label = `@${creator.username}`;
    try {
      const token = decryptToken(creator.accessTokenEnc!);

      const profile = await meta.getInstagramUser(creator.igUserId, token);
      await db.creator.update({
        where: { id: creator.id },
        data: { username: profile.username ?? creator.username, followersCount: profile.followersCount },
      });

      const reels = await meta.listMedia(creator.igUserId, token);
      for (const media of reels) {
        const reel = await db.reel.upsert({
          where: { igMediaId: media.id },
          create: {
            igMediaId: media.id,
            creatorId: creator.id,
            permalink: media.permalink,
            thumbnailUrl: media.thumbnailUrl,
            caption: media.caption,
            mediaType: media.mediaType,
            publishedAt: media.publishedAt ?? now,
          },
          // restaurantId is set by hand in the admin and never overwritten here.
          update: {
            creatorId: creator.id,
            permalink: media.permalink,
            thumbnailUrl: media.thumbnailUrl,
            caption: media.caption,
            mediaType: media.mediaType,
            ...(media.publishedAt ? { publishedAt: media.publishedAt } : {}),
          },
        });
        reelCount += 1;

        try {
          const insights = await meta.getReelInsights(media.id, token);
          const values = {
            ...insights.metrics,
            insightsMode: insights.mode,
            rawJson: JSON.stringify(redactDeep({ media: { like_count: media.likeCount, comments_count: media.commentsCount }, insights: insights.raw })),
            collectedAt: now,
          };
          // Today's row is refreshed if the sync runs twice the same day; earlier days are untouched.
          await db.reelMetricSnapshot.upsert({
            where: { reelId_day: { reelId: reel.id, day } },
            create: { reelId: reel.id, day, ...values },
            update: values,
          });
          snapshotCount += 1;
        } catch (error) {
          if (isFatalForAccount(error)) throw error;
          errors.push({ creator: label, reel: media.id, ...describe(error) });
        }
      }

      await db.creator.update({ where: { id: creator.id }, data: { lastSyncedAt: now, lastSyncError: null } });
    } catch (error) {
      failedCreators += 1;
      const info = describe(error);
      errors.push({ creator: label, ...info });
      await db.creator.update({ where: { id: creator.id }, data: { lastSyncError: info.message } });
      // An app-level rate limit affects every account: stop instead of hammering the API.
      if (error instanceof MetaApiError && error.kind === "rate_limited") stopRun = true;
    }
  }

  const status: SyncSummary["status"] =
    errors.length === 0 ? "success" : creators.length > 0 && failedCreators === creators.length ? "failed" : "partial";

  await db.syncRun.update({
    where: { id: run.id },
    data: {
      status,
      finishedAt: new Date(),
      creatorCount: creators.length,
      reelCount,
      snapshotCount,
      errorsJson: errors.length ? JSON.stringify(errors) : null,
      maxUsagePercent: maxUsagePercent === null ? null : Math.round(maxUsagePercent),
    },
  });

  return {
    runId: run.id,
    status,
    creatorCount: creators.length,
    reelCount,
    snapshotCount,
    errors,
    maxUsagePercent,
    durationMs: Date.now() - started,
  };
}
