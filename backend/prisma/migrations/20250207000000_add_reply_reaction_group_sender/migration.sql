-- AlterTable
ALTER TABLE "messages" ADD COLUMN "quotedMessageId" TEXT,
ADD COLUMN "quotedContent" TEXT,
ADD COLUMN "senderJid" TEXT,
ADD COLUMN "senderName" TEXT,
ADD COLUMN "senderPhone" TEXT;

-- CreateTable
CREATE TABLE "reactions" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "fromMe" BOOLEAN NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reactions_messageId_fromMe_key" ON "reactions"("messageId", "fromMe");

-- CreateIndex
CREATE INDEX "reactions_messageId_idx" ON "reactions"("messageId");

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_quotedMessageId_fkey" FOREIGN KEY ("quotedMessageId") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
