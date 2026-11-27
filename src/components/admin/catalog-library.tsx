"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { api } from "@/lib/api-client";
import type {
  CollectionRecord,
  AssetRecord,
} from "@/modules/admin/catalog-validation";
import { MediaUploader } from "./media-picker";
const blank = { name: "", slug: "", description: "", active: false };
export function CatalogLibrary() {
  const [collections, setCollections] = useState<CollectionRecord[]>([]),
    [assets, setAssets] = useState<AssetRecord[]>([]),
    [loaded, setLoaded] = useState(false),
    [selected, setSelected] = useState<CollectionRecord | null>(null),
    [form, setForm] = useState(blank),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [query, setQuery] = useState(""),
    [limit, setLimit] = useState(12);
  const lock = useRef(false);
  async function load() {
    const [c, m] = await Promise.all([
      api<{ collections: CollectionRecord[] }>("/api/admin/collections"),
      api<{ assets: AssetRecord[] }>("/api/admin/media"),
    ]);
    setCollections(c.collections);
    setAssets(m.assets);
    setLoaded(true);
  }
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, []);
  async function save() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api(
        "/api/admin/collections" + (selected ? "/" + selected.id : ""),
        selected ? "PATCH" : "POST",
        {
          ...form,
          reason,
          ...(selected ? { expectedVersion: selected.version } : {}),
        },
      );
      setMessage("Colección guardada.");
      setSelected(null);
      setForm(blank);
      setReason("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos guardar.");
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  const filtered = assets.filter((a) =>
    a.label.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <h2>Colecciones</h2>
      <p>
        Agrupa un producto en hasta diez colecciones desde su ficha. Ocultar una
        colección la retira del filtro público; sus productos siguen disponibles
        por categoría.
      </p>
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
      <div className="account-grid">
        <div className="admin-list">
          {collections.map((c) => (
            <article className="account-panel" key={c.id}>
              <h3>{c.name}</h3>
              <p>
                {c.active ? "Visible" : "Oculta"} · {c._count.products}{" "}
                productos
              </p>
              <p>{c.description}</p>
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={() => {
                  setSelected(c);
                  setForm(c);
                  setReason("");
                  setMessage("");
                }}
              >
                Editar {c.name}
              </button>
              {c.active && (
                <p>
                  <Link href={"/catalogo?coleccion=" + c.slug}>
                    Ver colección
                  </Link>
                </p>
              )}
            </article>
          ))}
          {!loaded && !error && <p role="status">Cargando biblioteca…</p>}
          {loaded && !collections.length && (
            <p>Aún no has creado colecciones.</p>
          )}
        </div>
        <form
          className="checkout-form account-panel"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <fieldset disabled={busy}>
            <legend>{selected ? "Editar colección" : "Nueva colección"}</legend>
            <label>
              Nombre de colección
              <input
                required
                minLength={3}
                maxLength={80}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label>
              Enlace de colección
              <input
                required
                minLength={3}
                maxLength={80}
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
              />
            </label>
            <label>
              Descripción
              <textarea
                maxLength={600}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              Mostrar colección
            </label>
            <label>
              Motivo del cambio
              <textarea
                required
                minLength={8}
                maxLength={300}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
          </fieldset>
          <button className="button" disabled={busy}>
            Guardar colección
          </button>
          {selected && (
            <button
              type="button"
              className="text-button"
              disabled={busy}
              onClick={() => {
                setSelected(null);
                setForm(blank);
                setReason("");
                setError("");
              }}
            >
              Cancelar edición
            </button>
          )}
          <button
            type="button"
            className="text-button"
            disabled={busy}
            onClick={() => {
              setSelected(null);
              setForm(blank);
              setReason("");
              setError("");
              void load().catch((e) => setError(e.message));
            }}
          >
            Recargar colecciones y descartar edición
          </button>
        </form>
      </div>
      <h2>Biblioteca de fotografías</h2>
      <div className="checkout-form account-panel">
        <MediaUploader onUploaded={(a) => setAssets((v) => [a, ...v])} />
      </div>
      <label className="media-search">
        Buscar fotografía
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLimit(12);
          }}
        />
      </label>
      {loaded && (
        <p>
          {assets.length} fotografías guardadas · Se conservan al reiniciar.
        </p>
      )}
      <div className="media-grid">
        {filtered.slice(0, limit).map((a) => (
          <article key={a.id} className="media-tile">
            <Image
              unoptimized
              src={a.url}
              alt={a.label}
              width={160}
              height={160}
            />
            <p>{a.label}</p>
            <small>
              {a.width} × {a.height} px · {Math.ceil(a.size / 1024)} KB
            </small>
          </article>
        ))}
      </div>
      {filtered.length > limit && (
        <button
          className="button secondary"
          onClick={() => setLimit((n) => n + 12)}
        >
          Ver más fotografías
        </button>
      )}
    </>
  );
}
