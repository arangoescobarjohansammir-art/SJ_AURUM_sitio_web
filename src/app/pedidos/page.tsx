"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { formatCOP } from "@/lib/money";
import { useShop } from "@/components/shop-provider";
type Order = {
  id: string;
  number: string;
  status: "RESERVED" | "CANCELLED" | "EXPIRED";
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
    lock = useRef(false);
  async function load() {
    const result = await api<{ orders: Order[] }>("/api/orders");
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
  return (
    <main id="contenido" className="container page">
      <p className="eyebrow">Tu experiencia AURUM</p>
      <h1>Pedidos de prueba</h1>
      <p className="notice">
        Solo aparecen los pedidos de este navegador. Las reservas duran 15
        minutos; no representan compras, pagos ni envíos. Horarios de Colombia.
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
            <p>
              {date(o.createdAt)} · {o.shippingLabel}
            </p>
            {o.items.map((i, n) => (
              <p key={n}>
                {i.productName} · {i.variantLabel} × {i.quantity}
              </p>
            ))}
            {o.status === "RESERVED" && (
              <>
                <p>Vence: {date(o.expiresAt)}</p>
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
