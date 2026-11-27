"use client";
import { useState } from "react";
import { categories, filterProducts } from "@/modules/catalog/products";
import { ProductCard } from "./product-card";
export function Catalog({
  initialCategory = "",
}: {
  initialCategory?: string;
}) {
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState(initialCategory),
    [maxPrice, setMaxPrice] = useState(""),
    [sort, setSort] = useState("selection"),
    [available, setAvailable] = useState(false),
    [limit, setLimit] = useState(4);
  const filtered = filterProducts({
    query,
    category,
    maxPrice: maxPrice ? Number(maxPrice) : undefined,
    sort,
    availableOnly: available,
  });
  function reset() {
    setQuery("");
    setCategory("");
    setMaxPrice("");
    setSort("selection");
    setAvailable(false);
    setLimit(4);
  }
  return (
    <>
      <div className="catalog-controls">
        <label className="search-field">
          Buscar una pieza
          <input
            id="buscar"
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(4);
            }}
            placeholder="Cadenas, anillos, aretes…"
          />
        </label>
        <label>
          Categoría
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setLimit(4);
            }}
          >
            <option value="">Todas las categorías</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Precio máximo
          <select
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
          >
            <option value="">Cualquier precio</option>
            <option value="60000">$60.000 COP</option>
            <option value="100000">$100.000 COP</option>
            <option value="150000">$150.000 COP</option>
          </select>
        </label>
        <label>
          Ordenar
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="selection">Selección AURUM</option>
            <option value="price-asc">Menor precio</option>
            <option value="price-desc">Mayor precio</option>
          </select>
        </label>
      </div>
      <div className="catalog-summary">
        <p role="status">
          {filtered.length} {filtered.length === 1 ? "pieza" : "piezas"} de
          ejemplo
        </p>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={available}
            onChange={(e) => setAvailable(e.target.checked)}
          />
          Solo disponibles
        </label>
        <button className="text-button" onClick={reset}>
          Limpiar filtros
        </button>
      </div>
      {filtered.length ? (
        <>
          <div className="product-grid">
            {filtered.slice(0, limit).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
          {filtered.length > limit && (
            <div className="center section">
              <button
                className="button secondary"
                onClick={() => setLimit((n) => n + 4)}
              >
                Ver más piezas
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="empty-state">
          <h2>Tu próxima joya está por descubrir.</h2>
          <p>No hay piezas que coincidan con estos filtros.</p>
          <button className="button secondary" onClick={reset}>
            Ver toda la colección
          </button>
        </div>
      )}
    </>
  );
}
