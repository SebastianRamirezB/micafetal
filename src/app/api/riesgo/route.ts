import type { NextRequest } from "next/server";
import { evaluar } from "@/lib/servicio";

/** Número dentro del rango, o null. */
function numero(valor: string | null, min: number, max: number) {
  if (valor === null || valor.trim() === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

// GET /api/riesgo?lat=4.98&lon=-75.6&alt=1360&finca=f1  (alt y finca opcionales)
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const lat = numero(p.get("lat"), -90, 90);
  const lon = numero(p.get("lon"), -180, 180);
  const altCruda = p.get("alt");
  const alt = numero(altCruda, 0, 6000);
  if (lat === null || lon === null || (altCruda && alt === null)) {
    return Response.json({ error: "Ubicación no válida" }, { status: 400 });
  }

  try {
    const { alertasCreadas: _, ...informe } = await evaluar({
      lat,
      lon,
      altura: alt === null ? null : Math.round(alt),
      fincaId: p.get("finca"),
      desdeApp: true,
    });
    return Response.json(informe);
  } catch (err) {
    console.error("[riesgo]", err);
    return Response.json(
      { error: "No se pudo traer el clima de Open-Meteo" },
      { status: 502 },
    );
  }
}
