import { test } from "node:test";
import assert from "node:assert/strict";
import { filterProducts, products } from "../src/modules/catalog/products";
import { sanitizeCart, cartSubtotal } from "../src/modules/cart/cart";
test("search ignores accents and combines category and price", () => {
  assert.equal(
    filterProducts({ query: " CADENA ", category: "Cadenas", maxPrice: 100000 })
      .length,
    0,
  );
  assert.equal(filterProducts({ query: "tobillera" }).length, 1);
  assert.equal(filterProducts({ category: "Collares" }).length, 0);
  assert.equal(filterProducts({ query: "ANILLO" })[0].slug, "anillo-sello");
});
test("sort returns ordered results without mutating source", () => {
  const first = products[0].id;
  const sorted = filterProducts({ sort: "price-asc" });
  assert.equal(sorted[0].slug, "tobillera-doble");
  assert.equal(products[0].id, first);
});
test("tampered and unavailable cart variants are discarded", () => {
  assert.deepEqual(sanitizeCart([{ variantId: "unknown", quantity: 2 }]), []);
  assert.deepEqual(
    sanitizeCart([{ variantId: products[0].variants[2].id, quantity: 1 }]),
    [],
  );
  for (const quantity of [-1, 1.2, Infinity, "2"]) {
    assert.deepEqual(
      sanitizeCart([{ variantId: products[0].variants[0].id, quantity }]),
      [],
    );
  }
});
test("duplicate lines cannot bypass example stock", () => {
  const v = products[0].variants[0];
  const lines = sanitizeCart([
    { variantId: v.id, quantity: 4 },
    { variantId: v.id, quantity: 4 },
  ]);
  assert.deepEqual(lines, [{ variantId: v.id, quantity: v.stock }]);
});
test("removing a line removes all units from subtotal", () => {
  const a = products[0].variants[0],
    b = products[1].variants[0];
  const lines = [
    { variantId: a.id, quantity: 3 },
    { variantId: b.id, quantity: 2 },
  ];
  assert.equal(cartSubtotal(lines), a.price * 3 + b.price * 2);
  assert.equal(
    cartSubtotal(lines.filter((l) => l.variantId !== a.id)),
    b.price * 2,
  );
});
