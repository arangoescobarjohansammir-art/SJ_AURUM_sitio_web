ALTER TABLE "ShippingRate" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN "carrier" TEXT NOT NULL DEFAULT 'Transportadora de ejemplo',
 ADD COLUMN "minDays" INTEGER NOT NULL DEFAULT 2, ADD COLUMN "maxDays" INTEGER NOT NULL DEFAULT 5,
 ADD CONSTRAINT "ShippingRate_days" CHECK ("minDays" >= 1 AND "maxDays" >= "minDays" AND "maxDays" <= 60);
ALTER TABLE "Order" ADD COLUMN "shippingCarrier" TEXT NOT NULL DEFAULT 'Por definir',
 ADD COLUMN "shippingEstimate" TEXT NOT NULL DEFAULT 'Por definir',
 ADD COLUMN "shippingStatus" TEXT NOT NULL DEFAULT 'PENDING', ADD COLUMN "trackingNumber" TEXT NOT NULL DEFAULT '',
 ADD CONSTRAINT "Order_shipping_status" CHECK ("shippingStatus" IN ('PENDING','PREPARING','SHIPPED','DELIVERED','ISSUE','RETURNED'));
CREATE TABLE "ShippingEvent" (
 "id" TEXT PRIMARY KEY, "orderId" TEXT NOT NULL REFERENCES "Order"("id") ON DELETE RESTRICT,
 "status" TEXT NOT NULL CHECK ("status" IN ('PENDING','PREPARING','SHIPPED','DELIVERED','ISSUE','RETURNED')),
 "note" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "ShippingEvent_orderId_createdAt_idx" ON "ShippingEvent"("orderId","createdAt");
