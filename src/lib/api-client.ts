export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(path, {
    method,
    cache: "no-store",
    headers:
      method !== "GET" ? { "Content-Type": "application/json" } : undefined,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok)
    throw new ApiError(
      data.error ?? "No pudimos completar la operación.",
      data.code ?? "UNKNOWN",
      response.status,
    );
  return data;
}
export type CartLine = {
  variantId: string;
  quantity: number;
  name: string;
  slug: string;
  label: string;
  image: string;
  unitPrice: number;
  stock: number;
  available: boolean;
};
