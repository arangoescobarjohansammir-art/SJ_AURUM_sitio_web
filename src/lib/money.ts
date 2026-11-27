/** Amounts are integer Colombian pesos. Provider conversion happens at the boundary. */
export function formatCOP(amount: number): string {
  if (!Number.isSafeInteger(amount) || amount < 0) throw new RangeError("Importe COP inválido");
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(amount);
}

export function toPaymentCents(pesos: number): number {
  if (!Number.isSafeInteger(pesos) || pesos < 0 || !Number.isSafeInteger(pesos * 100)) throw new RangeError("Importe fuera de rango");
  return pesos * 100;
}
