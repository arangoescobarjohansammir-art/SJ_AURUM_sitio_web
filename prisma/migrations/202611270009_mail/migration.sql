CREATE TABLE "MailOutbox" (
"id" TEXT PRIMARY KEY,"eventKey" TEXT NOT NULL UNIQUE,"orderId" TEXT NOT NULL,"mode" TEXT NOT NULL,"sender" TEXT NOT NULL,"recipient" TEXT NOT NULL,"subject" TEXT NOT NULL,"text" TEXT NOT NULL,"html" TEXT NOT NULL,
"status" TEXT NOT NULL DEFAULT 'PENDING',"attempts" INTEGER NOT NULL DEFAULT 0,"nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"lockedUntil" TIMESTAMP(3),"firstAttemptAt" TIMESTAMP(3),"providerId" TEXT,"lastError" TEXT,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"sentAt" TIMESTAMP(3)
);
CREATE INDEX "MailOutbox_status_nextAttemptAt_idx" ON "MailOutbox"("status","nextAttemptAt");
