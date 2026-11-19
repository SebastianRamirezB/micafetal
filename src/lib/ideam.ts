import { cacheLife } from "next/cache";
import type { DatoIdeam } from "./datos";
import { distanciaKm } from "./geo";
import { consultarElevacion } from "./open-meteo";
import { corregirPorAltitud } from "./riesgo";

// Datos hidrometeorológicos crudos del IDEAM en datos.gov.co: temperatura del aire.
const URL_TEMPERATURA = "https://www.datos.gov.co/resource/sbwg-7ju4.json";
/** Estaciones más lejanas no sirven de contraste. */
const RADIO_KM = 30;
/** El IDEAM publica con 1–2 días de retraso; más viejo que esto no se muestra. */
const DIAS_ATRAS = 5;
const ESPERA_MS = 8000;

type FilaEstacion = {
  codigoestacion: string;
  nombreestacion: string;
  latitud: string;
  longitud: string;
};
type FilaDato = { fechaobservacion: string; valorobservado: string };

async function soql<T>(params: Record<string, string>): Promise<T[]> {
  const res = await fetch(`${URL_TEMPERATURA}?${new URLSearchParams(params)}`, {
    signal: AbortSignal.timeout(ESPERA_MS),
  });
  if (!res.ok) throw new Error(`IDEAM respondió ${res.status}`);
  return (await res.json()) as T[];
}

const CORTAS = new Set(["de", "la", "el", "del", "los", "las", "san", "y"]);

/** "AEROPUERTO LA NUBIA - AUT [26155110]" → "Aeropuerto La Nubia". */
function limpiarNombre(nombre: string): string {
  return nombre
    .replace(/\[.*?\]/g, "")
    .replace(/-\s*AUT\b.*/i, "")
    .trim()
    .split(/\s+/)
    .map((p) =>
      // Siglas cortas (CRQ, PNN) se quedan en mayúsculas.
      p.length <= 3 && !CORTAS.has(p.toLowerCase())
        ? p
        : p.charAt(0) + p.slice(1).toLowerCase(),
    )
    .join(" ");
}

/** Las fechas del IDEAM vienen en hora de Colombia, sin zona. */
function fechaColombia(fecha: string): string {
  return new Date(`${fecha.slice(0, 19)}-05:00`).toISOString();
}

async function estacionCercana(lat: number, lon: number) {
  "use cache";
  cacheLife("hours");
  const desde = new Date(Date.now() - DIAS_ATRAS * 86_400_000)
    .toISOString()
    .slice(0, 19);
  const d = 0.3; // ~33 km
  const filas = await soql<FilaEstacion>({
    $select: "codigoestacion,nombreestacion,latitud,longitud",
    $where: `fechaobservacion > '${desde}' AND latitud between ${lat - d} and ${lat + d} AND longitud between ${lon - d} and ${lon + d}`,
    $group: "codigoestacion,nombreestacion,latitud,longitud",
    $limit: "100",
  });
  const estaciones = filas
    .map((f) => {
      const punto = { lat: Number(f.latitud), lon: Number(f.longitud) };
      return {
        codigo: f.codigoestacion,
        nombre: limpiarNombre(f.nombreestacion),
        ...punto,
        km: distanciaKm({ lat, lon }, punto),
      };
    })
    .filter((e) => e.km <= RADIO_KM)
    .sort((a, b) => a.km - b.km);
  const e = estaciones[0];
  if (!e) return null;

  const [ultimo] = await soql<FilaDato>({
    $select: "fechaobservacion,valorobservado",
    $where: `codigoestacion='${e.codigo.replace(/'/g, "")}'`,
    $order: "fechaobservacion DESC",
    $limit: "1",
  });
  if (!ultimo) return null;
  const [altura] = await consultarElevacion([{ lat: e.lat, lon: e.lon }]);
  return {
    estacion: e.nombre,
    distanciaKm: Math.round(e.km * 10) / 10,
    fecha: fechaColombia(ultimo.fechaobservacion),
    temperatura: Number(ultimo.valorobservado),
    alturaEstacion: altura,
  };
}

/** Estación del IDEAM más cercana (≤30 km) con su temperatura llevada a la finca. */
export async function datoIdeam(
  lat: number,
  lon: number,
  alturaFinca: number,
): Promise<DatoIdeam | null> {
  try {
    // Redondeado a ~1 km para compartir el caché entre fincas vecinas.
    const e = await estacionCercana(
      Math.round(lat * 100) / 100,
      Math.round(lon * 100) / 100,
    );
    if (!e || !Number.isFinite(e.temperatura)) return null;
    return {
      ...e,
      temperaturaFinca:
        Math.round(
          corregirPorAltitud(e.temperatura, e.alturaEstacion, alturaFinca) * 10,
        ) / 10,
    };
  } catch (err) {
    console.error("[ideam]", err);
    return null;
  }
}
