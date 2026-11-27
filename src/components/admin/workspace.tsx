"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api-client";
import { formatCOP } from "@/lib/money";
import { useShop } from "@/components/shop-provider";
import type { AdminProduct, Audit } from "@/modules/admin/validation";
import { ProductForm, VariantForm, StockForm } from "./forms";
type Listing = {
  products: AdminProduct[];
  page: number;
  pages: number;
  total: number;
};
type Detail = { product: AdminProduct; audits: Audit[] };
const labels: Record<string, string> = {
  PRODUCT_CREATE: "Producto creado",
  PRODUCT_EDIT: "Ficha editada",
  VARIANT_CREATE: "Variante creada",
  VARIANT_EDIT: "Variante editada",
  STOCK_ADJUST: "Stock ajustado",
};
const fieldLabels: Record<string, string> = {
  name: "Nombre",
  slug: "Enlace",
  category: "Categoría",
  description: "Descripción",
  image: "Imagen",
  gallery: "Galería",
  active: "Activo",
  sku: "SKU",
  label: "Variante",
  price: "Precio COP",
  stock: "Stock total",
  reserved: "Reservadas",
};
const readable = (value: unknown) =>
  typeof value === "boolean"
    ? value
      ? "Sí"
      : "No"
    : Array.isArray(value)
      ? value.join(", ")
      : String(value ?? "—");
export function AdminWorkspace() {
  const { refresh } = useShop(),
    [listing, setListing] = useState<Listing | null>(null),
    [query, setQuery] = useState(""),
    [applied, setApplied] = useState(""),
    [detail, setDetail] = useState<Detail | null>(null),
    [creating, setCreating] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [conflict, setConflict] = useState(false),
    [revision, setRevision] = useState(0),
    lock = useRef(false),
    listRequest = useRef(0);
  async function load(page = 1, search = applied) {
    const request = ++listRequest.current;
    const data = await api<Listing>(
      "/api/admin/products?" +
        new URLSearchParams({ query: search, page: String(page) }),
    );
    if (request === listRequest.current) setListing(data);
  }
  useEffect(() => {
    void load(1, "").catch((e) => setError(e.message));
  }, []);
  async function read(id: string) {
    const data = await api<Detail>("/api/admin/products/" + id);
    setDetail(data);
    setRevision((n) => n + 1);
    setConflict(false);
  }
  async function open(id: string) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await read(id);
      setCreating(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos abrir la ficha.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function save(path: string, method: string, data: unknown) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await api<{ id?: string }>(path, method, data);
      const id = detail?.product.id ?? result.id;
      setMessage("Cambio registrado correctamente.");
      setCreating(false);
      if (id) await read(id);
      await load();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos guardar.");
      if (e instanceof ApiError && e.code === "EDIT_CONFLICT")
        setConflict(true);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const p = detail?.product;
  return (
    <>
      <div className="admin-toolbar">
        <Link href="/cuenta">Mi cuenta</Link>
        <button
          disabled={busy}
          className="text-button"
          onClick={() => {
            setDetail(null);
            setCreating(false);
            setError("");
            setMessage("");
            void load().catch((e) => setError(e.message));
          }}
        >
          Volver al listado
        </button>
        <button
          disabled={busy}
          className="button secondary"
          onClick={() => {
            setDetail(null);
            setCreating(true);
            setError("");
            setMessage("");
          }}
        >
          Nuevo producto
        </button>
      </div>
      {error && (
        <div className="notice" role="alert">
          {error}
          {conflict && p && (
            <button className="text-button" onClick={() => open(p.id)}>
              Recargar y descartar edición anterior
            </button>
          )}
        </div>
      )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {creating ? (
        <ProductForm
          busy={busy}
          onSave={(data) => save("/api/admin/products", "POST", data)}
        />
      ) : p ? (
        <>
          <div className="section-heading">
            <h2>{p.name}</h2>
            <span>{p.active ? "Visible" : "Oculto"} · Ejemplo</span>
          </div>
          {p.active && (
            <p>
              <Link className="text-link" href={"/producto/" + p.slug}>
                Ver ficha pública
              </Link>
            </p>
          )}
          <ProductForm
            key={p.id + "-" + revision}
            product={p}
            busy={busy || conflict}
            onSave={(data) =>
              save("/api/admin/products/" + p.id, "PATCH", data)
            }
          />
          <h2 className="section">Variantes e inventario</h2>
          {p.variants.map((v) => (
            <section className="admin-variant" key={v.id + "-" + revision}>
              <h3>
                {v.label} · {v.sku}
              </h3>
              <div className="account-grid">
                <VariantForm
                  variant={v}
                  busy={busy || conflict}
                  onSave={(data) =>
                    save("/api/admin/variants/" + v.id, "PATCH", data)
                  }
                />
                <StockForm
                  variant={v}
                  busy={busy || conflict}
                  onSave={(data) =>
                    save("/api/admin/variants/" + v.id + "/stock", "POST", data)
                  }
                />
              </div>
            </section>
          ))}
          <details className="admin-add">
            <summary>Añadir una variante</summary>
            <VariantForm
              key={"new-" + revision}
              busy={busy || conflict}
              onSave={(data) =>
                save("/api/admin/products/" + p.id + "/variants", "POST", data)
              }
            />
          </details>
          <section className="section">
            <h2>Historial de cambios</h2>
            <p>
              Últimos 50 cambios de esta ficha y sus variantes. Horario de
              Colombia.
            </p>
            {detail.audits.length ? (
              detail.audits.map((a) => (
                <article className="admin-audit" key={a.id}>
                  <h3>{labels[a.action] ?? a.action}</h3>
                  <p>
                    {a.actor.name} ·{" "}
                    {new Intl.DateTimeFormat("es-CO", {
                      dateStyle: "short",
                      timeStyle: "short",
                      timeZone: "America/Bogota",
                    }).format(new Date(a.createdAt))}
                  </p>
                  <p>{a.reason}</p>
                  <details>
                    <summary>Ver valores anteriores y nuevos</summary>
                    <dl>
                      {Object.keys(fieldLabels)
                        .filter(
                          (k) =>
                            JSON.stringify(a.before[k]) !==
                            JSON.stringify(a.after[k]),
                        )
                        .map((k) => (
                          <div key={k}>
                            <dt>{fieldLabels[k]}</dt>
                            <dd>
                              {readable(a.before[k])} → {readable(a.after[k])}
                            </dd>
                          </div>
                        ))}
                    </dl>
                  </details>
                </article>
              ))
            ) : (
              <p>
                Esta ficha aún no tiene cambios administrativos registrados.
              </p>
            )}
          </section>
        </>
      ) : (
        <>
          <form
            className="admin-search"
            onSubmit={(e) => {
              e.preventDefault();
              setApplied(query);
              setError("");
              void load(1, query).catch((e) => setError(e.message));
            }}
          >
            <label>
              Buscar por nombre, enlace o SKU
              <input
                type="search"
                maxLength={100}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <button className="button secondary">Buscar</button>
          </form>
          {!listing ? (
            <p role="status">Cargando catálogo…</p>
          ) : (
            <>
              <p role="status">
                {listing.total} productos de ejemplo · Página {listing.page} de{" "}
                {listing.pages}
              </p>
              <div className="admin-list">
                {listing.products.map((product) => (
                  <article className="admin-product" key={product.id}>
                    <div>
                      <h2>{product.name}</h2>
                      <p>
                        {product.category} ·{" "}
                        {product.active ? "Visible" : "Oculto"}
                      </p>
                      <p>
                        {product.variants.length} variantes ·{" "}
                        {formatCOP(product.variants[0]?.price ?? 0)}
                      </p>
                      <p>
                        Disponibles:{" "}
                        {product.variants.reduce(
                          (sum, v) => sum + v.stock - v.reserved,
                          0,
                        )}{" "}
                        · Reservadas:{" "}
                        {product.variants.reduce(
                          (sum, v) => sum + v.reserved,
                          0,
                        )}
                      </p>
                    </div>
                    <button
                      disabled={busy}
                      className="button secondary"
                      onClick={() => open(product.id)}
                    >
                      Administrar {product.name}
                    </button>
                  </article>
                ))}
              </div>
              {!listing.products.length && (
                <p>No hay productos para esa búsqueda.</p>
              )}
              <div className="admin-toolbar">
                <button
                  className="text-button"
                  disabled={busy || listing.page <= 1}
                  onClick={() =>
                    void load(listing.page - 1).catch((e) =>
                      setError(e.message),
                    )
                  }
                >
                  Anterior
                </button>
                <button
                  className="text-button"
                  disabled={busy || listing.page >= listing.pages}
                  onClick={() =>
                    void load(listing.page + 1).catch((e) =>
                      setError(e.message),
                    )
                  }
                >
                  Siguiente
                </button>
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
