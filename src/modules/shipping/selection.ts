export const shippingSelection = {
  enviaShipment: { select: { providerStatus: true, checkedAt: true } },
  shippingCarrier: true,
  shippingEstimate: true,
  shippingStatus: true,
  trackingNumber: true,
  shippingEvents: {
    select: { id: true, status: true, note: true, createdAt: true },
    orderBy: { createdAt: "asc" as const },
    take: 100,
  },
} as const;
