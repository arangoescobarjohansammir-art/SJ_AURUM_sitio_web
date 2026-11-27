"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { findVariant, products } from "@/modules/catalog/products";
import { sanitizeCart, type CartLine } from "@/modules/cart/cart";
type Shop = {
  cart: CartLine[];
  favorites: string[];
  ready: boolean;
  add: (id: string) => void;
  setQuantity: (id: string, n: number) => void;
  toggleFavorite: (id: string) => void;
};
const Context = createContext<Shop | null>(null);
export function ShopProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartLine[]>([]),
    [favorites, setFavorites] = useState<string[]>([]),
    [ready, setReady] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    try {
      setCart(
        sanitizeCart(
          JSON.parse(localStorage.getItem("aurum-demo-cart-v1") ?? "[]"),
        ),
      );
      const saved: unknown = JSON.parse(
        localStorage.getItem("aurum-favorites-v1") ?? "[]",
      );
      if (Array.isArray(saved))
        setFavorites([
          ...new Set(
            saved.filter(
              (id): id is string =>
                typeof id === "string" && products.some((p) => p.id === id),
            ),
          ),
        ]);
    } catch {}
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem("aurum-demo-cart-v1", JSON.stringify(cart));
      localStorage.setItem("aurum-favorites-v1", JSON.stringify(favorites));
    } catch {
      setMessage("Tu navegador no permite guardar la bolsa entre visitas.");
    }
  }, [cart, favorites, ready]);
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(""), 4500);
      return () => clearTimeout(timer);
    }
  }, [message]);
  function add(id: string) {
    const found = findVariant(id);
    if (!ready || !found || found.variant.stock < 1) return;
    const current = cart.find((l) => l.variantId === id)?.quantity ?? 0;
    setCart((lines) =>
      sanitizeCart([...lines, { variantId: id, quantity: 1 }]),
    );
    setMessage(
      current >= found.variant.stock
        ? "Alcanzaste las existencias de ejemplo."
        : `${found.product.name} añadida a tu bolsa de ejemplo.`,
    );
  }
  function setQuantity(id: string, n: number) {
    if (!ready || !Number.isSafeInteger(n) || n < 0) return;
    setCart((lines) =>
      sanitizeCart(
        n === 0
          ? lines.filter((l) => l.variantId !== id)
          : lines.map((l) => (l.variantId === id ? { ...l, quantity: n } : l)),
      ),
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
      value={{ cart, favorites, ready, add, setQuantity, toggleFavorite }}
    >
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
