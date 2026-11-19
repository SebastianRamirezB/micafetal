// Cálculo del riesgo de roya y broca a partir del clima de los últimos 7 días.
// Funciones puras: no saben de dónde viene el clima.

import {
  DIAS_SEMANA,
  type Factor,
  type Informe,
  type Nivel,
  type RiesgoPlaga,
} from "./datos";
import { decimal, miles } from "./formato";

export type Hora = { temperatura: number; humedad: number; lluvia: number };
export type Dia = {
  /** "AAAA-MM-DD", hora local. */ fecha: string;
  horas: Hora[];
};

export type ClimaFinca = {
  obtenido: string;
  /** Altura de la celda del modelo de Open-Meteo, en metros. */
  alturaModelo: number;
  /** Medida de ahora, sin corregir por altitud. */
  ahora: Informe["ahora"];
  /** Los 7 días completos anteriores a hoy, sin corregir por altitud. */
  dias: Dia[];
};

/** Gradiente térmico vertical: °C que baja la temperatura por metro. */
export const GRADIENTE = 0.0065;

/** T_finca = T_est + 0.0065 × (h_est − h_finca). */
export function corregirPorAltitud(
  t: number,
  alturaOrigen: number,
  alturaFinca: number,
): number {
  return t + GRADIENTE * (alturaOrigen - alturaFinca);
}

// Umbrales mostrados en «¿Por qué?» (Cenicafé).
export const UMBRAL = {
  royaTemperatura: { min: 14, max: 24 },
  /** Humedad relativa (%) a partir de la cual una hora cuenta como «muy húmeda». */
  humedadAlta: 90,
  royaHorasHumedas: 48,
  /** Lluvia (mm) a partir de la cual un día cuenta como «con lluvia». */
  diaConLluvia: 1,
  diasConLluvia: 4,
  brocaTemperatura: 21,
  brocaAltura: 1200,
};

// Índice de riesgo de roya (IRF), según el diagrama de arquitectura:
// IRF = 100 × (0,3·f_T + 0,4·f_HR + 0,3·f_P)
export const PESOS_ROYA = { temperatura: 0.3, humedad: 0.4, lluvia: 0.3 };
export const CORTES_ROYA = { medio: 40, alto: 70 };

/** Señales de broca (de 4) para cada nivel. */
export const CORTES_BROCA = { medio: 2, alto: 3 };

const NOTA_VECINOS = "A menos de 10 km, en los últimos 14 días.";

function promedio(valores: number[]): number {
  return valores.length
    ? valores.reduce((a, b) => a + b, 0) / valores.length
    : 0;
}

function nivelPor(
  valor: number,
  cortes: { medio: number; alto: number },
): Nivel {
  if (valor >= cortes.alto) return "alto";
  if (valor >= cortes.medio) return "medio";
  return "bajo";
}

function nombreDia(fecha: string): string {
  return DIAS_SEMANA[new Date(`${fecha}T12:00:00Z`).getUTCDay()];
}

export function resumirSemana(dias: Dia[]) {
  const horas = dias.flatMap((d) => d.horas);
  const lluviaDia = dias.map(
    (d) => Math.round(d.horas.reduce((a, h) => a + h.lluvia, 0) * 10) / 10,
  );
  return {
    temperatura: promedio(horas.map((h) => h.temperatura)),
    horasHumedas: horas.filter((h) => h.humedad > UMBRAL.humedadAlta).length,
    diasConLluvia: lluviaDia.filter((mm) => mm >= UMBRAL.diaConLluvia).length,
    lluviaTotal: lluviaDia.reduce((a, b) => a + b, 0),
    lluviaDia,
    temperaturaDia: dias.map(
      (d) => Math.round(promedio(d.horas.map((h) => h.temperatura)) * 10) / 10,
    ),
    nombres: dias.map((d) => nombreDia(d.fecha)),
  };
}

type Semana = ReturnType<typeof resumirSemana>;

function textoLluvia(s: Semana, total: number) {
  return `${s.diasConLluvia} ${s.diasConLluvia === 1 ? "día" : "días"} con lluvia de ${total}`;
}

function aporte(f: number, peso: number) {
  return Math.round(100 * peso * f);
}

export function riesgoRoya(s: Semana, totalDias: number): RiesgoPlaga {
  const { min, max } = UMBRAL.royaTemperatura;
  const fT = s.temperatura >= min && s.temperatura <= max ? 1 : 0;
  const fHR = Math.min(1, s.horasHumedas / UMBRAL.royaHorasHumedas);
  const fP = Math.min(1, s.diasConLluvia / UMBRAL.diasConLluvia);
  const irf = Math.round(
    100 *
      (PESOS_ROYA.temperatura * fT +
        PESOS_ROYA.humedad * fHR +
        PESOS_ROYA.lluvia * fP),
  );
  const partes = [
    { f: fT, peso: PESOS_ROYA.temperatura },
    { f: fHR, peso: PESOS_ROYA.humedad },
    { f: fP, peso: PESOS_ROYA.lluvia },
  ].map(({ f, peso }) => ({
    valor: aporte(f, peso),
    texto: `Aporta ${aporte(f, peso)} de ${aporte(1, peso)}.`,
  }));
  const factores: Factor[] = [
    {
      clave: "temperatura",
      suma: fT > 0,
      aporte: partes[0].valor,
      texto: `Temperatura promedio ${decimal(s.temperatura)} °C`,
      nota: `La roya se favorece entre ${min} y ${max} °C. ${partes[0].texto}`,
    },
    {
      clave: "humedad",
      suma: fHR > 0,
      aporte: partes[1].valor,
      texto: `${s.horasHumedas} horas con humedad mayor a ${UMBRAL.humedadAlta} %`,
      nota: `Cuenta completo desde ${UMBRAL.royaHorasHumedas} horas. ${partes[1].texto}`,
    },
    {
      clave: "lluvia",
      suma: fP > 0,
      aporte: partes[2].valor,
      texto: textoLluvia(s, totalDias),
      nota: `Cuenta completo desde ${UMBRAL.diasConLluvia} días. ${partes[2].texto}`,
    },
  ];
  return {
    nivel: nivelPor(irf, CORTES_ROYA),
    valor: irf,
    dato: `Índice ${irf} de 100`,
    factores,
  };
}

export function riesgoBroca(
  s: Semana,
  totalDias: number,
  altura: number,
  /** Reportes o confirmaciones de broca de otras fincas cercanas. */
  plagaEnZona: number,
): RiesgoPlaga {
  const temp = s.temperatura > UMBRAL.brocaTemperatura;
  const baja = altura < UMBRAL.brocaAltura;
  const lluvia = s.diasConLluvia >= UMBRAL.diasConLluvia;
  const vecinos = plagaEnZona > 0;
  const senales = [temp, baja, lluvia, vecinos].filter(Boolean).length;
  return {
    nivel: nivelPor(senales, CORTES_BROCA),
    valor: senales,
    dato: `${senales} de 4 señales`,
    factores: [
      {
        clave: "temperatura",
        suma: temp,
        aporte: temp ? 1 : 0,
        texto: `Temperatura promedio ${decimal(s.temperatura)} °C`,
        nota: `La broca se favorece por encima de ${UMBRAL.brocaTemperatura} °C.`,
      },
      {
        clave: "altura",
        suma: baja,
        aporte: baja ? 1 : 0,
        texto: `Su finca está a ${miles(altura)} m`,
        nota: `La broca ataca más por debajo de ${miles(UMBRAL.brocaAltura)} m.`,
      },
      {
        clave: "lluvia",
        suma: lluvia,
        aporte: lluvia ? 1 : 0,
        texto: textoLluvia(s, totalDias),
        nota: `La lluvia ayuda a la broca. Cuenta desde ${UMBRAL.diasConLluvia} días.`,
      },
      {
        clave: "vecinos",
        suma: vecinos,
        aporte: vecinos ? 1 : 0,
        texto:
          plagaEnZona === 0
            ? "Sin reportes de broca de vecinos"
            : plagaEnZona === 1
              ? "1 reporte de broca de vecinos"
              : `${plagaEnZona} reportes de broca de vecinos`,
        nota: NOTA_VECINOS,
      },
    ],
  };
}

export function calcularInforme(
  clima: ClimaFinca,
  opciones: { altura: number; plagaEnZona: number },
): Informe {
  const { altura } = opciones;
  const corregir = (t: number) =>
    Math.round(corregirPorAltitud(t, clima.alturaModelo, altura) * 10) / 10;
  const dias = clima.dias.map((d) => ({
    ...d,
    horas: d.horas.map((h) => ({ ...h, temperatura: corregir(h.temperatura) })),
  }));
  const s = resumirSemana(dias);
  const n = dias.length;
  const lluvia = Math.round(s.lluviaTotal);
  return {
    calculado: clima.obtenido,
    altura,
    alturaModelo: clima.alturaModelo,
    roya: riesgoRoya(s, n),
    broca: riesgoBroca(s, n, altura, opciones.plagaEnZona),
    ahora: { ...clima.ahora, temperatura: corregir(clima.ahora.temperatura) },
    indicadores: {
      temperatura: Math.round(s.temperatura * 10) / 10,
      horasHumedas: s.horasHumedas,
      diasConLluvia: s.diasConLluvia,
      lluviaTotal: Math.round(s.lluviaTotal * 10) / 10,
    },
    semana: {
      dias: s.nombres,
      lluvia: s.lluviaDia,
      temperatura: s.temperaturaDia,
      resumen: `${textoLluvia(s, n)} (${lluvia} mm en total), ${s.horasHumedas} horas muy húmedas y ${decimal(s.temperatura)} °C de promedio.`,
    },
    ideam: null,
  };
}
