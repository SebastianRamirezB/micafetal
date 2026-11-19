// Orquesta una evaluación completa: clima → validación y corrección →
// motor de reglas → persistencia → gestor de alertas.

import { gestionarAlertas } from "./alertas";
import type { Informe } from "./datos";
import {
  fijarAltura,
  guardarCalculo,
  marcarConexion,
  obtenerFinca,
  plagaEnZona,
} from "./db";
import { datoIdeam } from "./ideam";
import { consultarClima, consultarElevacion } from "./open-meteo";
import { calcularInforme } from "./riesgo";

/** ~100 m: comparte el caché entre consultas casi iguales. */
function redondear(n: number) {
  return Math.round(n * 1000) / 1000;
}

export async function evaluar(p: {
  lat: number;
  lon: number;
  altura: number | null;
  fincaId?: string | null;
  /** true si la consulta viene de la app (la finca tiene datos ahora). */
  desdeApp: boolean;
}): Promise<Informe & { alertasCreadas: number }> {
  const finca = p.fincaId ? obtenerFinca(p.fincaId) : undefined;
  if (finca && p.desdeApp) marcarConexion(finca.id);

  const altura =
    p.altura ??
    finca?.altura ??
    (await consultarElevacion([{ lat: p.lat, lon: p.lon }]))[0];

  const [clima, ideam] = await Promise.all([
    consultarClima(redondear(p.lat), redondear(p.lon)),
    datoIdeam(p.lat, p.lon, altura),
  ]);
  const informe = calcularInforme(clima, {
    altura,
    plagaEnZona: finca ? plagaEnZona(finca, "broca") : 0,
  });
  informe.ideam = ideam;

  let alertasCreadas = 0;
  if (finca) {
    if (finca.altura === null) fijarAltura(finca.id, altura);
    guardarCalculo(finca.id, informe);
    // Releer: `marcarConexion` cambió el perfil de conectividad.
    alertasCreadas = gestionarAlertas(obtenerFinca(finca.id) ?? finca, informe);
  }
  return { ...informe, alertasCreadas };
}
