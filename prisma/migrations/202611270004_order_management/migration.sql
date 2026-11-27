ALTER TABLE "Order" ADD COLUMN "followUp" TEXT NOT NULL DEFAULT 'PENDING', ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD CONSTRAINT "Order_followUp_check" CHECK ("followUp" IN ('PENDING', 'REVIEWED', 'ISSUE', 'RESOLVED'));
CREATE INDEX "Order_demo_createdAt_idx" ON "Order"("demo", "createdAt");
