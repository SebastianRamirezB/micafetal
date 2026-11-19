/** 1360 → "1.360". */
export function miles(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** 21.43 → "21,4". */
export function decimal(n: number, cifras = 1): string {
  return n.toFixed(cifras).replace(".", ",");
}

/** "hace 8 min", "hace 2 h", "hace 3 días" desde una fecha ISO. */
export function haceCuanto(iso: string, ahora = Date.now()): string {
  const min = Math.max(0, Math.round((ahora - Date.parse(iso)) / 60_000));
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "hace 1 día" : `hace ${d} días`;
}
