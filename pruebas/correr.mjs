// Pruebas experimentales del prototipo «Mi Cafetal» (Etapa 4).
// No modifica la app: importa sus módulos de cálculo tal como están y, si la
// app está corriendo, le hace peticiones HTTP reales y cronometra.
//
// Uso (desde la carpeta del proyecto, con Node 24):
//   node pruebas/correr.mjs                      # P1–P4 (motor), sin servidor
//   MICAFETAL_DB=data/pruebas.db npm run dev     # en otra terminal
//   MICAFETAL_DB=data/pruebas.db node pruebas/correr.mjs   # P1–P7 completas
//
// Resultados: pruebas/resultados/*.csv (abren en Excel) y reporte.html
// (tablas resumen + gráficos de dispersión frente a los KPI).

import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { register } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Node avisa al importar .ts sin "type": "module"; el aviso es inofensivo y
// la app no se toca, así que el script se relanza a sí mismo sin ese aviso.
const SIN_AVISO = "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON";
if (!process.execArgv.includes(SIN_AVISO)) {
  const { spawnSync } = await import("node:child_process");
  const r = spawnSync(process.execPath, [SIN_AVISO, ...process.execArgv, ...process.argv.slice(1)], { stdio: "inherit" });
  process.exit(r.status ?? 1);
}

register("./cargador.mjs", import.meta.url);

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, "..");
const SALIDA = path.join(AQUI, "resultados");
const URL_APP = (
  process.argv.find((a) => a.startsWith("--url="))?.slice(6) ??
  "http://localhost:3000"
).replace(/\/$/, "");

const desde = (r) => import(pathToFileURL(path.join(RAIZ, r)).href);
const riesgo = await desde("src/lib/riesgo.ts");
const mensajes = await desde("src/lib/mensajes.ts");

mkdirSync(SALIDA, { recursive: true });

// ── Utilidades ──────────────────────────────────────────────────────────

const r1 = (n) => Math.round(n * 10) / 10;
const r2 = (n) => Math.round(n * 100) / 100;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

/** CSV con «;» y coma decimal: así lo abre bien Excel en español. */
function csv(nombre, filas) {
  const cols = Object.keys(filas[0]);
  const celda = (v) => {
    if (typeof v === "number") return String(v).replace(".", ",");
    if (typeof v === "boolean") return v ? "sí" : "no";
    const s = String(v ?? "");
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const texto = [cols.join(";"), ...filas.map((f) => cols.map((c) => celda(f[c])).join(";"))].join("\n");
  writeFileSync(path.join(SALIDA, nombre), `﻿${texto}\n`);
}

/** Semana sintética: 7 días × 24 h con T constante, H horas con HR 95 % y D días con 2 mm. */
function semana({ t, horasHumedas, diasLluvia, hrHumeda = 95, mmDia = 2 }) {
  let humedasRestantes = horasHumedas;
  return Array.from({ length: 7 }, (_, d) => ({
    fecha: `2026-11-${String(10 + d).padStart(2, "0")}`,
    horas: Array.from({ length: 24 }, (_, h) => {
      const humeda = humedasRestantes-- > 0;
      return {
        temperatura: t,
        humedad: humeda ? hrHumeda : 70,
        lluvia: d < diasLluvia && h === 15 ? mmDia : 0,
      };
    }),
  }));
}

/** Cálculo «a mano» del IRF, escrito aparte del código de la app (Etapa 3, cálculo G). */
function irfAMano(t, horasHumedas, diasLluvia) {
  const fT = t >= 14 && t <= 24 ? 1 : 0;
  const fHR = Math.min(1, horasHumedas / 48);
  const fP = Math.min(1, diasLluvia / 4);
  const irf = Math.round(100 * (0.3 * fT + 0.4 * fHR + 0.3 * fP));
  const nivel = irf >= 70 ? "alto" : irf >= 40 ? "medio" : "bajo";
  return { fT, fHR: r2(fHR), fP: r2(fP), irf, nivel };
}

/** Alfabeto GSM 7 bits (básico + extensión, que cuesta 2). Otro carácter obliga a UCS-2 (70 por segmento). */
const GSM_BASICO = "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM_EXT = "^{}\\[~]|€";
function segmentosSms(texto) {
  const chars = [...texto];
  const gsm = chars.every((c) => GSM_BASICO.includes(c) || GSM_EXT.includes(c));
  if (!gsm) return { codificacion: "UCS-2", unidades: chars.length, limite: 70, segmentos: chars.length <= 70 ? 1 : Math.ceil(chars.length / 67) };
  const septetos = chars.reduce((a, c) => a + (GSM_EXT.includes(c) ? 2 : 1), 0);
  return { codificacion: "GSM-7", unidades: septetos, limite: 160, segmentos: septetos <= 160 ? 1 : Math.ceil(septetos / 153) };
}

async function pedir(metodo, ruta, cuerpo) {
  const t0 = performance.now();
  const res = await fetch(URL_APP + ruta, {
    method: metodo,
    headers: cuerpo ? { "content-type": "application/json" } : undefined,
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { ms: r1(performance.now() - t0), status: res.status, json };
}

async function servidorArriba() {
  try {
    // Sin parámetros, /api/riesgo responde 400: basta con que responda.
    const r = await fetch(`${URL_APP}/api/riesgo`, { signal: AbortSignal.timeout(15000) });
    return r.status === 400;
  } catch {
    return false;
  }
}

const resumen = []; // filas de la tabla de KPI
const graficos = []; // { titulo, svg, nota }

// ── P1. IRF de roya: app vs cálculo a mano ─────────────────────────────

const casosRoya = [
  // Ejemplo de la Etapa 3 (cálculo G): 22,5 °C, 36 h, 5 días → IRF 90.
  { t: 22.5, horasHumedas: 36, diasLluvia: 5, nota: "Ejemplo Etapa 3" },
  // Bordes de los umbrales.
  { t: 14, horasHumedas: 0, diasLluvia: 0, nota: "T en el límite inferior" },
  { t: 24, horasHumedas: 0, diasLluvia: 0, nota: "T en el límite superior" },
  { t: 13.9, horasHumedas: 48, diasLluvia: 4, nota: "T apenas bajo el rango" },
  { t: 24.1, horasHumedas: 48, diasLluvia: 4, nota: "T apenas sobre el rango" },
  { t: 20, horasHumedas: 48, diasLluvia: 4, nota: "Todo al máximo" },
  { t: 20, horasHumedas: 168, diasLluvia: 7, nota: "Semana saturada" },
  { t: 20, horasHumedas: 0, diasLluvia: 0, nota: "Solo temperatura" },
];
// Rejilla de casos combinados.
for (const t of [12, 18, 22, 26]) {
  for (const horasHumedas of [6, 24, 40]) {
    for (const diasLluvia of [1, 3]) casosRoya.push({ t, horasHumedas, diasLluvia, nota: "Rejilla" });
  }
}

const filasP1 = casosRoya.map((c, i) => {
  const s = riesgo.resumirSemana(semana(c));
  const app = riesgo.riesgoRoya(s, 7);
  const mano = irfAMano(c.t, c.horasHumedas, c.diasLluvia);
  return {
    caso: i + 1,
    descripcion: c.nota,
    T_media_C: c.t,
    horas_HR_mayor_90: c.horasHumedas,
    dias_con_lluvia: c.diasLluvia,
    fT: mano.fT,
    fHR: mano.fHR,
    fP: mano.fP,
    IRF_a_mano: mano.irf,
    IRF_app: app.valor,
    desvio: app.valor - mano.irf,
    nivel_a_mano: mano.nivel,
    nivel_app: app.nivel,
    coincide: app.valor === mano.irf && app.nivel === mano.nivel,
  };
});
csv("P1_irf_roya.csv", filasP1);
const okP1 = filasP1.filter((f) => f.coincide).length;
resumen.push({
  prueba: "P1",
  kpi: "IRF de roya = 100·(0,3fT+0,4fHR+0,3fP)",
  meta: "Desvío 0 frente al cálculo a mano",
  medido: `${okP1}/${filasP1.length} casos iguales; desvío máx. ${Math.max(...filasP1.map((f) => Math.abs(f.desvio)))}`,
  cumple: okP1 === filasP1.length,
});
graficos.push({
  titulo: "P1. IRF calculado a mano vs IRF de la app",
  svg: dispersion({
    puntos: filasP1.map((f) => ({ x: f.IRF_a_mano, y: f.IRF_app })),
    ejeX: "IRF a mano (Etapa 3)",
    ejeY: "IRF de la app",
    xMax: 100,
    yMax: 100,
    identidad: true,
    lineasY: [
      { y: 40, texto: "medio ≥ 40" },
      { y: 70, texto: "alto ≥ 70" },
    ],
  }),
  nota: "Si todos los puntos caen sobre la diagonal, el motor reproduce exactamente el modelo de la Etapa 3.",
});

// Bordes de los datos: HR = 90 % exacto y lluvia < 1 mm no deben contar.
const bordeHR = riesgo.resumirSemana(semana({ t: 20, horasHumedas: 48, diasLluvia: 0, hrHumeda: 90 }));
const bordeMm = riesgo.resumirSemana(semana({ t: 20, horasHumedas: 0, diasLluvia: 7, mmDia: 0.9 }));
const filasP1b = [
  { caso: "48 h con HR = 90 % exacto", esperado_horas_o_dias: 0, app: bordeHR.horasHumedas },
  { caso: "7 días con 0,9 mm", esperado_horas_o_dias: 0, app: bordeMm.diasConLluvia },
].map((f) => ({ ...f, coincide: f.app === f.esperado_horas_o_dias }));
csv("P1b_bordes_umbral.csv", filasP1b);

// ── P2. Broca: 0–4 señales, las 16 combinaciones ───────────────────────

const filasP2 = [];
for (let m = 0; m < 16; m++) {
  const calor = !!(m & 1);
  const baja = !!(m & 2);
  const lluvia = !!(m & 4);
  const vecinos = !!(m & 8);
  const t = calor ? 22 : 19;
  const altura = baja ? 1100 : 1500;
  const s = riesgo.resumirSemana(semana({ t, horasHumedas: 0, diasLluvia: lluvia ? 4 : 2 }));
  const app = riesgo.riesgoBroca(s, 7, altura, vecinos ? 1 : 0);
  const esperado = [calor, baja, lluvia, vecinos].filter(Boolean).length;
  const nivelEsperado = esperado >= 3 ? "alto" : esperado >= 2 ? "medio" : "bajo";
  filasP2.push({
    caso: m + 1,
    T_mayor_21C: calor,
    altura_menor_1200m: baja,
    lluvia_4_dias_o_mas: lluvia,
    broca_vecinos_10km: vecinos,
    puntos_esperados: esperado,
    puntos_app: app.valor,
    nivel_esperado: nivelEsperado,
    nivel_app: app.nivel,
    coincide: esperado === app.valor && nivelEsperado === app.nivel,
  });
}
csv("P2_broca_puntos.csv", filasP2);
const okP2 = filasP2.filter((f) => f.coincide).length;
resumen.push({
  prueba: "P2",
  kpi: "Broca: puntos 0–4 (medio ≥ 2, alto ≥ 3)",
  meta: "16/16 combinaciones correctas",
  medido: `${okP2}/16`,
  cumple: okP2 === 16,
});

// ── P3. Mensajes de alerta ≤ 70 caracteres (1 segmento SMS) ───────────

const filasP3 = [];
const variantes = [
  ...filasP1.map((f, i) => ({ plaga: "roya", r: riesgo.riesgoRoya(riesgo.resumirSemana(semana(casosRoya[i])), 7) })),
  ...filasP2.map((f) => {
    const s = riesgo.resumirSemana(
      semana({ t: f.T_mayor_21C ? 22 : 19, horasHumedas: 0, diasLluvia: f.lluvia_4_dias_o_mas ? 4 : 2 }),
    );
    return { plaga: "broca", r: riesgo.riesgoBroca(s, 7, f.altura_menor_1200m ? 1100 : 1500, f.broca_vecinos_10km ? 1 : 0) };
  }),
];
const vistos = new Set();
for (const { plaga, r } of variantes) {
  const texto = mensajes.mensajeAlerta(plaga, r);
  if (vistos.has(texto)) continue;
  vistos.add(texto);
  const sms = segmentosSms(texto);
  filasP3.push({ n: filasP3.length + 1, origen: "App", plaga, nivel: r.nivel, mensaje: texto, caracteres: texto.length, ...sms, cumple_70: texto.length <= 70 });
}
// Mensajes de ejemplo escritos en la Etapa 3, medidos de verdad.
for (const [texto, declarado] of [
  ["ALERTA ROYA: Finca [ID]. Temp 22C, HR 92%. Accion: Revisar hojas bajas. Mas info en [URL]", 68],
  ["ROYA ALTA finca 023. Revise hojas bajas hoy. Info: lnk.co/a1", 60],
  ["Riesgo alto de broca; revise los frutos esta semana.", null],
]) {
  const sms = segmentosSms(texto);
  filasP3.push({
    n: filasP3.length + 1,
    origen: `Etapa 3${declarado ? ` (declaraba ${declarado})` : ""}`,
    plaga: /broca/i.test(texto) ? "broca" : "roya",
    nivel: "alto",
    mensaje: texto,
    caracteres: texto.length,
    ...sms,
    cumple_70: texto.length <= 70,
  });
}
csv("P3_mensajes_sms.csv", filasP3);
const deApp = filasP3.filter((f) => f.origen === "App");
resumen.push({
  prueba: "P3",
  kpi: "Mensaje SMS ≤ 70 caracteres",
  meta: "100 % de los mensajes en 1 segmento",
  medido: `${deApp.filter((f) => f.cumple_70).length}/${deApp.length} mensajes distintos; máx. ${Math.max(...deApp.map((f) => f.caracteres))} car.`,
  cumple: deApp.every((f) => f.cumple_70),
});
graficos.push({
  titulo: "P3. Longitud de cada mensaje frente al límite de 70 caracteres",
  svg: dispersion({
    puntos: filasP3.map((f) => ({ x: f.n, y: f.caracteres, serie: f.origen === "App" ? 0 : 1 })),
    series: ["Mensajes de la app", "Ejemplos escritos en la Etapa 3"],
    ejeX: "Mensaje n.º",
    ejeY: "Caracteres",
    yMax: 100,
    lineasY: [{ y: 70, texto: "KPI: 70 (1 SMS UCS-2)" }],
  }),
  nota: "Los ejemplos de la Etapa 3 se midieron carácter por carácter; el valor declarado en el informe aparece en el CSV.",
});

// ── P4. Corrección por altitud ─────────────────────────────────────────

const filasP4 = [];
for (let h = 1000; h <= 2200; h += 100) {
  const app = riesgo.corregirPorAltitud(20, 1500, h);
  const mano = 20 + 0.0065 * (1500 - h);
  filasP4.push({ altura_finca_m: h, T_estacion_C: 20, altura_estacion_m: 1500, T_a_mano: r2(mano), T_app: r2(app), desvio: r2(app - mano) });
}
csv("P4_altitud.csv", filasP4);
resumen.push({
  prueba: "P4",
  kpi: "T_finca = T_est + 0,0065·(h_est − h_finca)",
  meta: "Desvío 0 °C",
  medido: `desvío máx. ${Math.max(...filasP4.map((f) => Math.abs(f.desvio)))} °C`,
  cumple: filasP4.every((f) => f.desvio === 0),
});
graficos.push({
  titulo: "P4. Temperatura corregida según la altura de la finca (estación a 1.500 m y 20 °C)",
  svg: dispersion({
    puntos: filasP4.map((f) => ({ x: f.altura_finca_m, y: f.T_app })),
    ejeX: "Altura de la finca (m)",
    ejeY: "T corregida (°C)",
    xMin: 1000,
    xMax: 2200,
    yMin: 15,
    yMax: 25,
    lineasY: [{ y: 21, texto: "broca > 21 °C" }],
  }),
  nota: "Pendiente esperada: −0,65 °C por cada 100 m.",
});

// ── P5–P7: contra la app en marcha ─────────────────────────────────────

const arriba = await servidorArriba();
if (!arriba) {
  console.log(`\n⚠  No hay app en ${URL_APP}: se omiten P5–P7 (tiempo de respuesta, sincronización, indicador A).`);
  console.log("   Arranque la app con:  MICAFETAL_DB=data/pruebas.db npm run dev\n");
} else {
  // P5. Tiempo de respuesta real de /api/riesgo
  const puntos = [
    { nombre: "Chinchiná (f1)", lat: 4.983, lon: -75.604, alt: 1360 },
    { nombre: "Manizales (f3)", lat: 5.03, lon: -75.55, alt: 1800 },
    { nombre: "Montenegro (f9)", lat: 4.566, lon: -75.751, alt: 1250 },
    { nombre: "Pereira", lat: 4.81, lon: -75.69, alt: 1450 },
    { nombre: "Santa Rosa de Cabal", lat: 4.87, lon: -75.62, alt: 1700 },
    { nombre: "Armenia", lat: 4.53, lon: -75.68, alt: 1480 },
    { nombre: "Salento", lat: 4.64, lon: -75.57, alt: 1890 },
    { nombre: "Belalcázar", lat: 4.99, lon: -75.81, alt: 1600 },
  ];
  const REPETICIONES = 4;
  const filasP5 = [];
  let intento = 0;
  for (const p of puntos) {
    for (let k = 0; k <= REPETICIONES; k++) {
      const r = await pedir("GET", `/api/riesgo?lat=${p.lat}&lon=${p.lon}&alt=${p.alt}`);
      intento++;
      filasP5.push({
        intento,
        punto: p.nombre,
        tipo: k === 0 ? "en frío (consulta Open-Meteo)" : "con caché",
        http: r.status,
        ms_api_motor: r.ms,
        ms_pasarela_supuesta: 5000,
        T_resp_estimado_s: r2((r.ms + 5000) / 1000),
        IRF: r.json?.roya?.valor ?? "",
        broca_puntos: r.json?.broca?.valor ?? "",
        T_media_C: r.json?.indicadores?.temperatura ?? "",
        horas_HR_mayor_90: r.json?.indicadores?.horasHumedas ?? "",
        dias_con_lluvia: r.json?.indicadores?.diasConLluvia ?? "",
        IRF_a_mano: r.json?.indicadores
          ? irfAMano(r.json.indicadores.temperatura, r.json.indicadores.horasHumedas, r.json.indicadores.diasConLluvia).irf
          : "",
      });
    }
  }
  const ciclo = await pedir("POST", "/api/ciclo");
  csv("P5_tiempo_respuesta.csv", filasP5);
  const frio = filasP5.filter((f) => f.tipo.startsWith("en frío") && f.http === 200);
  const caliente = filasP5.filter((f) => f.tipo === "con caché" && f.http === 200);
  const prom = (a) => (a.length ? r1(a.reduce((x, f) => x + f.ms_api_motor, 0) / a.length) : NaN);
  const maxFrio = frio.length ? Math.max(...frio.map((f) => f.ms_api_motor)) : NaN;
  const fallidas = filasP5.filter((f) => f.http !== 200);
  resumen.push({
    prueba: "P5",
    kpi: "T_resp ≤ 8 s (API 2 s + motor 1 s + pasarela 5 s)",
    meta: "API + motor ≤ 3.000 ms",
    medido: frio.length
      ? `en frío prom. ${prom(frio)} ms (máx. ${maxFrio}); con caché prom. ${prom(caliente)} ms; ciclo de ${ciclo.json?.fincas?.length ?? "?"} fincas: ${ciclo.ms} ms; T_resp estimado máx. ${r2((maxFrio + 5000) / 1000)} s${fallidas.length ? `; ${fallidas.length} peticiones fallidas` : ""}`
      : `sin datos: Open-Meteo no respondió (HTTP ${fallidas[0]?.http}); revise la conexión a internet`,
    cumple: frio.length > 0 && maxFrio <= 3000 ? true : frio.length ? false : "sin datos",
  });
  graficos.push({
    titulo: "P5. Tiempo de respuesta medido de /api/riesgo",
    svg: dispersion({
      puntos: filasP5.filter((f) => f.http === 200).map((f) => ({ x: f.intento, y: f.ms_api_motor, serie: f.tipo === "con caché" ? 1 : 0 })),
      series: ["En frío (consulta Open-Meteo)", "Con caché (15 min)"],
      ejeX: "Petición n.º",
      ejeY: "ms (API + motor)",
      yMin: 0,
      lineasY: [{ y: 3000, texto: "presupuesto API + motor: 3.000 ms" }],
    }),
    nota: "La pasarela SMS/WhatsApp está simulada; se suman los 5 s supuestos en la Etapa 3 para estimar T_resp.",
  });
  // IRF con clima real: la app frente al cálculo a mano con los mismos indicadores.
  const conIrf = filasP5.filter((f) => f.tipo.startsWith("en frío") && f.IRF !== "");
  if (conIrf.length) {
    const iguales = conIrf.filter((f) => f.IRF === f.IRF_a_mano).length;
    resumen.push({
      prueba: "P5b",
      kpi: "IRF con clima real de Open-Meteo",
      meta: "Igual al cálculo a mano",
      medido: `${iguales}/${conIrf.length} puntos iguales`,
      cumple: iguales === conIrf.length,
    });
    graficos.push({
      titulo: "P5b. Clima real: horas con HR > 90 % vs IRF de cada punto",
      svg: dispersion({
        puntos: conIrf.map((f) => ({ x: f.horas_HR_mayor_90, y: f.IRF })),
        ejeX: "Horas con HR > 90 % (últimos 7 días)",
        ejeY: "IRF de la app",
        yMin: 0,
        yMax: 100,
        lineasY: [
          { y: 40, texto: "medio" },
          { y: 70, texto: "alto" },
        ],
      }),
      nota: "Muestra cuánto pesa la humedad (40 %) en el índice con datos reales del Eje Cafetero.",
    });
  }

  // P6. Sincronización de la cola sin señal
  const dispositivo = `prueba-${Date.now()}`;
  const fincaId = `prueba-sinc-${Date.now()}`;
  const ahora = new Date().toISOString();
  let id = 1;
  // Finca de prueba lejos de la zona cafetera para no afectar «plaga en la zona».
  await pedir("POST", "/api/sincronizar", {
    dispositivo,
    items: [{ id: id++, texto: "", guardado: ahora, fincaId, contenido: { tipo: "finca", nombre: "Finca de prueba (sincronización)", altura: 300, lat: 3.0, lon: -72.0 } }],
  });
  const reporte = (valido) => ({
    id: id++,
    texto: "",
    guardado: ahora,
    fincaId,
    contenido: { tipo: "reporte", hallazgo: valido ? "nada" : "hongo", porcentaje: valido ? 0 : 150, floracion: null, fecha: ahora.slice(0, 10), notas: "prueba automática" },
  });
  const filasP6 = [];
  for (const tam of [1, 5, 10, 25, 50, 100, 200]) {
    const invalidos = Math.floor(tam / 10);
    const items = Array.from({ length: tam }, (_, i) => reporte(i >= invalidos));
    const r1v = await pedir("POST", "/api/sincronizar", { dispositivo, items });
    const r2v = await pedir("POST", "/api/sincronizar", { dispositivo, items }); // reenvío (señal intermitente)
    filasP6.push({
      items_en_cola: tam,
      invalidos_enviados: invalidos,
      recibidos: r1v.json?.recibidos?.length ?? 0,
      descartados: r1v.json?.descartados?.length ?? 0,
      ms_envio: r1v.ms,
      ms_por_item: r2(r1v.ms / tam),
      ms_reenvio: r2v.ms,
      correcto: (r1v.json?.recibidos?.length ?? -1) === tam - invalidos && (r1v.json?.descartados?.length ?? -1) === invalidos,
    });
  }
  // Duplicados: se cuentan en la base, que es lo que importa.
  let duplicados = "no medido";
  try {
    const { DatabaseSync } = await import("node:sqlite");
    const ruta = path.resolve(RAIZ, process.env.MICAFETAL_DB ?? "data/micafetal.db");
    if (existsSync(ruta)) {
      const db = new DatabaseSync(ruta, { readOnly: true });
      const guardados = db.prepare("SELECT COUNT(*) AS n FROM reportes WHERE dispositivo = ?").get(dispositivo).n;
      const esperados = filasP6.reduce((a, f) => a + f.recibidos, 0);
      duplicados = Number(guardados) - esperados;
      db.close();
    }
  } catch (err) {
    duplicados = `no medido (${err.message})`;
  }
  csv("P6_sincronizacion.csv", filasP6.map((f) => ({ ...f, duplicados_en_base_tras_reenvio: duplicados })));
  resumen.push({
    prueba: "P6",
    kpi: "Cola sin señal: todo llega una sola vez",
    meta: "Válidos recibidos, inválidos descartados, 0 duplicados",
    medido: `${filasP6.filter((f) => f.correcto).length}/${filasP6.length} envíos correctos; duplicados en base: ${duplicados}; 200 ítems en ${filasP6.at(-1).ms_envio} ms`,
    cumple: filasP6.every((f) => f.correcto) && duplicados === 0,
  });
  graficos.push({
    titulo: "P6. Tamaño de la cola guardada sin señal vs tiempo de sincronización",
    svg: dispersion({
      puntos: [
        ...filasP6.map((f) => ({ x: f.items_en_cola, y: f.ms_envio, serie: 0 })),
        ...filasP6.map((f) => ({ x: f.items_en_cola, y: f.ms_reenvio, serie: 1 })),
      ],
      series: ["Primer envío", "Reenvío (duplicados ignorados)"],
      ejeX: "Ítems en la cola",
      ejeY: "ms",
      xMin: 0,
      yMin: 0,
    }),
    nota: "Cada cola lleva 10 % de reportes inválidos a propósito (porcentaje 150, hallazgo desconocido).",
  });

  // P7. Indicador A (retroalimentación), leído de la base
  try {
    const { DatabaseSync } = await import("node:sqlite");
    const ruta = path.resolve(RAIZ, process.env.MICAFETAL_DB ?? "data/micafetal.db");
    const db = new DatabaseSync(ruta, { readOnly: true });
    const a = db
      .prepare("SELECT COUNT(*) AS enviadas, COUNT(confirmada) AS respondidas, COALESCE(SUM(confirmada = 1), 0) AS confirmadas FROM alertas")
      .get();
    db.close();
    const enviadas = Number(a.enviadas);
    const confirmadas = Number(a.confirmadas);
    resumen.push({
      prueba: "P7",
      kpi: "A = confirmadas / enviadas × 100",
      meta: "A ≥ 80 %",
      medido: enviadas
        ? `${confirmadas}/${enviadas} = ${Math.round((100 * confirmadas) / enviadas)} % (${a.respondidas} respondidas)`
        : "0 alertas enviadas: A no se puede calcular todavía",
      cumple: enviadas ? (100 * confirmadas) / enviadas >= 80 : "sin datos",
    });
  } catch (err) {
    console.log("P7 omitida:", err.message);
  }
}

// ── Reporte ────────────────────────────────────────────────────────────

csv("resumen_kpi.csv", resumen.map((f) => ({ ...f, cumple: f.cumple === true ? "sí" : f.cumple === false ? "NO" : f.cumple })));

const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pruebas Mi Cafetal</title>
<style>
body{font:15px/1.5 system-ui,sans-serif;max-width:960px;margin:24px auto;padding:0 16px;color:#1d2a1f;background:#fbfaf6}
h1{font-size:24px}h2{font-size:18px;margin-top:32px}
table{border-collapse:collapse;width:100%;font-size:14px}th,td{border:1px solid #d9d4c7;padding:6px 8px;text-align:left;vertical-align:top}
th{background:#eef0e6}.si{color:#2d6a3e;font-weight:700}.no{color:#b3261e;font-weight:700}
figure{margin:16px 0 28px}figcaption{font-size:13px;color:#555}svg{width:100%;height:auto;background:#fff;border:1px solid #e3dfd3}
</style></head><body>
<h1>Pruebas experimentales del prototipo Mi Cafetal</h1>
<p>Ejecutado el ${new Date().toLocaleString("es-CO")} · app: ${arriba ? esc(URL_APP) : "no estaba corriendo (solo P1–P4)"} · tablas completas en la carpeta <code>resultados/</code>.</p>
<h2>Resumen frente a los KPI de la Etapa 3</h2>
<table><tr><th>Prueba</th><th>KPI</th><th>Meta</th><th>Medido</th><th>¿Cumple?</th></tr>
${resumen.map((f) => `<tr><td>${f.prueba}</td><td>${esc(f.kpi)}</td><td>${esc(f.meta)}</td><td>${esc(f.medido)}</td><td class="${f.cumple === true ? "si" : "no"}">${f.cumple === true ? "Sí" : f.cumple === false ? "No" : esc(f.cumple)}</td></tr>`).join("\n")}
</table>
<h2>Gráficos de dispersión</h2>
${graficos.map((g) => `<figure><h3>${esc(g.titulo)}</h3>${g.svg}<figcaption>${esc(g.nota)}</figcaption></figure>`).join("\n")}
<h2>Mensajes probados (P3)</h2>
<table><tr><th>Origen</th><th>Mensaje</th><th>Caracteres</th><th>Codificación</th><th>Segmentos</th></tr>
${filasP3.map((f) => `<tr><td>${esc(f.origen)}</td><td>${esc(f.mensaje)}</td><td class="${f.cumple_70 ? "si" : "no"}">${f.caracteres}</td><td>${f.codificacion}</td><td>${f.segmentos}</td></tr>`).join("\n")}
</table>
</body></html>`;
writeFileSync(path.join(SALIDA, "reporte.html"), html);

console.log("\nResumen:");
for (const f of resumen) console.log(`  ${f.prueba.padEnd(4)} ${f.cumple === true ? "✔" : "✘"}  ${f.kpi} → ${f.medido}`);
console.log(`\nResultados en ${path.relative(process.cwd(), SALIDA) || "."}/ (CSV + reporte.html)\n`);

// ── Gráfico de dispersión en SVG (sin librerías) ───────────────────────

function dispersion({ puntos, ejeX, ejeY, xMin, xMax, yMin, yMax, lineasY = [], identidad = false, series = [] }) {
  const W = 720, H = 360, m = { i: 64, d: 24, a: 20, b: 52 };
  const xs = puntos.map((p) => p.x), ys = puntos.map((p) => p.y).concat(lineasY.map((l) => l.y));
  const x0 = xMin ?? Math.min(0, ...xs), x1 = xMax ?? (Math.max(...xs) * 1.05 || 1);
  const y0 = yMin ?? Math.min(0, ...ys), y1 = yMax ?? (Math.max(...ys) * 1.1 || 1);
  const X = (v) => m.i + ((v - x0) / (x1 - x0)) * (W - m.i - m.d);
  const Y = (v) => H - m.b - ((v - y0) / (y1 - y0)) * (H - m.a - m.b);
  const colores = ["#2f6f4e", "#c2621b"];
  const ticks = (a, b) => Array.from({ length: 6 }, (_, i) => a + ((b - a) * i) / 5);
  const fmt = (v) => (Math.abs(v) >= 100 ? Math.round(v).toLocaleString("es-CO") : r1(v).toString().replace(".", ","));
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(ejeY)} frente a ${esc(ejeX)}" font-family="system-ui,sans-serif" font-size="12">`;
  for (const t of ticks(y0, y1)) s += `<line x1="${m.i}" x2="${W - m.d}" y1="${Y(t)}" y2="${Y(t)}" stroke="#eee"/><text x="${m.i - 6}" y="${Y(t) + 4}" text-anchor="end" fill="#666">${fmt(t)}</text>`;
  for (const t of ticks(x0, x1)) s += `<text x="${X(t)}" y="${H - m.b + 18}" text-anchor="middle" fill="#666">${fmt(t)}</text>`;
  s += `<line x1="${m.i}" x2="${W - m.d}" y1="${H - m.b}" y2="${H - m.b}" stroke="#999"/><line x1="${m.i}" x2="${m.i}" y1="${m.a}" y2="${H - m.b}" stroke="#999"/>`;
  if (identidad) s += `<line x1="${X(Math.max(x0, y0))}" y1="${Y(Math.max(x0, y0))}" x2="${X(Math.min(x1, y1))}" y2="${Y(Math.min(x1, y1))}" stroke="#999" stroke-dasharray="4 4"/>`;
  for (const l of lineasY) s += `<line x1="${m.i}" x2="${W - m.d}" y1="${Y(l.y)}" y2="${Y(l.y)}" stroke="#b3261e" stroke-dasharray="6 4"/><text x="${W - m.d - 4}" y="${Y(l.y) - 5}" text-anchor="end" fill="#b3261e">${esc(l.texto)}</text>`;
  for (const p of puntos) s += `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="5" fill="${colores[p.serie ?? 0]}" fill-opacity="0.75" stroke="#fff"/>`;
  s += `<text x="${(m.i + W - m.d) / 2}" y="${H - 12}" text-anchor="middle" fill="#333">${esc(ejeX)}</text>`;
  s += `<text transform="translate(16 ${(m.a + H - m.b) / 2}) rotate(-90)" text-anchor="middle" fill="#333">${esc(ejeY)}</text>`;
  series.forEach((n, i) => {
    s += `<circle cx="${m.i + 14 + i * 260}" cy="${m.a + 6}" r="5" fill="${colores[i]}"/><text x="${m.i + 24 + i * 260}" y="${m.a + 10}" fill="#333">${esc(n)}</text>`;
  });
  return `${s}</svg>`;
}
