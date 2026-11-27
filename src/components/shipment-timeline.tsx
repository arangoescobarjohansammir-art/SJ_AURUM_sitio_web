import {
  shippingStates,
  type ShippingView,
} from "@/modules/shipping/validation";
export function ShipmentTimeline({ shipment: s }: { shipment: ShippingView }) {
  return (
    <section aria-label="Seguimiento del envío">
      {s.enviaShipment?.providerStatus && (
        <p>
          Envia Sandbox: {s.enviaShipment.providerStatus}
          {s.enviaShipment.checkedAt &&
            " · consultado " +
              new Date(s.enviaShipment.checkedAt).toLocaleString("es-CO", {
                timeZone: "America/Bogota",
              })}
        </p>
      )}
      <h3>Envío de ejemplo · {shippingStates[s.shippingStatus]}</h3>
      <p>
        {s.shippingCarrier} · {s.shippingEstimate}
      </p>
      {s.trackingNumber && (
        <p>
          Guía: <strong>{s.trackingNumber}</strong>
        </p>
      )}
      <p className="muted">
        Seguimiento manual de prueba; no representa un despacho real.
      </p>
      <ol>
        {s.shippingEvents.map((e) => (
          <li key={e.id}>
            <strong>{shippingStates[e.status]}</strong> ·{" "}
            {new Date(e.createdAt).toLocaleString("es-CO", {
              timeZone: "America/Bogota",
            })}
            <p>{e.note}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
