"use client";
import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import { formatCOP } from "@/lib/money";
import { paymentLabels } from "@/modules/payments/labels";
import {
  followUps,
  orderStates,
  type OrderListing,
  type OrderView,
} from "@/modules/admin/orders-validation";
const date = (v: string) =>
  new Date(v).toLocaleString("es-CO", { timeZone: "America/Bogota" });
export function OrdersWorkspace() {
  const [list, setList] = useState<OrderListing | null>(null),
    [view, setView] = useState<OrderView | null>(null),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState(""),
    [follow, setFollow] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [conflict, setConflict] = useState(false);
  const lock = useRef(false),
    filters = useRef({ query: "", status: "", followUp: "" }),
    sequence = useRef(0);
  async function load(page = 1) {
    const seq = ++sequence.current;
    const result = await api<OrderListing>(
      "/api/admin/orders?" +
        new URLSearchParams({ ...filters.current, page: String(page) }),
    );
    if (seq === sequence.current) setList(result);
  }
  async function read(id: string) {
    const result = await api<OrderView>("/api/admin/orders/" + id);
    setView(result);
    setConflict(false);
  }
  async function run(fn: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No pudimos completar la operación.",
      );
      if (e instanceof ApiError && e.status === 409) setConflict(true);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  useEffect(() => {
    void run(() => load());
  }, []);
  async function save(form: HTMLFormElement, action: "FOLLOW_UP" | "CANCEL") {
    if (!view) return;
    const data = new FormData(form),
      id = view.order.id;
    await api("/api/admin/orders/" + id, "PATCH", {
      action,
      expectedVersion: view.order.version,
      reason: data.get("reason"),
      ...(action === "FOLLOW_UP" ? { followUp: data.get("followUp") } : {}),
    });
    setMessage(
      action === "CANCEL"
        ? "Reserva cancelada; unidades liberadas."
        : "Seguimiento guardado.",
    );
    form.reset();
    await read(id);
    await load(list?.page);
  }
  return (
    <section aria-label="Gestión de pedidos" aria-busy={busy}>
      {error && (
        <p role="alert" className="notice">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      {view ? (
        <>
          <div className="admin-toolbar">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => {
                setView(null);
                setConflict(false);
                setError("");
                setMessage("");
              }}
            >
              Volver a pedidos
            </button>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => void run(() => read(view.order.id))}
            >
              Recargar pedido
            </button>
          </div>
          {conflict && (
            <p className="notice">
              Recarga el pedido para revisar los últimos cambios antes de volver
              a guardar.
            </p>
          )}
          <h2 className="order-number">{view.order.number}</h2>
          <p>
            <strong>{orderStates[view.order.status]}</strong> ·{" "}
            {followUps[view.order.followUp]}
          </p>
          <p>
            Creado: {date(view.order.createdAt)} · Vencimiento:{" "}
            {date(view.order.expiresAt)} (hora de Colombia)
          </p>
          <div className="account-grid">
            <section className="account-panel">
              <h3>Destinatario</h3>
              <p>{view.order.recipient.name}</p>
              <p className="order-number">{view.order.recipient.email}</p>
              <p>{view.order.recipient.phone}</p>
              <p>{view.order.recipient.address}</p>
              <p>{view.order.recipient.additional}</p>
              <p>{view.order.shippingLabel}</p>
            </section>
            <section className="account-panel">
              <h3>Importes del pedido</h3>
              <p>Productos: {formatCOP(view.order.subtotal)}</p>
              <p>Descuento: −{formatCOP(view.order.discount)}</p>
              <p>Envío: {formatCOP(view.order.shipping)}</p>
              <p>
                <strong>Total: {formatCOP(view.order.total)}</strong>
              </p>
              {view.order.couponCode && <p>Cupón: {view.order.couponCode}</p>}
              <p>Sin pago real.</p>
            </section>
          </div>
          <h3>Productos reservados</h3>
          {view.order.payment && (
            <section className="account-panel">
              <h3>Pago Wompi Sandbox</h3>
              <p>{paymentLabels[view.order.payment.status]}</p>
              <p className="order-number">
                Transacción:{" "}
                {view.order.payment.transactionId ??
                  "Sin transacción confirmada"}
              </p>
              {view.order.payment.refund && (
                <p role="status">
                  Reembolso:{" "}
                  {paymentLabels[view.order.payment.refund.status] ??
                    view.order.payment.refund.status}
                  . Los resultados pendientes o sin confirmar se revisan en
                  Wompi antes de volver a solicitar.
                </p>
              )}
              {view.order.status === "PAYMENT_REVIEW" && (
                <p className="notice">
                  Pago recibido fuera de la reserva. No despachar: las unidades
                  fueron liberadas. Revisa el reembolso.
                </p>
              )}
              {["PAID", "PAYMENT_REVIEW"].includes(view.order.status) &&
                view.order.payment.status === "APPROVED" &&
                !view.order.payment.refund && (
                  <form
                    className="checkout-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const reason = new FormData(e.currentTarget).get(
                        "reason",
                      );
                      const id = view.order.id;
                      void run(async () => {
                        try {
                          await api(
                            "/api/admin/orders/" + id + "/refund",
                            "POST",
                            { reason },
                          );
                          setMessage(
                            "Solicitud de reembolso de prueba procesada.",
                          );
                        } finally {
                          await read(id);
                          await load(list?.page);
                        }
                      });
                    }}
                  >
                    <label>
                      Motivo del reembolso total
                      <textarea
                        name="reason"
                        required
                        minLength={8}
                        maxLength={500}
                      />
                    </label>
                    <label className="checkbox">
                      <input type="checkbox" required /> Confirmo el reembolso
                      total de prueba de {formatCOP(view.order.total)}.
                    </label>
                    <p>
                      El reembolso no repone existencias automáticamente. Revisa
                      la devolución física antes de ajustar inventario.
                    </p>
                    <button className="button secondary" disabled={busy}>
                      Solicitar reembolso de prueba
                    </button>
                  </form>
                )}
            </section>
          )}
          <div className="admin-list">
            {view.order.items.map((item) => (
              <article className="account-panel" key={item.sku}>
                <strong>{item.productName}</strong>
                <p>
                  {item.variantLabel} ·{" "}
                  <span className="order-number">{item.sku}</span>
                </p>
                <p>
                  {item.quantity} × {formatCOP(item.unitPrice)} ={" "}
                  {formatCOP(item.quantity * item.unitPrice)}
                </p>
              </article>
            ))}
          </div>
          <div className="account-grid">
            <form
              className="account-panel checkout-form admin-form"
              key={view.order.id + ":" + view.order.version}
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                void run(() => save(form, "FOLLOW_UP"));
              }}
            >
              <h3>Seguimiento interno</h3>
              <label>
                Estado de revisión
                <select name="followUp" defaultValue={view.order.followUp}>
                  {Object.entries(followUps).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Nota o motivo
                <textarea
                  name="reason"
                  required
                  minLength={8}
                  maxLength={1000}
                  rows={4}
                  placeholder="Describe la revisión o incidencia…"
                />
              </label>
              <button className="button" disabled={busy || conflict}>
                Guardar seguimiento
              </button>
            </form>
            {view.order.status === "RESERVED" && (
              <form
                className="account-panel checkout-form admin-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  void run(() => save(form, "CANCEL"));
                }}
              >
                <h3>Cancelar reserva</h3>
                <p>
                  Libera las unidades y el uso del cupón. La cancelación no se
                  puede revertir.
                </p>
                <label>
                  Motivo
                  <textarea
                    name="reason"
                    required
                    minLength={8}
                    maxLength={1000}
                    rows={3}
                  />
                </label>
                <label className="checkbox">
                  <input type="checkbox" required /> Confirmo la cancelación de
                  esta reserva de prueba.
                </label>
                <button
                  className="button secondary"
                  disabled={busy || conflict}
                >
                  Cancelar reserva
                </button>
              </form>
            )}
          </div>
          <h3>Historial administrativo</h3>
          <p>Últimas 100 entradas. Las notas son privadas del equipo.</p>
          {!view.history.length && <p>Aún no hay notas administrativas.</p>}
          <ol className="admin-audit-list">
            {view.history.map((h) => (
              <li className="account-panel" key={h.id}>
                <strong>
                  {h.action === "ORDER_CANCEL"
                    ? "Cancelación"
                    : h.action === "PAYMENT_REFUND"
                      ? "Reembolso solicitado"
                      : "Seguimiento"}{" "}
                  · {h.actor.name}
                </strong>
                <p>{date(h.createdAt)}</p>
                <p>
                  {orderStates[h.before.status]} → {orderStates[h.after.status]}{" "}
                  · {followUps[h.before.followUp]} →{" "}
                  {followUps[h.after.followUp]}
                </p>
                <p className="order-note">{h.reason}</p>
              </li>
            ))}
          </ol>
          <h3>Movimientos de reserva</h3>
          <ul>
            {view.order.movements.map((m) => (
              <li key={m.id}>
                {date(m.createdAt)} ·{" "}
                {m.kind === "RESERVE"
                  ? "Reserva"
                  : m.kind === "SALE"
                    ? "Venta de prueba"
                    : "Liberación"}
                : {m.quantity} unidades · {m.reason}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <form
            className="checkout-form admin-form admin-order-filters"
            onSubmit={(e) => {
              e.preventDefault();
              filters.current = { query, status, followUp: follow };
              void run(() => load());
            }}
          >
            <label>
              Buscar por número, nombre o correo
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                maxLength={100}
                placeholder="Número de pedido o destinatario"
              />
            </label>
            <label>
              Reserva
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">Todos los estados</option>
                {Object.entries(orderStates).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Seguimiento
              <select
                value={follow}
                onChange={(e) => setFollow(e.target.value)}
              >
                <option value="">Todo el seguimiento</option>
                {Object.entries(followUps).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <button className="button" disabled={busy}>
              Buscar pedidos
            </button>
          </form>
          {!list && <p role="status">Cargando pedidos…</p>}
          {list && (
            <>
              <p role="status">
                {list.total} pedidos · Página {list.page} de {list.pages}
              </p>
              {list.orders.length === 0 && (
                <p>No hay pedidos que coincidan con los filtros.</p>
              )}
              <div className="admin-list">
                {list.orders.map((o) => (
                  <article className="account-panel" key={o.id}>
                    <h3 className="order-number">{o.number}</h3>
                    <p>{date(o.createdAt)}</p>
                    <p>
                      {orderStates[o.status]} · {followUps[o.followUp]}
                    </p>
                    <p>
                      {formatCOP(o.total)} · {o.shippingLabel}
                    </p>
                    <button
                      className="button secondary"
                      disabled={busy}
                      onClick={() => void run(() => read(o.id))}
                    >
                      Ver pedido
                    </button>
                  </article>
                ))}
              </div>
              <div className="admin-toolbar">
                <button
                  className="button secondary"
                  disabled={busy || list.page <= 1}
                  onClick={() => void run(() => load(list.page - 1))}
                >
                  Anterior
                </button>
                <button
                  className="button secondary"
                  disabled={busy || list.page >= list.pages}
                  onClick={() => void run(() => load(list.page + 1))}
                >
                  Siguiente
                </button>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
