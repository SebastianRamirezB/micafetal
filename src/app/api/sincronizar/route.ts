import { guardarItems, type ItemServidor } from "@/lib/db";

const HALLAZGOS = ["nada", "roya", "broca", "ambas"];
const FLORACIONES = ["no", "empezando", "plena"];
const MAX_ITEMS = 200;

function texto(v: unknown, max: number): string | null {
  return typeof v === "string" ? v.slice(0, max) : null;
}

function numeroEn(v: unknown, min: number, max: number): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= min && v <= max
    ? v
    : null;
}

/** Valida un ítem de la cola del celular; null si no tiene sentido. */
function leerItem(x: unknown): ItemServidor | null {
  if (!x || typeof x !== "object") return null;
  const q = x as Record<string, unknown>;
  const c = q.contenido as Record<string, unknown> | undefined;
  const id = numeroEn(q.id, 1, Number.MAX_SAFE_INTEGER);
  const fincaId = texto(q.fincaId, 64);
  const guardado = texto(q.guardado, 40);
  if (!id || !fincaId || !guardado || !c) return null;
  const base = { id, fincaId, guardado };

  if (c.tipo === "finca") {
    const nombre = texto(c.nombre, 80)?.trim();
    const lat = numeroEn(c.lat, -90, 90);
    const lon = numeroEn(c.lon, -180, 180);
    const altura = c.altura === null ? null : numeroEn(c.altura, 1, 6000);
    if (!nombre || lat === null || lon === null) return null;
    if (c.altura !== null && altura === null) return null;
    return { ...base, tipo: "finca", nombre, altura, lat, lon };
  }
  if (c.tipo === "reporte") {
    const hallazgo = texto(c.hallazgo, 10);
    const porcentaje = numeroEn(c.porcentaje, 0, 100);
    const floracion = c.floracion === null ? null : texto(c.floracion, 10);
    if (!hallazgo || !HALLAZGOS.includes(hallazgo) || porcentaje === null) {
      return null;
    }
    if (floracion !== null && !FLORACIONES.includes(floracion)) return null;
    return {
      ...base,
      tipo: "reporte",
      hallazgo,
      porcentaje: Math.round(porcentaje),
      floracion,
      fecha: texto(c.fecha, 10) ?? "",
      notas: texto(c.notas, 1000) ?? "",
    };
  }
  if (c.tipo === "respuesta") {
    if (c.plaga !== "roya" && c.plaga !== "broca") return null;
    if (c.valor !== "si" && c.valor !== "no") return null;
    return { ...base, tipo: "respuesta", plaga: c.plaga, valor: c.valor };
  }
  return null;
}

// POST /api/sincronizar  { dispositivo, items: ItemCola[] }
export async function POST(req: Request) {
  let cuerpo: { dispositivo?: unknown; items?: unknown };
  try {
    cuerpo = await req.json();
  } catch {
    return Response.json({ error: "JSON no válido" }, { status: 400 });
  }
  const dispositivo = texto(cuerpo.dispositivo, 64);
  if (!dispositivo || !Array.isArray(cuerpo.items)) {
    return Response.json({ error: "Faltan datos" }, { status: 400 });
  }

  const validos: ItemServidor[] = [];
  const invalidos: number[] = [];
  for (const x of cuerpo.items.slice(0, MAX_ITEMS)) {
    const item = leerItem(x);
    if (item) validos.push(item);
    else if (typeof (x as { id?: unknown })?.id === "number") {
      invalidos.push((x as { id: number }).id);
    }
  }

  try {
    const { recibidos, descartados } = guardarItems(dispositivo, validos);
    return Response.json({
      recibidos,
      descartados: [...descartados, ...invalidos],
    });
  } catch (err) {
    console.error("[sincronizar]", err);
    return Response.json({ error: "No se pudo guardar" }, { status: 500 });
  }
}
