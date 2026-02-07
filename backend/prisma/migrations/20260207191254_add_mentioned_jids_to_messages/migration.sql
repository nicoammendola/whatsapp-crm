-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "mentionedJids" TEXT[] DEFAULT ARRAY[]::TEXT[];
