"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { api } from "@/lib/api-client";
import { images } from "@/modules/admin/validation";
import type { AssetRecord } from "@/modules/admin/catalog-validation";
export function MediaUploader({
  onUploaded,
  onBusyChange,
  disabled = false,
}: {
  onUploaded: (asset: AssetRecord) => void;
  onBusyChange?: (busy: boolean) => void;
  disabled?: boolean;
}) {
  const [label, setLabel] = useState(""),
    [file, setFile] = useState<File | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const lock = useRef(false),
    input = useRef<HTMLInputElement>(null);
  async function upload() {
    if (lock.current) return;
    setError("");
    setMessage("");
    if (!file || label.trim().length < 3) {
      setError(
        "Selecciona una fotografía y escribe una descripción de al menos 3 caracteres.",
      );
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("El archivo supera 5 MB.");
      return;
    }
    lock.current = true;
    setBusy(true);
    onBusyChange?.(true);
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("label", label);
      const r = await fetch("/api/admin/media", { method: "POST", body });
      const data = await r.json();
      if (!r.ok) throw Error(data.error ?? "No pudimos cargar la fotografía.");
      onUploaded(data);
      setFile(null);
      setLabel("");
      if (input.current) input.current.value = "";
      setMessage("Fotografía guardada en la biblioteca.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de carga.");
    } finally {
      lock.current = false;
      setBusy(false);
      onBusyChange?.(false);
    }
  }
  return (
    <div className="media-upload">
      <p>
        JPG, PNG o WebP · Hasta 5 MB y 20 megapíxeles. Se optimiza a WebP de
        hasta 1800 px. Las fotografías son públicas mediante su enlace; carga
        solo imágenes de productos destinadas al catálogo.
      </p>
      <label>
        Descripción de la fotografía
        <input
          value={label}
          maxLength={100}
          disabled={disabled || busy}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Cadena cubana, vista frontal"
        />
      </label>
      <label>
        Archivo de fotografía
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={disabled || busy}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </label>
      <button
        type="button"
        className="button secondary"
        disabled={disabled || busy}
        onClick={() => void upload()}
      >
        {busy ? "Subiendo fotografía…" : "Subir fotografía"}
      </button>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
    </div>
  );
}
export function ImagePicker({
  image,
  gallery,
  onChange,
  onBusyChange,
  disabled,
}: {
  image: string;
  gallery: string[];
  onChange: (image: string, gallery: string[]) => void;
  onBusyChange?: (busy: boolean) => void;
  disabled: boolean;
}) {
  const [assets, setAssets] = useState<AssetRecord[]>([]),
    [error, setError] = useState(""),
    [query, setQuery] = useState(""),
    [limit, setLimit] = useState(8);
  useEffect(() => {
    void api<{ assets: AssetRecord[] }>("/api/admin/media")
      .then((d) => setAssets(d.assets))
      .catch((e) => setError(e.message));
  }, []);
  const options = [
    ...images.map((url, i) => ({ url, label: "Referencia " + (i + 1) })),
    ...assets,
  ];
  const label = (url: string) =>
    options.find((a) => a.url === url)?.label ?? "Fotografía guardada";
  const filtered = options.filter((a) =>
    a.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  return (
    <fieldset disabled={disabled}>
      <legend>Fotografías del producto</legend>
      <MediaUploader
        onBusyChange={onBusyChange}
        disabled={disabled}
        onUploaded={(a) => {
          setAssets((v) => [a, ...v]);
          if (gallery.length < 7) onChange(image, [...gallery, a.url]);
        }}
      />
      {error && <p role="alert">{error}</p>}
      <h3>Galería seleccionada · {gallery.length}/7</h3>
      <p>
        Selecciona la principal y ordena las demás vistas. Guardar la ficha
        aplica estos cambios al producto.
      </p>
      <div className="media-grid">
        {gallery.map((url, i) => (
          <article className="media-tile" key={url}>
            <Image
              unoptimized
              src={url}
              alt={label(url)}
              width={160}
              height={160}
            />
            <p>{label(url)}</p>
            <button
              type="button"
              className="text-button"
              disabled={url === image}
              onClick={() => onChange(url, gallery)}
            >
              {url === image ? "Imagen principal" : "Usar como principal"}
            </button>
            <div className="admin-toolbar">
              <button
                type="button"
                disabled={i === 0}
                onClick={() => {
                  const next = [...gallery];
                  [next[i - 1], next[i]] = [next[i], next[i - 1]];
                  onChange(image, next);
                }}
              >
                Subir posición
              </button>
              <button
                type="button"
                disabled={i === gallery.length - 1}
                onClick={() => {
                  const next = [...gallery];
                  [next[i], next[i + 1]] = [next[i + 1], next[i]];
                  onChange(image, next);
                }}
              >
                Bajar posición
              </button>
              <button
                type="button"
                disabled={url === image}
                onClick={() =>
                  onChange(
                    image,
                    gallery.filter((x) => x !== url),
                  )
                }
              >
                Quitar de galería
              </button>
            </div>
          </article>
        ))}
      </div>
      <label>
        Buscar en la biblioteca
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLimit(8);
          }}
        />
      </label>
      <div className="media-grid">
        {filtered.slice(0, limit).map((a) => (
          <article key={a.url} className="media-tile">
            <Image
              unoptimized
              src={a.url}
              alt={a.label}
              width={160}
              height={160}
            />
            <p>{a.label}</p>
            <button
              type="button"
              className="button secondary"
              disabled={gallery.includes(a.url) || gallery.length >= 7}
              onClick={() => onChange(image, [...gallery, a.url])}
            >
              {gallery.includes(a.url) ? "Seleccionada" : "Añadir a galería"}
            </button>
          </article>
        ))}
      </div>
      {!filtered.length && <p>No hay fotografías con esa descripción.</p>}
      {filtered.length > limit && (
        <button
          type="button"
          className="text-button"
          onClick={() => setLimit((n) => n + 8)}
        >
          Ver más fotografías
        </button>
      )}
    </fieldset>
  );
}
