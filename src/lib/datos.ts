// Tipos y datos fijos de la app. El clima y el riesgo de cada finca se
// calculan en el servidor (`/api/riesgo` → `servicio.ts`).

export type Nivel = "bajo" | "medio" | "alto";
export type PlagaId = "roya" | "broca";

export type ClaveFactor =
  | "temperatura"
  | "humedad"
  | "lluvia"
  | "altura"
  | "vecinos";
export type Factor = {
  clave: ClaveFactor;
  suma: boolean;
  /** Puntos que aporta (roya: de 100; broca: 0 o 1). */
  aporte: number;
  texto: string;
  nota: string;
};
export type RiesgoPlaga = {
  nivel: Nivel;
  /** IRF (roya, 0–100) o señales (broca, 0–4). */
  valor: number;
  dato: string;
  factores: Factor[];
};

/** Estación del IDEAM más cercana, como contraste del clima de Open-Meteo. */
export type DatoIdeam = {
  estacion: string;
  distanciaKm: number;
  /** Fecha de la observación (ISO). */
  fecha: string;
  temperatura: number;
  alturaEstacion: number;
  /** Temperatura corregida a la altura de la finca. */
  temperaturaFinca: number;
};

/** Finca del catálogo (las de prueba). */
export type Finca = {
  id: string;
  nombre: string;
  municipio: string;
  /** Metros sobre el nivel del mar. */
  altura: number;
  lat: number;
  lon: number;
};

/** Finca registrada en este celular. Sin altura, se usa la del mapa de Open-Meteo. */
export type FincaNueva = {
  /** "n-<uuid>", creado en el celular. */
  id: string;
  nombre: string;
  altura: number | null;
  lat: number;
  lon: number;
};

/** Resultado del cálculo para una finca; se guarda en el celular para verlo sin señal. */
export type Informe = {
  /** Cuándo se trajo el clima de Open-Meteo (ISO). */
  calculado: string;
  /** Altura de la finca, en metros. */
  altura: number;
  /** Altura de la celda del modelo de Open-Meteo, en metros. */
  alturaModelo: number;
  roya: RiesgoPlaga;
  broca: RiesgoPlaga;
  ahora: {
    /** Hora de la medida (ISO). */
    hora: string;
    temperatura: number;
    humedad: number;
    lluvia: number;
  };
  /** Resumen de los 7 días, ya corregido por altitud. */
  indicadores: {
    temperatura: number;
    horasHumedas: number;
    diasConLluvia: number;
    lluviaTotal: number;
  };
  /** Los 7 días completos anteriores a hoy, del más viejo al más reciente. */
  semana: {
    dias: string[];
    lluvia: number[];
    temperatura: number[];
    resumen: string;
  };
  ideam: DatoIdeam | null;
};

/** Finca que se está mostrando. */
export type FincaActiva = {
  id: string;
  nombre: string;
  /** null mientras no se sepa (finca nueva sin altura escrita). */
  altura: number | null;
  lat: number;
  lon: number;
  informe: Informe | null;
};

/** Domingo primero, como `Date.getUTCDay()`. */
export const DIAS_SEMANA = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

export const PLAGAS: { id: PlagaId; nombre: string; descripcion: string }[] = [
  {
    id: "roya",
    nombre: "Roya",
    descripcion: "Polvillo naranja en el revés de las hojas.",
  },
  {
    id: "broca",
    nombre: "Broca",
    descripcion: "Insecto que perfora el grano.",
  },
];

export const QUE_HACER: Record<PlagaId, Record<Nivel, string[]>> = {
  roya: {
    alto: [
      "Revise esta semana el revés de las hojas bajas en 3 o 4 sitios del lote.",
      "Si ve polvillo naranja en muchas hojas, consulte al técnico de su cooperativa antes de aplicar cualquier producto.",
      "Cuéntenos lo que encontró con el botón de abajo.",
    ],
    medio: [
      "Revise esta semana el revés de las hojas bajas en 3 o 4 sitios del lote.",
      "Cuéntenos lo que encontró con el botón de abajo.",
    ],
    bajo: [
      "Siga revisando su cafetal como de costumbre.",
      "Mire el aviso otra vez la próxima semana.",
    ],
  },
  broca: {
    alto: [
      "Revise los granos en 3 o 4 sitios del lote esta semana.",
      "Recoja los granos maduros, sobremaduros y los caídos al suelo.",
      "Consulte al técnico de su cooperativa si encuentra muchos granos perforados.",
    ],
    medio: [
      "Revise los granos en 3 o 4 sitios del lote esta semana.",
      "Recoja los granos maduros, sobremaduros y los caídos al suelo.",
      "Cuéntenos lo que encontró con el botón de abajo.",
    ],
    bajo: [
      "Siga revisando su cafetal como de costumbre.",
      "Mire el aviso otra vez la próxima semana.",
    ],
  },
};

// Coordenadas aproximadas de la zona cafetera de cada municipio.
export const FINCAS: Finca[] = [
  {
    id: "f1",
    nombre: "Finca de prueba 1",
    municipio: "Chinchiná",
    altura: 1360,
    lat: 4.983,
    lon: -75.604,
  },
  {
    id: "f3",
    nombre: "Finca de prueba 3",
    municipio: "Manizales",
    altura: 1800,
    lat: 5.03,
    lon: -75.55,
  },
  {
    id: "f9",
    nombre: "Finca de prueba 9",
    municipio: "Montenegro",
    altura: 1250,
    lat: 4.566,
    lon: -75.751,
  },
];

export function buscarFinca(id: string): Finca | undefined {
  return FINCAS.find((f) => f.id === id);
}
