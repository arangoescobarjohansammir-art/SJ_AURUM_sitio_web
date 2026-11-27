"use client";
import { useEffect, useState } from "react";
import { ImagePicker } from "./media-picker";
import { api } from "@/lib/api-client";
import type { CollectionRecord } from "@/modules/admin/catalog-validation";
import {
  images,
  type AdminProduct,
  type AdminVariant,
} from "@/modules/admin/validation";
import { categories } from "@/modules/catalog/products";
type ProductFields = Pick<
  AdminProduct,
  "name" | "slug" | "category" | "description" | "image" | "gallery" | "active"
>;
const blank: ProductFields = {
  name: "",
  slug: "",
  category: "Cadenas",
  description: "",
  image: images[0],
  gallery: [images[0]],
  active: false,
};
const initialVariant = { sku: "", label: "", price: 1, active: true };
export function ProductForm({
  product,
  busy,
  onSave,
}: {
  product?: AdminProduct;
  busy: boolean;
  onSave: (data: unknown) => Promise<void>;
}) {
  const [photoBusy, setPhotoBusy] = useState(false);
  const [form, setForm] = useState<ProductFields>(product ?? blank),
    [variant, setVariant] = useState(initialVariant),
    [reason, setReason] = useState("");
  const [collectionIds, setCollectionIds] = useState(
      product?.collections?.map((c) => c.id) ?? [],
    ),
    [collections, setCollections] = useState<CollectionRecord[]>([]),
    [collectionError, setCollectionError] = useState("");
  useEffect(() => {
    void api<{ collections: CollectionRecord[] }>("/api/admin/collections")
      .then((d) => setCollections(d.collections))
      .catch((e) => setCollectionError(e.message));
  }, []);
  return (
    <form
      className="checkout-form admin-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (photoBusy) return;
        void onSave(
          product
            ? {
                ...form,
                collectionIds,
                expectedVersion: product.version,
                reason,
              }
            : { product: { ...form, collectionIds }, variant, reason },
        );
      }}
    >
      <fieldset disabled={busy || photoBusy}>
        <legend>{product ? "Ficha del producto" : "Nuevo producto"}</legend>
        <label>
          Nombre
          <input
            required
            minLength={3}
            maxLength={100}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </label>
        <label>
          Enlace del producto
          <input
            required
            minLength={3}
            maxLength={100}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            placeholder="cadena-de-ejemplo"
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
          />
          <small>
            Solo letras minúsculas, números y guiones. Cambiarlo modifica su
            dirección pública.
          </small>
        </label>
        <label>
          Categoría
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Descripción
          <textarea
            required
            minLength={12}
            maxLength={2000}
            rows={4}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </label>
        <ImagePicker
          onBusyChange={setPhotoBusy}
          image={form.image}
          gallery={form.gallery}
          disabled={busy || photoBusy}
          onChange={(image, gallery) =>
            setForm((current) => ({ ...current, image, gallery }))
          }
        />
        <fieldset>
          <legend>Colecciones del producto · máximo 10</legend>
          {collectionError && <p role="alert">{collectionError}</p>}
          {collections.map((c) => (
            <label className="checkbox" key={c.id}>
              <input
                type="checkbox"
                checked={collectionIds.includes(c.id)}
                disabled={
                  !collectionIds.includes(c.id) && collectionIds.length >= 10
                }
                onChange={(e) =>
                  setCollectionIds((v) =>
                    e.target.checked
                      ? [...v, c.id]
                      : v.filter((id) => id !== c.id),
                  )
                }
              />
              {c.name}
              {!c.active ? " (oculta)" : ""}
            </label>
          ))}
          {!collections.length && !collectionError && (
            <p>
              Crea colecciones en Fotografías y colecciones para agrupar tus
              productos.
            </p>
          )}
        </fieldset>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm({ ...form, active: e.target.checked })}
          />
          Mostrar producto en el catálogo
        </label>
      </fieldset>
      {!product && (
        <fieldset disabled={busy || photoBusy}>
          <legend>Primera variante · stock inicial cero</legend>
          <label>
            SKU
            <input
              required
              minLength={3}
              maxLength={64}
              pattern="[A-Z0-9_-]+"
              value={variant.sku}
              onChange={(e) =>
                setVariant({ ...variant, sku: e.target.value.toUpperCase() })
              }
            />
          </label>
          <label>
            Variante
            <input
              required
              maxLength={100}
              placeholder="45 cm"
              value={variant.label}
              onChange={(e) =>
                setVariant({ ...variant, label: e.target.value })
              }
            />
          </label>
          <label>
            Precio COP
            <input
              type="number"
              required
              min={1}
              max={100000000}
              step={1}
              value={variant.price}
              onChange={(e) =>
                setVariant({ ...variant, price: Number(e.target.value) })
              }
            />
          </label>
        </fieldset>
      )}
      <label>
        Motivo del cambio
        <textarea
          required
          minLength={8}
          maxLength={300}
          rows={2}
          disabled={busy || photoBusy}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      <button className="button" disabled={busy || photoBusy}>
        {busy
          ? "Guardando…"
          : product
            ? "Guardar ficha"
            : "Crear producto de ejemplo"}
      </button>
    </form>
  );
}
export function VariantForm({
  variant,
  busy,
  onSave,
}: {
  variant?: AdminVariant;
  busy: boolean;
  onSave: (data: unknown) => Promise<void>;
}) {
  const [form, setForm] = useState(variant ?? initialVariant),
    [reason, setReason] = useState("");
  return (
    <form
      className="checkout-form"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave({
          ...form,
          reason,
          ...(variant ? { expectedVersion: variant.version } : {}),
        });
      }}
    >
      <fieldset disabled={busy}>
        <legend>{variant ? "Precio y variante" : "Añadir variante"}</legend>
        <label>
          SKU
          <input
            required
            minLength={3}
            maxLength={64}
            pattern="[A-Z0-9_-]+"
            value={form.sku}
            onChange={(e) =>
              setForm({ ...form, sku: e.target.value.toUpperCase() })
            }
          />
        </label>
        <label>
          Variante
          <input
            required
            maxLength={100}
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
          />
        </label>
        <label>
          Precio COP
          <input
            required
            type="number"
            min={1}
            max={100000000}
            step={1}
            value={form.price}
            onChange={(e) =>
              setForm({ ...form, price: Number(e.target.value) })
            }
          />
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm({ ...form, active: e.target.checked })}
          />
          Variante activa
        </label>
        <label>
          Motivo
          <textarea
            required
            minLength={8}
            maxLength={300}
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
      </fieldset>
      <button className="button secondary" disabled={busy}>
        {busy ? "Guardando…" : variant ? "Guardar variante" : "Crear variante"}
      </button>
    </form>
  );
}
export function StockForm({
  variant,
  busy,
  onSave,
}: {
  variant: AdminVariant;
  busy: boolean;
  onSave: (data: unknown) => Promise<void>;
}) {
  const [stock, setStock] = useState(variant.stock),
    [reason, setReason] = useState("");
  return (
    <form
      className="checkout-form"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave({ stock, reason, expectedVersion: variant.version });
      }}
    >
      <fieldset disabled={busy}>
        <legend>Ajuste de inventario</legend>
        <p>
          Total: <strong>{variant.stock}</strong> · Reservadas:{" "}
          <strong>{variant.reserved}</strong> · Disponibles:{" "}
          <strong>{variant.stock - variant.reserved}</strong>
        </p>
        <label>
          Nuevo stock total
          <input
            required
            type="number"
            min={variant.reserved}
            max={1000000}
            step={1}
            value={stock}
            onChange={(e) => setStock(Number(e.target.value))}
          />
        </label>
        <p>
          Cambio propuesto: {stock - variant.stock > 0 ? "+" : ""}
          {stock - variant.stock} unidades. Las reservas vigentes se mantienen.
        </p>
        <label>
          Motivo del ajuste
          <textarea
            required
            minLength={8}
            maxLength={300}
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ingreso de unidades de ejemplo"
          />
        </label>
      </fieldset>
      <button
        className="button secondary"
        disabled={busy || stock === variant.stock}
      >
        {busy ? "Guardando…" : "Registrar ajuste"}
      </button>
    </form>
  );
}
