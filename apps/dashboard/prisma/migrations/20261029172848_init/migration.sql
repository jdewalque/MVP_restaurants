-- CreateTable
CREATE TABLE "Restaurant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "neighborhood" TEXT NOT NULL,
    "monthlyPriceCents" INTEGER NOT NULL,
    "instagramHandle" TEXT,
    "subscriptionStartedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Creator" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "igUserId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "followersCount" INTEGER,
    "pageId" TEXT,
    "pageName" TEXT,
    "connectedVia" TEXT NOT NULL,
    "accessTokenEnc" TEXT,
    "tokenExpiresAt" DATETIME,
    "dataAccessExpiresAt" DATETIME,
    "tokenScopes" TEXT,
    "lastSyncedAt" DATETIME,
    "lastSyncError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Reel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "igMediaId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "restaurantId" TEXT,
    "permalink" TEXT,
    "thumbnailUrl" TEXT,
    "caption" TEXT,
    "mediaType" TEXT,
    "publishedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Reel_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Reel_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReelMetricSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reelId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "collectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "views" INTEGER,
    "reach" INTEGER,
    "likes" INTEGER,
    "comments" INTEGER,
    "shares" INTEGER,
    "saved" INTEGER,
    "totalInteractions" INTEGER,
    "avgWatchTimeMs" INTEGER,
    "totalWatchTimeMs" INTEGER,
    "insightsMode" TEXT,
    "rawJson" TEXT,
    CONSTRAINT "ReelMetricSnapshot_reelId_fkey" FOREIGN KEY ("reelId") REFERENCES "Reel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SyncRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "status" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "creatorCount" INTEGER NOT NULL DEFAULT 0,
    "reelCount" INTEGER NOT NULL DEFAULT 0,
    "snapshotCount" INTEGER NOT NULL DEFAULT 0,
    "errorsJson" TEXT,
    "maxUsagePercent" INTEGER
);

-- CreateIndex
CREATE UNIQUE INDEX "Restaurant_slug_key" ON "Restaurant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Creator_igUserId_key" ON "Creator"("igUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Reel_igMediaId_key" ON "Reel"("igMediaId");

-- CreateIndex
CREATE INDEX "Reel_restaurantId_idx" ON "Reel"("restaurantId");

-- CreateIndex
CREATE INDEX "Reel_creatorId_idx" ON "Reel"("creatorId");

-- CreateIndex
CREATE INDEX "ReelMetricSnapshot_day_idx" ON "ReelMetricSnapshot"("day");

-- CreateIndex
CREATE UNIQUE INDEX "ReelMetricSnapshot_reelId_day_key" ON "ReelMetricSnapshot"("reelId", "day");
