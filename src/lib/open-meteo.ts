import { cacheLife } from "next/cache";
import type { ClimaFinca, Dia } from "./riesgo";

const URL_PRONOSTICO = "https://api.open-meteo.com/v1/forecast";
const URL_ELEVACION = "https://api.open-meteo.com/v1/elevation";
const DIAS = 7;

// Validación de rangos: lo que cae fuera se descarta como dato dañado.
const RANGO = {
  temperatura: [-10, 45],
  humedad: [0, 100],
  lluvia: [0, 200],
} as const;

function enRango(v: number | null, [min, max]: readonly [number, number]) {
  return v !== null && Number.isFinite(v) && v >= min && v <= max;
}

type Respuesta = {
  elevation: number;
  utc_offset_seconds: number;
  current: {
    time: number;
    temperature_2m: number;
    relative_humidity_2m: number;
    precipitation: number;
  };
  hourly: {
    time: number[];
    temperature_2m: (number | null)[];
    relative_humidity_2m: (number | null)[];
    precipitation: (number | null)[];
  };
};

export class ErrorOpenMeteo extends Error {}

/**
 * Clima de los últimos 7 días completos y el de ahora, SIN corregir por
 * altitud (`elevation=nan`): la corrección la hace `corregirPorAltitud` con
 * la altura de la celda del modelo que devuelve Open-Meteo.
 */
export async function consultarClima(
  lat: number,
  lon: number,
): Promise<ClimaFinca> {
  "use cache";
  // Open-Meteo actualiza «ahora» cada 15 min.
  cacheLife({ stale: 300, revalidate: 900, expire: 3600 });

  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    elevation: "nan",
    current: "temperature_2m,relative_humidity_2m,precipitation",
    hourly: "temperature_2m,relative_humidity_2m,precipitation",
    past_days: String(DIAS),
    forecast_days: "1",
    timezone: "America/Bogota",
    timeformat: "unixtime",
  });

  const res = await fetch(`${URL_PRONOSTICO}?${params}`);
  if (!res.ok) {
    throw new ErrorOpenMeteo(`Open-Meteo respondió ${res.status}`);
  }
  const r = (await res.json()) as Respuesta;
  if (!r.hourly?.time?.length || !r.current) {
    throw new ErrorOpenMeteo("Open-Meteo no devolvió datos");
  }

  // Agrupa las horas por fecha local; las primeras 7 fechas son días completos.
  const porFecha = new Map<string, Dia>();
  const ahora = r.current.time;
  let ultima: Dia["horas"][number] | null = null;
  r.hourly.time.forEach((t, i) => {
    const temperatura = r.hourly.temperature_2m[i];
    const humedad = r.hourly.relative_humidity_2m[i];
    const lluvia = r.hourly.precipitation[i];
    if (
      !enRango(temperatura, RANGO.temperatura) ||
      !enRango(humedad, RANGO.humedad) ||
      !enRango(lluvia, RANGO.lluvia)
    ) {
      return;
    }
    const fecha = new Date((t + r.utc_offset_seconds) * 1000)
      .toISOString()
      .slice(0, 10);
    let dia = porFecha.get(fecha);
    if (!dia) {
      dia = { fecha, horas: [] };
      porFecha.set(fecha, dia);
    }
    const hora = {
      temperatura: temperatura as number,
      humedad: humedad as number,
      lluvia: lluvia as number,
    };
    dia.horas.push(hora);
    if (t <= ahora) ultima = hora;
  });
  const dias = [...porFecha.values()].slice(0, DIAS);
  if (dias.length < DIAS || dias.some((d) => d.horas.length < 20)) {
    throw new ErrorOpenMeteo("Faltan horas válidas en los datos de Open-Meteo");
  }

  // «Ahora» fuera de rango: se usa la última hora válida.
  const c = r.current;
  const respaldo = ultima ?? dias[DIAS - 1].horas.at(-1);
  if (!respaldo) throw new ErrorOpenMeteo("Sin horas válidas");
  return {
    obtenido: new Date().toISOString(),
    alturaModelo: Math.round(r.elevation),
    ahora: {
      hora: new Date(c.time * 1000).toISOString(),
      temperatura: enRango(c.temperature_2m, RANGO.temperatura)
        ? c.temperature_2m
        : respaldo.temperatura,
      humedad: enRango(c.relative_humidity_2m, RANGO.humedad)
        ? c.relative_humidity_2m
        : respaldo.humedad,
      lluvia: enRango(c.precipitation, RANGO.lluvia)
        ? c.precipitation
        : respaldo.lluvia,
    },
    dias,
  };
}

/** Altura del terreno (modelo de 90 m) en cada punto, en metros. */
export async function consultarElevacion(
  puntos: { lat: number; lon: number }[],
): Promise<number[]> {
  "use cache";
  cacheLife("max");
  const params = new URLSearchParams({
    latitude: puntos.map((p) => p.lat).join(","),
    longitude: puntos.map((p) => p.lon).join(","),
  });
  const res = await fetch(`${URL_ELEVACION}?${params}`);
  if (!res.ok) throw new ErrorOpenMeteo(`Elevación: ${res.status}`);
  const r = (await res.json()) as { elevation?: number[] };
  if (!r.elevation || r.elevation.length !== puntos.length) {
    throw new ErrorOpenMeteo("Elevación: respuesta incompleta");
  }
  return r.elevation.map((e) => Math.round(e));
}
