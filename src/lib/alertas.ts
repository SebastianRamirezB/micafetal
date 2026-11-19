// Gestor de alertas y pasarela de mensajería (SIMULADA): decide si una finca
// debe recibir alerta, elige el canal según su conectividad y registra el
// envío en la base. No se envía ningún WhatsApp ni SMS de verdad.

import { type Informe, PLAGAS } from "./datos";
import {
  alertaReciente,
  crearAlerta,
  type EnvioNuevo,
  type FilaFinca,
} from "./db";
import { MAX_CARACTERES, mensajeAlerta } from "./mensajes";

/** No se repite la misma alerta (finca + plaga) en este plazo. */
const DIAS_SIN_REPETIR = 7;
/** Si la app de la finca se conectó hace menos de esto, tiene datos móviles. */
const HORAS_CON_DATOS = 24;
/** Costo estimado de un SMS de un segmento. */
const COSTO_SMS_COP = 50;
/** T_resp = 2 s (API) + 1 s (motor) + 5 s (pasarela), según el diagrama. */
const T_RESP_S = 8;

export type Perfil = "con-datos" | "sin-datos";

export function perfilConectividad(f: FilaFinca, ahora = Date.now()): Perfil {
  if (!f.ultima_conexion) return "sin-datos";
  const horas = (ahora - Date.parse(f.ultima_conexion)) / 3_600_000;
  return horas < HORAS_CON_DATOS ? "con-datos" : "sin-datos";
}

/** WhatsApp si hay datos móviles; si no, cae automáticamente a SMS. */
export function rutear(perfil: Perfil, mensaje: string): EnvioNuevo[] {
  const caracteres = mensaje.length;
  if (perfil === "con-datos") {
    return [
      {
        canal: "whatsapp",
        caracteres,
        costoCop: 0,
        tRespS: T_RESP_S,
        estado: "entregado (simulado)",
      },
    ];
  }
  return [
    {
      canal: "whatsapp",
      caracteres,
      costoCop: 0,
      tRespS: 0,
      estado: "sin internet",
    },
    {
      canal: "sms",
      caracteres,
      costoCop: COSTO_SMS_COP * Math.ceil(caracteres / MAX_CARACTERES),
      tRespS: T_RESP_S,
      estado: "entregado (simulado)",
    },
  ];
}

/** Crea y «envía» las alertas de riesgo ALTO que correspondan. */
export function gestionarAlertas(finca: FilaFinca, informe: Informe): number {
  let creadas = 0;
  for (const { id: plaga } of PLAGAS) {
    const r = informe[plaga];
    if (r.nivel !== "alto") continue;
    if (alertaReciente(finca.id, plaga, DIAS_SIN_REPETIR)) continue;
    const mensaje = mensajeAlerta(plaga, r);
    crearAlerta(
      {
        fincaId: finca.id,
        plaga,
        nivel: r.nivel,
        valor: r.valor,
        mensaje,
      },
      rutear(perfilConectividad(finca), mensaje),
    );
    creadas++;
  }
  return creadas;
}
