// Persistencia en SQLite (módulo `node:sqlite` de Node 24, sin dependencias).
// Capa 3 del diagrama: fincas, histórico de cálculos, reportes, alertas,
// confirmaciones y envíos simulados.

import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { FINCAS, type Informe, type Nivel, type PlagaId } from "./datos";
import { distanciaKm } from "./geo";

// En Vercel el disco es de solo lectura salvo /tmp (efímero: se pierde al
// reiniciar la función y no se comparte entre instancias).
const RUTA =
  process.env.MICAFETAL_DB ??
  (process.env.VERCEL
    ? path.join(tmpdir(), "micafetal.db")
    : path.join(process.cwd(), "data", "micafetal.db"));

/** Radio y ventana de «plaga en la zona». */
export const ZONA = { km: 10, dias: 14 };

const ESQUEMA = `
CREATE TABLE IF NOT EXISTS fincas (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  municipio TEXT,
  altura INTEGER,
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  creada TEXT NOT NULL,
  ultima_conexion TEXT
);
CREATE TABLE IF NOT EXISTS calculos (
  id INTEGER PRIMARY KEY,
  finca_id TEXT NOT NULL REFERENCES fincas(id),
  fecha TEXT NOT NULL,
  temperatura REAL NOT NULL,
  horas_humedas INTEGER NOT NULL,
  dias_lluvia INTEGER NOT NULL,
  lluvia_total REAL NOT NULL,
  irf INTEGER NOT NULL,
  nivel_roya TEXT NOT NULL,
  broca_puntos INTEGER NOT NULL,
  nivel_broca TEXT NOT NULL,
  UNIQUE (finca_id, fecha)
);
CREATE TABLE IF NOT EXISTS reportes (
  id INTEGER PRIMARY KEY,
  dispositivo TEXT NOT NULL,
  item_id INTEGER NOT NULL,
  finca_id TEXT NOT NULL REFERENCES fincas(id),
  hallazgo TEXT NOT NULL,
  porcentaje INTEGER NOT NULL,
  floracion TEXT,
  fecha TEXT,
  notas TEXT,
  guardado TEXT NOT NULL,
  recibido TEXT NOT NULL,
  UNIQUE (dispositivo, item_id)
);
CREATE TABLE IF NOT EXISTS alertas (
  id INTEGER PRIMARY KEY,
  finca_id TEXT NOT NULL REFERENCES fincas(id),
  plaga TEXT NOT NULL,
  nivel TEXT NOT NULL,
  valor INTEGER NOT NULL,
  mensaje TEXT NOT NULL,
  creada TEXT NOT NULL,
  -- null: sin respuesta; 1: el caficultor encontró la plaga; 0: no la encontró.
  confirmada INTEGER
);
CREATE TABLE IF NOT EXISTS confirmaciones (
  id INTEGER PRIMARY KEY,
  dispositivo TEXT NOT NULL,
  item_id INTEGER NOT NULL,
  finca_id TEXT NOT NULL REFERENCES fincas(id),
  plaga TEXT NOT NULL,
  valor TEXT NOT NULL,
  alerta_id INTEGER REFERENCES alertas(id),
  guardado TEXT NOT NULL,
  recibido TEXT NOT NULL,
  UNIQUE (dispositivo, item_id)
);
CREATE TABLE IF NOT EXISTS envios (
  id INTEGER PRIMARY KEY,
  alerta_id INTEGER NOT NULL REFERENCES alertas(id),
  canal TEXT NOT NULL,
  caracteres INTEGER NOT NULL,
  costo_cop INTEGER NOT NULL,
  t_resp_s REAL NOT NULL,
  estado TEXT NOT NULL,
  creado TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS calculos_finca ON calculos (finca_id, fecha);
CREATE INDEX IF NOT EXISTS alertas_finca ON alertas (finca_id, plaga, creada);
`;

// En desarrollo el módulo se recarga; se guarda la conexión para no abrir otra.
const g = globalThis as typeof globalThis & { __micafetalDb?: DatabaseSync };

function base(): DatabaseSync {
  if (g.__micafetalDb) return g.__micafetalDb;
  mkdirSync(path.dirname(RUTA), { recursive: true });
  const db = new DatabaseSync(RUTA);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  db.exec(ESQUEMA);
  const sembrar = db.prepare(
    `INSERT OR IGNORE INTO fincas (id, nombre, municipio, altura, lat, lon, creada)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const ahora = new Date().toISOString();
  for (const f of FINCAS) {
    sembrar.run(f.id, f.nombre, f.municipio, f.altura, f.lat, f.lon, ahora);
  }
  g.__micafetalDb = db;
  return db;
}

function enTransaccion<T>(fn: (db: DatabaseSync) => T): T {
  const db = base();
  db.exec("BEGIN");
  try {
    const r = fn(db);
    db.exec("COMMIT");
    return r;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

function hace(dias: number): string {
  return new Date(Date.now() - dias * 86_400_000).toISOString();
}

// ── Fincas ──────────────────────────────────────────────────────────────

export type FilaFinca = {
  id: string;
  nombre: string;
  municipio: string | null;
  altura: number | null;
  lat: number;
  lon: number;
  ultima_conexion: string | null;
};

export function obtenerFinca(id: string): FilaFinca | undefined {
  return base()
    .prepare(
      "SELECT id, nombre, municipio, altura, lat, lon, ultima_conexion FROM fincas WHERE id = ?",
    )
    .get(id) as FilaFinca | undefined;
}

export function listarFincas(): FilaFinca[] {
  return base()
    .prepare(
      "SELECT id, nombre, municipio, altura, lat, lon, ultima_conexion FROM fincas ORDER BY creada, id",
    )
    .all() as FilaFinca[];
}

/** La finca se acaba de conectar desde la app (perfil de conectividad). */
export function marcarConexion(id: string): void {
  base()
    .prepare("UPDATE fincas SET ultima_conexion = ? WHERE id = ?")
    .run(new Date().toISOString(), id);
}

/** Guarda la altura calculada de una finca registrada sin altura. */
export function fijarAltura(id: string, altura: number): void {
  base()
    .prepare("UPDATE fincas SET altura = ? WHERE id = ? AND altura IS NULL")
    .run(altura, id);
}

// ── Cálculos ────────────────────────────────────────────────────────────

/** Histórico de lecturas; el mismo clima (misma fecha) no se repite. */
export function guardarCalculo(fincaId: string, i: Informe): void {
  base()
    .prepare(
      `INSERT OR IGNORE INTO calculos (finca_id, fecha, temperatura, horas_humedas,
         dias_lluvia, lluvia_total, irf, nivel_roya, broca_puntos, nivel_broca)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      fincaId,
      i.calculado,
      i.indicadores.temperatura,
      i.indicadores.horasHumedas,
      i.indicadores.diasConLluvia,
      i.indicadores.lluviaTotal,
      i.roya.valor,
      i.roya.nivel,
      i.broca.valor,
      i.broca.nivel,
    );
}

/**
 * Reportes de la plaga (o confirmaciones «sí») de OTRAS fincas a menos de
 * 10 km en los últimos 14 días.
 */
export function plagaEnZona(
  finca: { id: string; lat: number; lon: number },
  plaga: PlagaId,
): number {
  const hallazgos = plaga === "broca" ? ["broca", "ambas"] : ["roya", "ambas"];
  const filas = base()
    .prepare(
      `SELECT f.lat, f.lon FROM reportes r JOIN fincas f ON f.id = r.finca_id
         WHERE r.finca_id <> ? AND r.hallazgo IN (?, ?) AND r.recibido >= ?
       UNION ALL
       SELECT f.lat, f.lon FROM confirmaciones c JOIN fincas f ON f.id = c.finca_id
         WHERE c.finca_id <> ? AND c.plaga = ? AND c.valor = 'si' AND c.recibido >= ?`,
    )
    .all(
      finca.id,
      hallazgos[0],
      hallazgos[1],
      hace(ZONA.dias),
      finca.id,
      plaga,
      hace(ZONA.dias),
    ) as { lat: number; lon: number }[];
  return filas.filter((p) => distanciaKm(finca, p) <= ZONA.km).length;
}

// ── Alertas y envíos ────────────────────────────────────────────────────

export function alertaReciente(
  fincaId: string,
  plaga: PlagaId,
  dias: number,
): { id: number; nivel: Nivel } | undefined {
  return base()
    .prepare(
      `SELECT id, nivel FROM alertas WHERE finca_id = ? AND plaga = ? AND creada >= ?
       ORDER BY creada DESC LIMIT 1`,
    )
    .get(fincaId, plaga, hace(dias)) as
    | { id: number; nivel: Nivel }
    | undefined;
}

export type EnvioNuevo = {
  canal: "whatsapp" | "sms";
  caracteres: number;
  costoCop: number;
  tRespS: number;
  estado: string;
};

export function crearAlerta(
  a: {
    fincaId: string;
    plaga: PlagaId;
    nivel: Nivel;
    valor: number;
    mensaje: string;
  },
  envios: EnvioNuevo[],
): number {
  return enTransaccion((db) => {
    const ahora = new Date().toISOString();
    const r = db
      .prepare(
        `INSERT INTO alertas (finca_id, plaga, nivel, valor, mensaje, creada)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(a.fincaId, a.plaga, a.nivel, a.valor, a.mensaje, ahora);
    const id = Number(r.lastInsertRowid);
    const envio = db.prepare(
      `INSERT INTO envios (alerta_id, canal, caracteres, costo_cop, t_resp_s, estado, creado)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const e of envios) {
      envio.run(
        id,
        e.canal,
        e.caracteres,
        e.costoCop,
        e.tRespS,
        e.estado,
        ahora,
      );
    }
    return id;
  });
}

// ── Sincronización desde la app ─────────────────────────────────────────

export type ItemServidor =
  | {
      id: number;
      guardado: string;
      fincaId: string;
      tipo: "finca";
      nombre: string;
      altura: number | null;
      lat: number;
      lon: number;
    }
  | {
      id: number;
      guardado: string;
      fincaId: string;
      tipo: "reporte";
      hallazgo: string;
      porcentaje: number;
      floracion: string | null;
      fecha: string;
      notas: string;
    }
  | {
      id: number;
      guardado: string;
      fincaId: string;
      tipo: "respuesta";
      plaga: PlagaId;
      valor: "si" | "no";
    };

/**
 * Guarda lo que llegó del celular, en orden. Reenviar el mismo ítem no lo
 * duplica (UNIQUE dispositivo + item_id). Devuelve los ids procesados y los
 * descartados (p. ej. de una finca que el servidor no conoce).
 */
export function guardarItems(
  dispositivo: string,
  items: ItemServidor[],
): { recibidos: number[]; descartados: number[] } {
  return enTransaccion((db) => {
    const ahora = new Date().toISOString();
    const recibidos: number[] = [];
    const descartados: number[] = [];
    const existe = db.prepare("SELECT 1 FROM fincas WHERE id = ?");
    const finca = db.prepare(
      `INSERT INTO fincas (id, nombre, altura, lat, lon, creada, ultima_conexion)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET nombre = excluded.nombre,
         altura = COALESCE(excluded.altura, fincas.altura),
         lat = excluded.lat, lon = excluded.lon`,
    );
    const reporte = db.prepare(
      `INSERT OR IGNORE INTO reportes (dispositivo, item_id, finca_id, hallazgo,
         porcentaje, floracion, fecha, notas, guardado, recibido)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const respuesta = db.prepare(
      `INSERT OR IGNORE INTO confirmaciones (dispositivo, item_id, finca_id, plaga,
         valor, alerta_id, guardado, recibido)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const ultimaAlerta = db.prepare(
      `SELECT id FROM alertas WHERE finca_id = ? AND plaga = ? AND creada >= ?
       ORDER BY creada DESC LIMIT 1`,
    );
    const confirmar = db.prepare(
      "UPDATE alertas SET confirmada = ? WHERE id = ?",
    );

    for (const it of items) {
      if (it.tipo === "finca") {
        finca.run(
          it.fincaId,
          it.nombre,
          it.altura,
          it.lat,
          it.lon,
          ahora,
          ahora,
        );
        recibidos.push(it.id);
        continue;
      }
      if (!existe.get(it.fincaId)) {
        descartados.push(it.id);
        continue;
      }
      if (it.tipo === "reporte") {
        reporte.run(
          dispositivo,
          it.id,
          it.fincaId,
          it.hallazgo,
          it.porcentaje,
          it.floracion,
          it.fecha,
          it.notas,
          it.guardado,
          ahora,
        );
      } else {
        // Retroalimentación: la respuesta confirma (o no) la última alerta.
        const alerta = ultimaAlerta.get(
          it.fincaId,
          it.plaga,
          hace(ZONA.dias),
        ) as { id: number } | undefined;
        const r = respuesta.run(
          dispositivo,
          it.id,
          it.fincaId,
          it.plaga,
          it.valor,
          alerta?.id ?? null,
          it.guardado,
          ahora,
        );
        if (alerta && r.changes > 0) {
          confirmar.run(it.valor === "si" ? 1 : 0, alerta.id);
        }
      }
      recibidos.push(it.id);
    }
    return { recibidos, descartados };
  });
}

// ── Consultas del dashboard ─────────────────────────────────────────────

export type FilaPanelFinca = FilaFinca & {
  fecha: string | null;
  irf: number | null;
  nivel_roya: Nivel | null;
  broca_puntos: number | null;
  nivel_broca: Nivel | null;
};

export function panelFincas(): FilaPanelFinca[] {
  return base()
    .prepare(
      `SELECT f.id, f.nombre, f.municipio, f.altura, f.lat, f.lon, f.ultima_conexion,
              c.fecha, c.irf, c.nivel_roya, c.broca_puntos, c.nivel_broca
         FROM fincas f
         LEFT JOIN calculos c ON c.id = (
           SELECT id FROM calculos WHERE finca_id = f.id ORDER BY fecha DESC LIMIT 1)
        ORDER BY f.creada, f.id`,
    )
    .all() as FilaPanelFinca[];
}

/** IRF de los últimos cálculos de cada finca, del más viejo al más nuevo. */
export function historialIrf(porFinca = 12): Record<string, number[]> {
  const filas = base()
    .prepare(
      `SELECT finca_id, irf FROM (
         SELECT finca_id, irf, fecha,
                ROW_NUMBER() OVER (PARTITION BY finca_id ORDER BY fecha DESC) AS n
           FROM calculos)
        WHERE n <= ? ORDER BY fecha`,
    )
    .all(porFinca) as { finca_id: string; irf: number }[];
  const r: Record<string, number[]> = {};
  for (const f of filas) {
    r[f.finca_id] = [...(r[f.finca_id] ?? []), f.irf];
  }
  return r;
}

export type FilaAlerta = {
  id: number;
  finca: string;
  plaga: PlagaId;
  nivel: Nivel;
  valor: number;
  mensaje: string;
  creada: string;
  confirmada: number | null;
  canales: string | null;
  costo: number | null;
};

export function alertasRecientes(limite = 30): FilaAlerta[] {
  return base()
    .prepare(
      `SELECT a.id, f.nombre AS finca, a.plaga, a.nivel, a.valor, a.mensaje, a.creada,
              a.confirmada,
              (SELECT GROUP_CONCAT(canal || ': ' || estado, ' → ')
                 FROM (SELECT canal, estado FROM envios
                        WHERE alerta_id = a.id ORDER BY id)) AS canales,
              (SELECT SUM(costo_cop) FROM envios WHERE alerta_id = a.id) AS costo
         FROM alertas a JOIN fincas f ON f.id = a.finca_id
        ORDER BY a.creada DESC LIMIT ?`,
    )
    .all(limite) as FilaAlerta[];
}

export type FilaReporte = {
  id: number;
  finca: string;
  hallazgo: string;
  porcentaje: number;
  floracion: string | null;
  fecha: string | null;
  notas: string | null;
  recibido: string;
};

export function reportesRecientes(limite = 20): FilaReporte[] {
  return base()
    .prepare(
      `SELECT r.id, f.nombre AS finca, r.hallazgo, r.porcentaje, r.floracion, r.fecha,
              r.notas, r.recibido
         FROM reportes r JOIN fincas f ON f.id = r.finca_id
        ORDER BY r.recibido DESC LIMIT ?`,
    )
    .all(limite) as FilaReporte[];
}

/** A = alertas confirmadas / alertas enviadas × 100, en los últimos `dias`. */
export function indicadorAciertos(dias = 30): {
  enviadas: number;
  respondidas: number;
  confirmadas: number;
  a: number | null;
} {
  const r = base()
    .prepare(
      `SELECT COUNT(*) AS enviadas,
              COUNT(confirmada) AS respondidas,
              COALESCE(SUM(confirmada = 1), 0) AS confirmadas
         FROM alertas WHERE creada >= ?`,
    )
    .get(hace(dias)) as Record<string, SQLInputValue>;
  const enviadas = Number(r.enviadas);
  const confirmadas = Number(r.confirmadas);
  return {
    enviadas,
    respondidas: Number(r.respondidas),
    confirmadas,
    a: enviadas ? Math.round((confirmadas / enviadas) * 100) : null,
  };
}
