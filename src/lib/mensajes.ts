// Asistente de interpretación: árbol de decisión que traduce el riesgo a un
// mensaje corto y accionable. Con tildes o ñ el SMS va en UCS-2: 70 caracteres
// por segmento, así que cada mensaje cabe en un solo SMS.

import type { ClaveFactor, Nivel, PlagaId, RiesgoPlaga } from "./datos";

export const MAX_CARACTERES = 70;

const CAUSA: Record<ClaveFactor, string> = {
  temperatura: "temperatura",
  humedad: "humedad",
  lluvia: "lluvias",
  altura: "altitud baja",
  vecinos: "broca cerca",
};

const ACCION: Record<PlagaId, Record<Nivel, string>> = {
  roya: {
    alto: "Revise hojas bajas.",
    medio: "Revise hojas bajas esta semana.",
    bajo: "Siga revisando como siempre.",
  },
  broca: {
    alto: "Revise y recoja granos.",
    medio: "Revise granos esta semana.",
    bajo: "Siga revisando como siempre.",
  },
};

// Si dos factores aportan igual, gana el primero de esta lista.
const PRIORIDAD: ClaveFactor[] = [
  "vecinos",
  "humedad",
  "lluvia",
  "temperatura",
  "altura",
];

/** Factor que más pesa en el riesgo, o null si ninguno suma. */
export function causaPrincipal(r: RiesgoPlaga): ClaveFactor | null {
  const suman = r.factores.filter((f) => f.suma);
  if (suman.length === 0) return null;
  suman.sort(
    (a, b) =>
      b.aporte - a.aporte ||
      PRIORIDAD.indexOf(a.clave) - PRIORIDAD.indexOf(b.clave),
  );
  return suman[0].clave;
}

/** Ej.: «ALERTA ROYA: riesgo alto por lluvias. Revise hojas bajas.» */
export function mensajeAlerta(plaga: PlagaId, r: RiesgoPlaga): string {
  const encabezado = `${r.nivel === "alto" ? "ALERTA" : "AVISO"} ${plaga.toUpperCase()}`;
  const causa = causaPrincipal(r);
  const accion = ACCION[plaga][r.nivel];
  const completo = `${encabezado}: riesgo ${r.nivel}${causa ? ` por ${CAUSA[causa]}` : ""}. ${accion}`;
  if (completo.length <= MAX_CARACTERES) return completo;
  // Respaldo: sin la causa siempre cabe.
  return `${encabezado}: riesgo ${r.nivel}. ${accion}`.slice(0, MAX_CARACTERES);
}
