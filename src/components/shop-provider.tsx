"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { Product } from "@/modules/catalog/products";
import { api, type CartLine } from "@/lib/api-client";
type Shop = {
  cart: CartLine[];
  products: Product[];
  favorites: string[];
  ready: boolean;
  busy: boolean;
  error: string;
  refresh: () => Promise<void>;
  add: (id: string) => Promise<void>;
  setQuantity: (id: string, n: number) => Promise<void>;
  toggleFavorite: (id: string) => void;
};
const Context = createContext<Shop | null>(null);
export function ShopProvider({
  children,
  initialProducts,
}: {
  children: React.ReactNode;
  initialProducts: Product[];
}) {
  const [products, setProducts] = useState(initialProducts),
    [cart, setCart] = useState<CartLine[]>([]),
    [favorites, setFavorites] = useState<string[]>([]),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const lock = useRef(false),
    started = useRef(false);
  async function refresh() {
    const [session, catalog] = await Promise.all([
      api<{ cart: CartLine[] }>("/api/session", "POST", {}),
      api<{ products: Product[] }>("/api/catalog"),
    ]);
    setCart(session.cart);
    setProducts(catalog.products);
    setReady(true);
    setError("");
  }
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    try {
      const saved = JSON.parse(
        localStorage.getItem("aurum-favorites-v1") ?? "[]",
      );
      if (Array.isArray(saved))
        setFavorites(
          saved.filter(
            (id: unknown) =>
              typeof id === "string" &&
              initialProducts.some((p) => p.id === id),
          ),
        );
    } catch {}
    void refresh().catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem("aurum-favorites-v1", JSON.stringify(favorites));
    } catch {
      setMessage("No se pudieron guardar los favoritos en este navegador.");
    }
  }, [favorites, ready]);
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(""), 4500);
      return () => clearTimeout(timer);
    }
  }, [message]);
  async function setQuantity(id: string, n: number) {
    if (lock.current || !ready) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await api<{ cart: CartLine[] }>("/api/cart", "PUT", {
        variantId: id,
        quantity: n,
      });
      setCart(result.cart);
      setMessage(
        n ? "Bolsa de prueba actualizada." : "Pieza retirada de tu bolsa.",
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No pudimos actualizar la bolsa.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function add(id: string) {
    await setQuantity(
      id,
      (cart.find((l) => l.variantId === id)?.quantity ?? 0) + 1,
    );
  }
  function toggleFavorite(id: string) {
    if (!ready || !products.some((p) => p.id === id)) return;
    setFavorites((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );
  }
  return (
    <Context.Provider
      value={{
        cart,
        products,
        favorites,
        ready,
        busy,
        error,
        refresh,
        add,
        setQuantity,
        toggleFavorite,
      }}
    >
      {error && (
        <div className="container notice" role="alert">
          {error}{" "}
          <button
            className="text-button"
            onClick={() => void refresh().catch((e) => setError(e.message))}
          >
            Reintentar conexión
          </button>
        </div>
      )}
      {children}
      <div className="toast" role="status" aria-live="polite">
        {message}
      </div>
    </Context.Provider>
  );
}
export function useShop() {
  const value = useContext(Context);
  if (!value) throw Error("ShopProvider required");
  return value;
}
