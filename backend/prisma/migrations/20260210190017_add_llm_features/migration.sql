-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ScheduledMessageStatus" ADD VALUE 'llmSuggested';
ALTER TYPE "ScheduledMessageStatus" ADD VALUE 'userRejected';

-- AlterTable
ALTER TABLE "contacts" ADD COLUMN     "analysisVersion" TEXT DEFAULT '1.0',
ADD COLUMN     "averageMessageLength" VARCHAR(20),
ADD COLUMN     "conversationBalance" INTEGER,
ADD COLUMN     "conversationSummary" TEXT,
ADD COLUMN     "engagementLevel" VARCHAR(20),
ADD COLUMN     "lastLlmAnalysis" TIMESTAMP(3),
ADD COLUMN     "primaryTopics" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "relationshipDepth" INTEGER,
ADD COLUMN     "responseSpeed" VARCHAR(20),
ADD COLUMN     "sharedInterests" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "tone" VARCHAR(20),
ADD COLUMN     "warmth" INTEGER;

-- AlterTable
ALTER TABLE "scheduled_messages" ADD COLUMN     "llmConfidence" DOUBLE PRECISION,
ADD COLUMN     "llmReasoning" TEXT;

-- CreateTable
CREATE TABLE "user_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "anthropicApiKeyEncrypted" TEXT,
    "anthropicModel" TEXT NOT NULL DEFAULT 'claude-sonnet-4-5-20250929',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_settings_userId_key" ON "user_settings"("userId");

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
