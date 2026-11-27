"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useShop } from "@/components/shop-provider";
import { api, ApiError, type CartLine } from "@/lib/api-client";
import { formatCOP } from "@/lib/money";
import {
  recipientSchema,
  type OrderInput,
} from "@/modules/commerce/validation";
type Rate = { id: string; department: string; city: string; amount: number };
type Quote = {
  items: CartLine[];
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  shippingLabel: string;
  quoteHash: string;
};
const example = {
  name: "Cliente de ejemplo",
  email: "cliente@example.invalid",
  phone: "3000000000",
  address: "Dirección ficticia de prueba 123",
  additional: "No enviar. Pedido de ejemplo.",
};
export default function Page() {
  const { ready, cart, refresh } = useShop(),
    router = useRouter();
  const [rates, setRates] = useState<Rate[]>([]),
    [rate, setRate] = useState(""),
    [coupon, setCoupon] = useState(""),
    [recipient, setRecipient] = useState(example),
    [quote, setQuote] = useState<Quote | null>(null),
    [accepted, setAccepted] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [uncertain, setUncertain] = useState(false);
  const attempt = useRef<OrderInput | null>(null),
    lock = useRef(false);
  useEffect(() => {
    void api<{ rates: Rate[] }>("/api/shipping")
      .then((r) => setRates(r.rates))
      .catch((e) => setError(e.message));
  }, []);
  async function review(e: React.FormEvent) {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const parsed = recipientSchema.safeParse(recipient);
      if (!parsed.success)
        throw Error(
          "Revisa el nombre, correo, celular y dirección de ejemplo.",
        );
      const q = await api<Quote>("/api/checkout/quote", "POST", {
        shippingRateId: rate,
        coupon,
      });
      attempt.current = {
        shippingRateId: rate,
        coupon,
        recipient: parsed.data,
        quoteHash: q.quoteHash,
        idempotencyKey: crypto.randomUUID(),
        acceptedDemo: true,
      };
      setQuote(q);
      setAccepted(false);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No pudimos preparar el resumen.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function confirm() {
    if (lock.current || !accepted || !attempt.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await api("/api/orders", "POST", attempt.current);
      attempt.current = null;
      await refresh().catch(() => {});
      router.push("/pedidos");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos confirmar.");
      if (!(e instanceof ApiError) || e.status >= 500) {
        setUncertain(true);
      } else {
        setUncertain(false);
        setQuote(null);
        attempt.current = null;
      }
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <main id="contenido" className="container page">
      <p className="eyebrow">Experiencia de ejemplo</p>
      <h1>Revisa tu pedido</h1>
      <p className="notice">
        Prueba con los datos ficticios precargados. No ingreses información
        personal real. No hay pagos ni envíos.
      </p>
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      {!ready ? (
        <p role="status">Conectando…</p>
      ) : !cart.length && !quote ? (
        <div className="empty-state">
          <p>Tu bolsa está vacía.</p>
          <Link href="/pedidos">Ver pedidos</Link> ·{" "}
          <Link href="/catalogo">Explorar colección</Link>
        </div>
      ) : quote ? (
        <div className="bag-grid">
          <section>
            <h2>Todo listo para revisar</h2>
            <p>
              {recipient.name} · {recipient.email}
            </p>
            <p>
              {recipient.address} · {quote.shippingLabel}
            </p>
            {quote.items.map((l) => (
              <article className="review-line" key={l.variantId}>
                <span>
                  {l.name} · {l.label} × {l.quantity}
                </span>
                <strong>{formatCOP(l.unitPrice * l.quantity)}</strong>
              </article>
            ))}
            {!uncertain && (
              <button
                disabled={busy}
                className="text-button"
                onClick={() => {
                  setQuote(null);
                  attempt.current = null;
                }}
              >
                Editar datos
              </button>
            )}
          </section>
          <aside className="order-summary">
            <h2>Resumen de prueba</h2>
            <div>
              <span>Subtotal</span>
              <strong>{formatCOP(quote.subtotal)}</strong>
            </div>
            <div>
              <span>Descuento</span>
              <strong>−{formatCOP(quote.discount)}</strong>
            </div>
            <div>
              <span>Envío ilustrativo</span>
              <strong>{formatCOP(quote.shipping)}</strong>
            </div>
            <div>
              <span>Total de ejemplo</span>
              <strong>{formatCOP(quote.total)} COP</strong>
            </div>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                disabled={busy}
              />
              Entiendo que es una reserva de prueba, sin cobro ni envío.
            </label>
            {uncertain && (
              <p role="status">
                No se pudo verificar el resultado. Reintenta con el mismo pedido
                o consulta tus pedidos antes de empezar otro.
              </p>
            )}
            <button
              className="button"
              disabled={busy || !accepted}
              onClick={confirm}
            >
              {busy
                ? "Guardando…"
                : uncertain
                  ? "Reintentar confirmación"
                  : "Crear reserva de prueba"}
            </button>
            <Link href="/pedidos">Consultar mis pedidos</Link>
          </aside>
        </div>
      ) : (
        <form className="checkout-form" onSubmit={review}>
          <fieldset disabled={busy}>
            <legend>1. Datos ficticios del destinatario</legend>
            {(
              [
                { key: "name", label: "Nombre", type: "text", max: 100 },
                {
                  key: "email",
                  label: "Correo de ejemplo",
                  type: "email",
                  max: 254,
                },
                {
                  key: "phone",
                  label: "Celular de ejemplo",
                  type: "tel",
                  max: 13,
                },
                {
                  key: "address",
                  label: "Dirección ficticia",
                  type: "text",
                  max: 200,
                },
              ] as const
            ).map((f) => (
              <label key={f.key}>
                {f.label}
                <input
                  required
                  type={f.type}
                  maxLength={f.max}
                  value={recipient[f.key]}
                  onChange={(e) =>
                    setRecipient({ ...recipient, [f.key]: e.target.value })
                  }
                />
              </label>
            ))}
          </fieldset>
          <fieldset disabled={busy}>
            <legend>2. Destino y cupón de ejemplo</legend>
            <label>
              Ciudad y departamento
              <select
                required
                value={rate}
                onChange={(e) => setRate(e.target.value)}
              >
                <option value="">Elige un destino</option>
                {rates.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.city}, {r.department} · {formatCOP(r.amount)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Cupón opcional
              <input
                maxLength={40}
                value={coupon}
                onChange={(e) => setCoupon(e.target.value)}
                placeholder="EJEMPLO10"
              />
            </label>
            <p className="muted">
              EJEMPLO10: 10 % en productos desde $50.000, sujeto a
              disponibilidad de prueba. Tarifas ilustrativas.
            </p>
          </fieldset>
          <button className="button" disabled={busy || !rates.length}>
            {busy ? "Calculando…" : "Revisar resumen"}
          </button>
        </form>
      )}
    </main>
  );
}
