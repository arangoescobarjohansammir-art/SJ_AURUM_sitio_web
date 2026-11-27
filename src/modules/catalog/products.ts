export const categories = [
  "Cadenas",
  "Collares",
  "Pulseras",
  "Anillos",
  "Aretes",
  "Dijes",
  "Tobilleras",
  "Sets",
  "Joyería masculina",
] as const;
export type Variant = {
  id: string;
  label: string;
  stock: number;
  price: number;
};
export type Product = {
  collections?: {
    id: string;
    name: string;
    slug: string;
    description: string;
  }[];
  id: string;
  slug: string;
  name: string;
  category: string;
  image: string;
  gallery: string[];
  description: string;
  variants: Variant[];
  demo: boolean;
};
const fixture = (
  slug: string,
  name: string,
  category: string,
  image: number,
  price: number,
  options: string[],
  description: string,
): Product => ({
  id: `demo-${slug}`,
  slug,
  name,
  category,
  image: `/images/product-${image}.jpg`,
  gallery: [
    `/images/product-${image}.jpg`,
    ...(image === 1 ? ["/images/detail.jpg"] : []),
  ],
  description,
  variants: options.map((label, i) => ({
    id: `demo-${slug}-${i}`,
    label,
    stock: i === 2 ? 0 : 5 + i,
    price,
  })),
  demo: true,
});
/** Illustrative fixtures, not production stock or material specifications. */
export const products: Product[] = [
  fixture(
    "cadena-cubana",
    "Cadena Cubana",
    "Cadenas",
    1,
    145000,
    ["45 cm", "60 cm", "65 cm"],
    "Una silueta de eslabones entrelazados para dar protagonismo a tu estilo.",
  ),
  fixture(
    "pulsera-veneciana",
    "Pulsera Veneciana",
    "Pulseras",
    2,
    89000,
    ["18 cm", "20 cm"],
    "Líneas delicadas que acompañan tus combinaciones de cada día.",
  ),
  fixture(
    "dije-cruz",
    "Dije Cruz",
    "Dijes",
    3,
    65000,
    ["Única"],
    "Un detalle luminoso para llevar cerca lo que tiene significado para ti.",
  ),
  fixture(
    "candongas-trenzadas",
    "Candongas Trenzadas",
    "Aretes",
    4,
    52000,
    ["Par"],
    "Textura y movimiento en una interpretación de un clásico.",
  ),
  fixture(
    "anillo-sello",
    "Anillo Sello",
    "Anillos",
    5,
    78000,
    ["Talla 7", "Talla 9"],
    "Una pieza de carácter con una silueta definida.",
  ),
  fixture(
    "tobillera-doble",
    "Tobillera Doble",
    "Tobilleras",
    6,
    48000,
    ["Ajustable"],
    "Dos líneas sutiles y un pequeño detalle que completa tu look.",
  ),
];
export function findVariant(id: string) {
  for (const product of products) {
    const variant = product.variants.find((v) => v.id === id);
    if (variant) return { product, variant };
  }
}
export type CatalogFilters = {
  query?: string;
  category?: string;
  maxPrice?: number;
  sort?: string;
  availableOnly?: boolean;
};
export function filterProducts(filters: CatalogFilters, source = products) {
  const normalize = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("es");
  const query = normalize(filters.query?.trim() ?? "");
  const list = source.filter(
    (p) =>
      (!query || normalize(`${p.name} ${p.category}`).includes(query)) &&
      (!filters.category || p.category === filters.category) &&
      (filters.maxPrice === undefined ||
        p.variants[0].price <= filters.maxPrice) &&
      (!filters.availableOnly || p.variants.some((v) => v.stock > 0)),
  );
  if (filters.sort === "price-asc")
    list.sort((a, b) => a.variants[0].price - b.variants[0].price);
  if (filters.sort === "price-desc")
    list.sort((a, b) => b.variants[0].price - a.variants[0].price);
  return list;
}
