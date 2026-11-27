"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Script from "next/script";
import type { WidgetOptions } from "@/modules/payments/widget-types";
import { api } from "@/lib/api-client";
import { formatCOP } from "@/lib/money";
import { useShop } from "@/components/shop-provider";
import { orderStates } from "@/modules/admin/orders-validation";
import { paymentLabels } from "@/modules/payments/labels";
import { ShipmentTimeline } from "@/components/shipment-timeline";
type Order = import("@/modules/shipping/validation").ShippingView & {
  id: string;
  number: string;
  status: keyof typeof orderStates;
  payment: {
    status: string;
    transactionId: string | null;
    refund: { status: string } | null;
  } | null;
  total: number;
  shippingLabel: string;
  expiresAt: string;
  createdAt: string;
  items: {
    productName: string;
    variantLabel: string;
    quantity: number;
    unitPrice: number;
  }[];
};
const states = {
  ...orderStates,
  RESERVED: "Reserva de prueba",
  CANCELLED: "Cancelado",
  EXPIRED: "Reserva vencida",
};
const date = (s: string) =>
  new Intl.DateTimeFormat("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Bogota",
  }).format(new Date(s));
export default function Page() {
  const { ready, refresh } = useShop(),
    [orders, setOrders] = useState<Order[]>([]),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [paymentsEnabled, setPaymentsEnabled] = useState(false),
    [widgetReady, setWidgetReady] = useState(false),
    lock = useRef(false);
  async function load() {
    const result = await api<{ orders: Order[]; paymentsEnabled: boolean }>(
      "/api/orders",
    );
    setPaymentsEnabled(result.paymentsEnabled);
    setOrders(result.orders);
    setLoaded(true);
    setError("");
  }
  useEffect(() => {
    if (ready) void load().catch((e) => setError(e.message));
  }, [ready]);
  async function cancel(id: string) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      await api(
        "/api/orders/" + encodeURIComponent(id) + "/cancel",
        "POST",
        {},
      );
      await load();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos cancelar.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function pay(order: Order, sync = false) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      if (sync && order.payment?.transactionId) {
        await api("/api/payments/sync", "POST", {
          id: order.payment.transactionId,
        });
        await load();
        await refresh();
      } else {
        if (!window.WidgetCheckout)
          throw Error(
            "No se pudo cargar Wompi. Recarga la página o revisa tu conexión.",
          );
        const result = await api<{ widget: WidgetOptions }>(
          "/api/orders/" + encodeURIComponent(order.id) + "/payment",
          "POST",
          {},
        );
        const checkout = new window.WidgetCheckout(result.widget);
        checkout.open((result) => {
          const id = result.transaction?.id;
          if (!id) return;
          void api("/api/payments/sync", "POST", { id })
            .then(async () => {
              await load();
              await refresh();
            })
            .catch((e) =>
              setError(
                e instanceof Error
                  ? e.message
                  : "No pudimos confirmar el pago.",
              ),
            );
        });
        await load();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos consultar Wompi.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <main id="contenido" className="container page">
      {paymentsEnabled && (
        <Script
          src="https://checkout.wompi.co/widget.js"
          onReady={() => setWidgetReady(true)}
          onError={() =>
            setError(
              "No se pudo cargar Wompi. Revisa tu conexión y recarga la página.",
            )
          }
        />
      )}
      <p className="eyebrow">Tu experiencia AURUM</p>
      <h1>Pedidos de prueba</h1>
      <p className="notice">
        Al iniciar sesión verás los pedidos de tu cuenta; como visitante, los de
        este navegador. Las reservas duran 15 minutos y no representan compras,
        cobros reales ni envíos. Puedes simular el pago en Wompi Sandbox.
        Horarios de Colombia.
      </p>
      {error && <p role="alert">{error}</p>}
      <button
        className="text-button"
        disabled={!ready || busy}
        onClick={() => void load().catch((e) => setError(e.message))}
      >
        Actualizar estado
      </button>
      {!loaded ? (
        <p role="status">Consultando pedidos…</p>
      ) : !orders.length ? (
        <div className="empty-state">
          <h2>Aún no tienes pedidos de prueba.</h2>
          <Link href="/catalogo" className="button">
            Explorar la colección
          </Link>
        </div>
      ) : (
        orders.map((o) => (
          <article className="order-card" key={o.id}>
            <p className="eyebrow">{states[o.status]}</p>
            <h2>Tu selección · {formatCOP(o.total)}</h2>
            <p className="order-number">{o.number}</p>
            {o.payment && (
              <p>
                Wompi Sandbox:{" "}
                {paymentLabels[o.payment.status] ?? o.payment.status}
                {o.payment.refund &&
                  ` · Reembolso: ${paymentLabels[o.payment.refund.status] ?? o.payment.refund.status}`}
              </p>
            )}
            {o.status === "PAYMENT_REVIEW" && (
              <p className="notice">
                El pago llegó cuando la reserva ya había terminado. El equipo
                debe revisar el reembolso; este pedido no está listo para envío.
              </p>
            )}
            {o.payment?.transactionId && (
              <button
                className="text-button"
                disabled={busy}
                onClick={() => void pay(o, true)}
              >
                Consultar pago en Wompi
              </button>
            )}
            <p>
              {date(o.createdAt)} · {o.shippingLabel}
            </p>
            <ShipmentTimeline shipment={o} />
            {o.items.map((i, n) => (
              <p key={n}>
                {i.productName} · {i.variantLabel} × {i.quantity}
              </p>
            ))}
            {o.status === "RESERVED" && (
              <>
                <p>Vence: {date(o.expiresAt)}</p>
                {paymentsEnabled &&
                  (!o.payment || o.payment.status === "CREATED") && (
                    <button
                      className="button"
                      disabled={busy || !widgetReady}
                      onClick={() => void pay(o)}
                    >
                      {widgetReady
                        ? "Probar pago con Wompi"
                        : "Cargando Wompi…"}
                    </button>
                  )}
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => cancel(o.id)}
                >
                  {busy ? "Actualizando…" : "Cancelar reserva"}
                </button>
              </>
            )}
          </article>
        ))
      )}
      <p>
        <Link href="/bolsa" className="text-link">
          Volver a la bolsa
        </Link>
      </p>
    </main>
  );
}
