import {
  buscarFinca,
  type FincaNueva,
  type Informe,
  type PlagaId,
} from "./datos";

export type Tab = "riesgo" | "clima" | "reportar";
export type Hallazgo = "nada" | "roya" | "broca" | "ambas";
export type Floracion = "no" | "empezando" | "plena";
export type Respuesta = "si" | "no";

export type AvisoTipo =
  | "guardado-local"
  | "enviando"
  | "enviado"
  | "enviados"
  | "falta"
  | "registrada"
  | "sin-ubicacion"
  | "fallo-envio";
export type Aviso = { tipo: AvisoTipo; n: number };

export type ItemCola = {
  id: number;
  texto: string;
  /** Momento en que se guardó en el celular (ISO). */
  guardado: string;
  fincaId: string;
  contenido:
    | {
        tipo: "reporte";
        hallazgo: Hallazgo;
        porcentaje: number;
        floracion: Floracion | null;
        fecha: string;
        notas: string;
      }
    | { tipo: "respuesta"; plaga: PlagaId; valor: Respuesta }
    | {
        tipo: "finca";
        nombre: string;
        altura: number | null;
        lat: number;
        lon: number;
      };
};

export type Formulario = {
  hallazgo: Hallazgo | null;
  porcentaje: number;
  floracion: Floracion | null;
  fecha: string;
  notas: string;
};

export type Registro = { nombre: string; altura: string; enviando: boolean };

/** Lo que sobrevive a cerrar la app. */
export type Guardado = {
  fincaId: string | null;
  nueva: FincaNueva | null;
  respuesta: Partial<Record<PlagaId, Respuesta>>;
  cola: ItemCola[];
  siguienteId: number;
  /** Último cálculo de cada finca, para mostrarlo sin señal. */
  informes: Record<string, Informe>;
  /** Identifica este celular ante el servidor (evita duplicar reenvíos). */
  dispositivo: string;
};

/** Consulta del clima en curso o fallida. */
export type Consulta = { fincaId: string; estado: "cargando" | "error" };

export type Estado = Guardado & {
  /** false hasta leer lo guardado en el celular (evita mostrar la pantalla equivocada). */
  cargado: boolean;
  online: boolean;
  tab: Tab;
  abierto: Record<string, boolean>;
  /** Envío en curso: tras guardar con señal, o automático al volver la señal. */
  /**
   * guardar: reporte recién guardado (avisa «Enviado»); auto: lo que esperaba
   * señal (avisa «Todo enviado»); fondo: respuestas y registro (sin aviso).
   */
  envio: "guardar" | "auto" | "fondo" | null;
  /** Tras un envío fallido no se reintenta hasta que cambie la señal o la cola. */
  envioPausado: boolean;
  aviso: Aviso | null;
  formulario: Formulario;
  registro: Registro;
  consulta: Consulta | null;
  /** Sube con «Intentar otra vez» para repetir la consulta del clima. */
  intento: number;
};

export type Accion =
  | {
      tipo: "restaurar";
      guardado: Guardado | null;
      online: boolean;
      hoy: string;
      /** Se usa si el celular todavía no tiene identificador. */
      dispositivo: string;
    }
  | { tipo: "senal"; online: boolean }
  | { tipo: "elegir-finca"; id: string }
  | { tipo: "cambiar-finca" }
  | { tipo: "ir"; tab: Tab }
  | { tipo: "alternar"; clave: string; valor: boolean }
  | { tipo: "responder"; plaga: PlagaId; valor: Respuesta; ahora: string }
  | { tipo: "borrar-respuesta"; plaga: PlagaId }
  | { tipo: "elegir-hallazgo"; hallazgo: Hallazgo }
  | { tipo: "formulario"; cambios: Partial<Formulario> }
  | { tipo: "guardar"; ahora: string }
  | { tipo: "iniciar-envio" }
  | { tipo: "envio-terminado"; ids: number[] }
  | { tipo: "envio-fallido" }
  | { tipo: "registro"; cambios: Partial<Pick<Registro, "nombre" | "altura">> }
  | { tipo: "registrar" }
  | {
      tipo: "registrada";
      id: string;
      lat: number;
      lon: number;
      ahora: string;
    }
  | { tipo: "ubicacion-fallida" }
  | { tipo: "consulta-iniciada"; fincaId: string }
  | { tipo: "informe"; fincaId: string; informe: Informe }
  | { tipo: "consulta-fallida"; fincaId: string }
  | { tipo: "reintentar" }
  | { tipo: "cerrar-aviso" };

export const ESTADO_INICIAL: Estado = {
  cargado: false,
  online: true,
  fincaId: null,
  nueva: null,
  tab: "riesgo",
  abierto: {},
  respuesta: {},
  cola: [],
  siguienteId: 1,
  informes: {},
  dispositivo: "",
  envioPausado: false,
  consulta: null,
  intento: 0,
  envio: null,
  aviso: null,
  formulario: {
    hallazgo: null,
    porcentaje: 0,
    floracion: null,
    fecha: "",
    notas: "",
  },
  registro: { nombre: "", altura: "", enviando: false },
};

const NOMBRE_HALLAZGO: Record<Exclude<Hallazgo, "nada">, string> = {
  roya: "Roya",
  broca: "Broca",
  ambas: "Roya y broca",
};

function aviso(tipo: AvisoTipo, n = 0): Aviso {
  return { tipo, n };
}

/** Altura escrita por el usuario, o null si está vacía o no tiene sentido. */
function leerAltura(valor: string): number | null {
  const n = Math.round(Number(valor));
  return n > 0 && n < 6000 ? n : null;
}

export function reducir(e: Estado, a: Accion): Estado {
  switch (a.tipo) {
    case "restaurar":
      return {
        ...e,
        ...a.guardado,
        dispositivo: a.guardado?.dispositivo || a.dispositivo,
        cargado: true,
        online: a.online,
        formulario: { ...e.formulario, fecha: a.hoy },
      };

    case "senal":
      if (a.online === e.online) return e;
      if (a.online) {
        return { ...e, online: true, aviso: null, envioPausado: false };
      }
      return {
        ...e,
        online: false,
        envio: null,
        aviso: e.aviso?.tipo === "enviando" ? aviso("guardado-local") : null,
      };

    case "elegir-finca":
      return {
        ...e,
        fincaId: a.id,
        tab: "riesgo",
        abierto: {},
        respuesta: {},
        aviso: null,
        consulta: null,
      };

    case "cambiar-finca":
      return { ...e, fincaId: null, aviso: null, consulta: null };

    case "ir":
      return { ...e, tab: a.tab, aviso: null };

    case "alternar":
      return { ...e, abierto: { ...e.abierto, [a.clave]: a.valor } };

    case "responder": {
      const respuesta = { ...e.respuesta, [a.plaga]: a.valor };
      if (!e.fincaId) return { ...e, respuesta };
      // Siempre a la cola: con señal se envía enseguida, sin señal espera.
      const item: ItemCola = {
        id: e.siguienteId,
        texto: `Respuesta: ${a.valor === "si" ? "sí" : "no"} encontró ${a.plaga}`,
        guardado: a.ahora,
        fincaId: e.fincaId,
        contenido: { tipo: "respuesta", plaga: a.plaga, valor: a.valor },
      };
      return {
        ...e,
        respuesta,
        cola: [...e.cola, item],
        siguienteId: e.siguienteId + 1,
        envioPausado: false,
        envio: e.envio ?? (e.online ? "fondo" : null),
      };
    }

    case "borrar-respuesta": {
      const respuesta = { ...e.respuesta };
      delete respuesta[a.plaga];
      // Si la respuesta seguía en el celular, ya no hay que enviarla.
      const cola = e.cola.filter(
        (q) =>
          !(
            q.contenido.tipo === "respuesta" &&
            q.contenido.plaga === a.plaga &&
            q.fincaId === e.fincaId
          ),
      );
      return { ...e, respuesta, cola };
    }

    case "elegir-hallazgo":
      return {
        ...e,
        aviso: null,
        formulario: {
          ...e.formulario,
          hallazgo: a.hallazgo,
          porcentaje: a.hallazgo === "nada" ? 0 : e.formulario.porcentaje,
        },
      };

    case "formulario":
      return { ...e, formulario: { ...e.formulario, ...a.cambios } };

    case "guardar": {
      const f = e.formulario;
      if (!f.hallazgo || !e.fincaId) return { ...e, aviso: aviso("falta") };
      const item: ItemCola = {
        id: e.siguienteId,
        texto:
          f.hallazgo === "nada"
            ? "Reporte: no encontró plagas"
            : `Reporte: ${NOMBRE_HALLAZGO[f.hallazgo]}, ${f.porcentaje} % del lote`,
        guardado: a.ahora,
        fincaId: e.fincaId,
        contenido: {
          tipo: "reporte",
          hallazgo: f.hallazgo,
          porcentaje: f.porcentaje,
          floracion: f.floracion,
          fecha: f.fecha,
          notas: f.notas,
        },
      };
      return {
        ...e,
        cola: [...e.cola, item],
        siguienteId: e.siguienteId + 1,
        formulario: {
          ...f,
          hallazgo: null,
          porcentaje: 0,
          floracion: null,
          notas: "",
        },
        envioPausado: false,
        envio: e.online && !e.envio ? "guardar" : e.envio,
        aviso: aviso(e.online ? "enviando" : "guardado-local"),
      };
    }

    case "iniciar-envio":
      if (!e.online || e.cola.length === 0 || e.envio || e.envioPausado) {
        return e;
      }
      return { ...e, envio: "auto", aviso: null };

    case "envio-terminado": {
      if (!e.envio) return e;
      // Solo sale de la cola lo que el servidor recibió (o descartó).
      const enviados = new Set(a.ids);
      const cola = e.cola.filter((q) => !enviados.has(q.id));
      const n = e.cola.length - cola.length;
      const avisoFinal =
        e.envio === "guardar"
          ? aviso("enviado")
          : e.envio === "auto" && n > 0
            ? aviso("enviados", n)
            : e.aviso;
      return { ...e, cola, envio: null, aviso: avisoFinal };
    }

    case "envio-fallido":
      if (!e.envio) return e;
      return {
        ...e,
        envio: null,
        envioPausado: true,
        aviso: e.envio === "guardar" ? aviso("fallo-envio") : e.aviso,
      };

    case "registro":
      return { ...e, registro: { ...e.registro, ...a.cambios } };

    case "registrar":
      if (e.registro.enviando) return e;
      return { ...e, registro: { ...e.registro, enviando: true } };

    case "registrada": {
      // La finca nueva reemplaza a la anterior: su cálculo ya no sirve.
      const informes = { ...e.informes };
      if (e.nueva) delete informes[e.nueva.id];
      const nueva: FincaNueva = {
        id: a.id,
        nombre: e.registro.nombre.trim() || "Mi finca",
        altura: leerAltura(e.registro.altura),
        lat: a.lat,
        lon: a.lon,
      };
      // El registro viaja al servidor por la misma cola, antes que sus reportes.
      const item: ItemCola = {
        id: e.siguienteId,
        texto: `Registro de la finca ${nueva.nombre}`,
        guardado: a.ahora,
        fincaId: nueva.id,
        contenido: {
          tipo: "finca",
          nombre: nueva.nombre,
          altura: nueva.altura,
          lat: nueva.lat,
          lon: nueva.lon,
        },
      };
      return {
        ...e,
        registro: { nombre: "", altura: "", enviando: false },
        fincaId: nueva.id,
        nueva,
        cola: [...e.cola, item],
        siguienteId: e.siguienteId + 1,
        envioPausado: false,
        envio: e.envio ?? (e.online ? "fondo" : null),
        informes,
        consulta: null,
        tab: "riesgo",
        abierto: {},
        respuesta: {},
        aviso: aviso("registrada"),
      };
    }

    case "ubicacion-fallida":
      return {
        ...e,
        registro: { ...e.registro, enviando: false },
        aviso: aviso("sin-ubicacion"),
      };

    case "consulta-iniciada":
      return { ...e, consulta: { fincaId: a.fincaId, estado: "cargando" } };

    case "informe":
      return {
        ...e,
        informes: { ...e.informes, [a.fincaId]: a.informe },
        consulta: e.consulta?.fincaId === a.fincaId ? null : e.consulta,
      };

    case "consulta-fallida":
      if (e.consulta?.fincaId !== a.fincaId) return e;
      return { ...e, consulta: { fincaId: a.fincaId, estado: "error" } };

    case "reintentar":
      return { ...e, consulta: null, intento: e.intento + 1 };

    case "cerrar-aviso":
      return { ...e, aviso: null };
  }
}

const CLAVE = "micafetal:v1";

export function leerGuardado(): Guardado | null {
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (!crudo) return null;
    const g = JSON.parse(crudo) as Partial<Guardado> | null;
    if (!g || typeof g !== "object") return null;
    const nueva = esFincaNueva(g.nueva) ? g.nueva : null;
    const fincaValida =
      typeof g.fincaId === "string" &&
      (g.fincaId === nueva?.id || !!buscarFinca(g.fincaId));
    return {
      fincaId: fincaValida ? (g.fincaId ?? null) : null,
      nueva,
      respuesta: fincaValida && g.respuesta ? g.respuesta : {},
      cola: Array.isArray(g.cola) ? g.cola : [],
      siguienteId: Number(g.siguienteId) || 1,
      informes: leerInformes(g.informes),
      dispositivo: typeof g.dispositivo === "string" ? g.dispositivo : "",
    };
  } catch {
    return null;
  }
}

function esFincaNueva(x: unknown): x is FincaNueva {
  const f = x as FincaNueva | null;
  return (
    !!f &&
    typeof f.id === "string" &&
    typeof f.nombre === "string" &&
    Number.isFinite(f.lat) &&
    Number.isFinite(f.lon) &&
    (f.altura === null || Number.isFinite(f.altura))
  );
}

function leerInformes(x: unknown): Record<string, Informe> {
  if (!x || typeof x !== "object") return {};
  const informes: Record<string, Informe> = {};
  for (const [id, i] of Object.entries(x as Record<string, Informe>)) {
    if (
      typeof i?.calculado === "string" &&
      i.roya?.factores &&
      i.broca?.factores &&
      Array.isArray(i.semana?.dias)
    ) {
      informes[id] = i;
    }
  }
  return informes;
}

export function escribirGuardado(g: Guardado): void {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(g));
  } catch {
    // Sin almacenamiento (modo privado, cuota llena): la app sigue funcionando.
  }
}

/** Fecha local de hoy como la espera un <input type="date">. */
export function hoyLocal(): string {
  const d = new Date();
  const dos = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

/** "hoy 10:20", o "el 15 nov 10:20" si se guardó otro día. */
export function cuandoSeGuardo(iso: string): string {
  const d = new Date(iso);
  const hora = new Intl.DateTimeFormat("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  if (d.toDateString() === new Date().toDateString()) return `hoy ${hora}`;
  const dia = new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "short",
  }).format(d);
  return `el ${dia} ${hora}`;
}
