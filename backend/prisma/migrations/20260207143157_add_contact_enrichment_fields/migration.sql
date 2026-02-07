-- AlterTable
ALTER TABLE "contacts" ADD COLUMN     "birthday" TIMESTAMP(3),
ADD COLUMN     "company" TEXT,
ADD COLUMN     "contactFrequency" TEXT,
ADD COLUMN     "customFields" JSONB,
ADD COLUMN     "importance" INTEGER DEFAULT 0,
ADD COLUMN     "interactionCount30d" INTEGER DEFAULT 0,
ADD COLUMN     "interactionCount7d" INTEGER DEFAULT 0,
ADD COLUMN     "interactionCount90d" INTEGER DEFAULT 0,
ADD COLUMN     "jobTitle" TEXT,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "relationshipType" TEXT;

-- CreateIndex
CREATE INDEX "contacts_userId_relationshipType_idx" ON "contacts"("userId", "relationshipType");
