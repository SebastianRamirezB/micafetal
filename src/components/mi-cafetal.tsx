"use client";

import { type Dispatch, useEffect, useReducer } from "react";
import {
  buscarFinca,
  FINCAS,
  type FincaActiva,
  type Informe,
} from "@/lib/datos";
import {
  type Accion,
  type Aviso,
  type AvisoTipo,
  ESTADO_INICIAL,
  type Estado,
  escribirGuardado,
  hoyLocal,
  leerGuardado,
  reducir,
  type Tab,
} from "@/lib/estado";
import { miles } from "@/lib/formato";
import { Bienvenida } from "./bienvenida";
import { Clima } from "./clima";
import {
  IconoAlerta,
  IconoCelularCheck,
  IconoCelularReloj,
  IconoCerrar,
  IconoCheck,
  IconoGirando,
  IconoLapiz,
  IconoPin,
  IconoSemaforo,
  IconoSenal,
  IconoSolNube,
  Logo,
} from "./iconos";
import { Reportar } from "./reportar";
import { Riesgo } from "./riesgo";

const ESPERA_AL_VOLVER_LA_SENAL = 700;
const DURACION_AVISO: Partial<Record<AvisoTipo, number>> = {
  enviado: 5000,
  enviados: 5000,
  registrada: 6000,
};
/** Un cálculo más nuevo que esto no se vuelve a pedir. */
const VIGENCIA_INFORME = 15 * 60_000;

function fincaActiva(e: Estado): FincaActiva | null {
  if (!e.fincaId) return null;
  const informe = e.informes[e.fincaId] ?? null;
  if (e.nueva && e.fincaId === e.nueva.id) return { ...e.nueva, informe };
  const f = buscarFinca(e.fincaId);
  return f
    ? {
        id: f.id,
        nombre: f.nombre,
        altura: f.altura,
        lat: f.lat,
        lon: f.lon,
        informe,
      }
    : null;
}

export function MiCafetal() {
  const [e, despachar] = useReducer(reducir, ESTADO_INICIAL);
  const hayCola = e.cola.length > 0;
  const enviando = e.envio !== null;

  // Al abrir: recupera lo guardado en el celular y sigue la señal real.
  useEffect(() => {
    despachar({
      tipo: "restaurar",
      guardado: leerGuardado(),
      online: navigator.onLine,
      hoy: hoyLocal(),
      dispositivo: crypto.randomUUID(),
    });
    const conSenal = () => despachar({ tipo: "senal", online: true });
    const sinSenal = () => despachar({ tipo: "senal", online: false });
    window.addEventListener("online", conSenal);
    window.addEventListener("offline", sinSenal);
    return () => {
      window.removeEventListener("online", conSenal);
      window.removeEventListener("offline", sinSenal);
    };
  }, []);

  useEffect(() => {
    if (!e.cargado) return;
    escribirGuardado({
      fincaId: e.fincaId,
      nueva: e.nueva,
      respuesta: e.respuesta,
      cola: e.cola,
      siguienteId: e.siguienteId,
      informes: e.informes,
      dispositivo: e.dispositivo,
    });
  }, [
    e.cargado,
    e.fincaId,
    e.nueva,
    e.respuesta,
    e.cola,
    e.siguienteId,
    e.informes,
    e.dispositivo,
  ]);

  // Con señal y cosas guardadas: se envían solas.
  useEffect(() => {
    if (!e.cargado || !e.online || !hayCola || e.envio || e.envioPausado) {
      return;
    }
    const t = setTimeout(
      () => despachar({ tipo: "iniciar-envio" }),
      ESPERA_AL_VOLVER_LA_SENAL,
    );
    return () => clearTimeout(t);
  }, [e.cargado, e.online, hayCola, e.envio, e.envioPausado]);

  // Envío real al servidor de lo que está en la cola en este momento.
  // biome-ignore lint/correctness/useExhaustiveDependencies: se envía la cola tal como está al empezar; lo que llegue después va en el siguiente envío.
  useEffect(() => {
    if (!e.envio) return;
    const control = new AbortController();
    fetch("/api/sincronizar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dispositivo: e.dispositivo, items: e.cola }),
      signal: control.signal,
    })
      .then((r) =>
        r.ok
          ? (r.json() as Promise<{
              recibidos: number[];
              descartados: number[];
            }>)
          : Promise.reject(),
      )
      .then(({ recibidos, descartados }) =>
        despachar({
          tipo: "envio-terminado",
          ids: [...recibidos, ...descartados],
        }),
      )
      .catch(() => {
        if (!control.signal.aborted) despachar({ tipo: "envio-fallido" });
      });
    return () => control.abort();
  }, [e.envio]);

  // Registro: la ubicación real del celular.
  useEffect(() => {
    if (!e.registro.enviando) return;
    if (!("geolocation" in navigator)) {
      despachar({ tipo: "ubicacion-fallida" });
      return;
    }
    let vigente = true;
    navigator.geolocation.getCurrentPosition(
      (p) =>
        vigente &&
        despachar({
          tipo: "registrada",
          id: `n-${crypto.randomUUID()}`,
          lat: p.coords.latitude,
          lon: p.coords.longitude,
          ahora: new Date().toISOString(),
        }),
      () => vigente && despachar({ tipo: "ubicacion-fallida" }),
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 60_000 },
    );
    return () => {
      vigente = false;
    };
  }, [e.registro.enviando]);

  const finca = fincaActiva(e);
  const calculado = finca?.informe?.calculado ?? null;

  // Con señal: trae el clima y el riesgo si no hay un cálculo reciente.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `finca` es un objeto nuevo en cada render; bastan su id, ubicación y altura. `intento` repite la consulta.
  useEffect(() => {
    if (!e.cargado || !e.online || !finca) return;
    if (calculado && Date.now() - Date.parse(calculado) < VIGENCIA_INFORME) {
      return;
    }
    const fincaId = finca.id;
    const params = new URLSearchParams({
      lat: String(finca.lat),
      lon: String(finca.lon),
      finca: fincaId,
    });
    if (finca.altura !== null) params.set("alt", String(finca.altura));
    const control = new AbortController();
    despachar({ tipo: "consulta-iniciada", fincaId });
    fetch(`/api/riesgo?${params}`, { signal: control.signal })
      .then((r) => (r.ok ? (r.json() as Promise<Informe>) : Promise.reject()))
      .then((informe) => despachar({ tipo: "informe", fincaId, informe }))
      .catch(() => {
        if (!control.signal.aborted) {
          despachar({ tipo: "consulta-fallida", fincaId });
        }
      });
    return () => control.abort();
  }, [
    e.cargado,
    e.online,
    finca?.id,
    finca?.lat,
    finca?.lon,
    finca?.altura,
    calculado,
    e.intento,
  ]);

  useEffect(() => {
    const ms = e.aviso && DURACION_AVISO[e.aviso.tipo];
    if (!ms) return;
    const t = setTimeout(() => despachar({ tipo: "cerrar-aviso" }), ms);
    return () => clearTimeout(t);
  }, [e.aviso]);

  const fincas = FINCAS.map((f) => ({
    id: f.id,
    nombre: f.nombre,
    detalle: `${f.municipio} · ${miles(f.altura)} m`,
  }));
  if (e.nueva) {
    const altura = e.nueva.altura ?? e.informes[e.nueva.id]?.altura;
    fincas.push({
      id: e.nueva.id,
      nombre: e.nueva.nombre,
      detalle: altura ? `${miles(altura)} m` : "Registrada en este celular",
    });
  }
  const consulta =
    e.consulta && e.consulta.fincaId === finca?.id ? e.consulta.estado : null;

  return (
    <div className="relative mx-auto flex h-dvh w-full max-w-[480px] flex-col overflow-hidden bg-fondo text-[17px] leading-[1.35] text-tinta sm:shadow-xl">
      <Encabezado
        online={e.online}
        finca={finca?.nombre ?? null}
        despachar={despachar}
      />

      {finca && hayCola && <FranjaCola n={e.cola.length} enviando={enviando} />}

      <main className="relative min-h-0 flex-1">
        {e.cargado && !finca && (
          <Bienvenida
            fincas={fincas}
            registro={e.registro}
            despachar={despachar}
          />
        )}
        {finca && e.tab === "riesgo" && (
          <Riesgo
            finca={finca}
            online={e.online}
            abierto={e.abierto}
            respuesta={e.respuesta}
            cola={e.cola}
            consulta={consulta}
            despachar={despachar}
          />
        )}
        {finca && e.tab === "clima" && (
          <Clima
            finca={finca}
            online={e.online}
            consulta={consulta}
            despachar={despachar}
          />
        )}
        {finca && e.tab === "reportar" && (
          <Reportar
            formulario={e.formulario}
            cola={e.cola}
            enviando={enviando}
            despachar={despachar}
          />
        )}
        {e.aviso && (
          <CajaAviso
            aviso={e.aviso}
            altura={e.nueva?.altura ?? null}
            // Sobre el botón «Guardar reporte» cuando está a la vista.
            abajo={!finca ? 16 : e.tab === "reportar" ? 92 : 14}
            onCerrar={() => despachar({ tipo: "cerrar-aviso" })}
          />
        )}
      </main>

      {finca && (
        <BarraSecciones
          tab={e.tab}
          pendientes={e.cola.length}
          despachar={despachar}
        />
      )}
    </div>
  );
}

function Encabezado({
  online,
  finca,
  despachar,
}: {
  online: boolean;
  finca: string | null;
  despachar: Dispatch<Accion>;
}) {
  const senal = online ? "Con señal" : "Sin señal";
  return (
    <header className="flex-none bg-verde px-3.5 pt-[max(12px,env(safe-area-inset-top))] pb-2.5 text-white">
      <div className="flex items-center gap-2.5">
        <Logo className="flex-none" />
        <p className="min-w-0 flex-1 text-[22px] leading-[1.15] font-extrabold">
          Mi Cafetal
        </p>
        <button
          type="button"
          onClick={() => despachar({ tipo: "senal", online: !online })}
          aria-label={`${senal}. Toque para simular el cambio de señal (demostración).`}
          className={`inline-flex min-h-11 flex-none cursor-pointer items-center gap-1.5 rounded-full border-2 px-3 text-[17px] font-extrabold ${
            online
              ? "border-white bg-white text-verde"
              : "border-naranja-claro bg-naranja text-white"
          }`}
        >
          <IconoSenal cortada={!online} />
          {senal}
        </button>
      </div>
      {finca !== null && (
        <div className="mt-1 flex items-center gap-1.5 pl-0.5">
          <IconoPin size={18} className="flex-none" />
          <span className="min-w-0 truncate text-[17px] font-semibold">
            {finca}
          </span>
          <button
            type="button"
            onClick={() => despachar({ tipo: "cambiar-finca" })}
            className="min-h-10 flex-none cursor-pointer px-1.5 text-[17px] underline"
          >
            cambiar
          </button>
        </div>
      )}
    </header>
  );
}

function FranjaCola({ n, enviando }: { n: number; enviando: boolean }) {
  const cosas = n === 1 ? "1 cosa guardada" : `${n} cosas guardadas`;
  return (
    <output
      className={`flex flex-none items-center gap-2.5 border-b px-4 py-2.5 text-[17px] font-bold ${
        enviando
          ? "border-verde-borde bg-verde-tinte text-verde-oscuro"
          : "border-naranja-borde bg-naranja-tinte text-naranja-oscuro"
      }`}
    >
      {enviando ? (
        <IconoGirando grosor={2.4} className="flex-none" />
      ) : (
        <IconoCelularReloj className="flex-none" />
      )}
      <span>
        {enviando
          ? `Enviando ${cosas}…`
          : `${cosas} en el celular, esperando señal`}
      </span>
    </output>
  );
}

function textoAviso(
  aviso: Aviso,
  altura: number | null,
): { titulo: string; detalle: string } {
  switch (aviso.tipo) {
    case "guardado-local":
      return {
        titulo: "Guardado en el celular.",
        detalle: "Se enviará cuando haya señal.",
      };
    case "enviando":
      return {
        titulo: "Guardado. Enviando…",
        detalle: "Un momento, por favor.",
      };
    case "enviado":
      return {
        titulo: "Enviado. ¡Gracias!",
        detalle: "Su reporte llegó bien.",
      };
    case "enviados":
      return {
        titulo: "Todo enviado.",
        detalle:
          aviso.n === 1
            ? "Se envió 1 cosa guardada."
            : `Se enviaron ${aviso.n} cosas guardadas.`,
      };
    case "fallo-envio":
      return {
        titulo: "No se pudo enviar.",
        detalle: "Quedó guardado en el celular; se enviará más tarde.",
      };
    case "falta":
      return {
        titulo: "Falta un dato.",
        detalle: "Toque lo que encontró: Nada, Roya, Broca o Las dos.",
      };
    case "registrada":
      return {
        titulo:
          altura === null
            ? "Finca registrada."
            : `Finca registrada a ${miles(altura)} m.`,
        detalle: "Calculando su riesgo…",
      };
    case "sin-ubicacion":
      return {
        titulo: "No pudimos saber dónde está.",
        detalle:
          "Permita que la app use la ubicación del celular e intente otra vez.",
      };
  }
}

function CajaAviso({
  aviso,
  altura,
  abajo,
  onCerrar,
}: {
  aviso: Aviso;
  altura: number | null;
  abajo: number;
  onCerrar: () => void;
}) {
  const { titulo, detalle } = textoAviso(aviso, altura);
  // Naranja: algo quedó pendiente. Verde: va bien.
  const pendiente =
    aviso.tipo === "guardado-local" ||
    aviso.tipo === "falta" ||
    aviso.tipo === "sin-ubicacion" ||
    aviso.tipo === "fallo-envio";

  return (
    <div
      style={{ bottom: abajo }}
      className={`absolute inset-x-3 z-10 flex items-start gap-3 rounded-2xl border-2 bg-white py-3.5 pr-1.5 pl-3.5 shadow-[0_8px_24px_rgba(31,31,31,0.18)] ${
        pendiente ? "border-naranja" : "border-verde"
      }`}
    >
      <span
        className={`flex size-11 flex-none items-center justify-center rounded-full text-white ${
          pendiente ? "bg-naranja" : "bg-verde"
        }`}
      >
        {(aviso.tipo === "guardado-local" || aviso.tipo === "fallo-envio") && (
          <IconoCelularCheck />
        )}
        {(aviso.tipo === "enviando" || aviso.tipo === "registrada") && (
          <IconoGirando />
        )}
        {(aviso.tipo === "enviado" || aviso.tipo === "enviados") && (
          <IconoCheck />
        )}
        {(aviso.tipo === "falta" || aviso.tipo === "sin-ubicacion") && (
          <IconoAlerta />
        )}
      </span>
      <output className="min-w-0 flex-1 pt-px">
        <span className="block text-[19px] font-extrabold">{titulo}</span>
        <span className="mt-0.5 block text-tinta-2">{detalle}</span>
      </output>
      <button
        type="button"
        onClick={onCerrar}
        aria-label="Cerrar aviso"
        className="flex size-11 flex-none cursor-pointer items-center justify-center rounded-full text-tinta-3"
      >
        <IconoCerrar />
      </button>
    </div>
  );
}

const SECCIONES: { id: Tab; nombre: string; Icono: typeof IconoSemaforo }[] = [
  { id: "riesgo", nombre: "Riesgo", Icono: IconoSemaforo },
  { id: "clima", nombre: "Clima", Icono: IconoSolNube },
  { id: "reportar", nombre: "Reportar", Icono: IconoLapiz },
];

function BarraSecciones({
  tab,
  pendientes,
  despachar,
}: {
  tab: Tab;
  pendientes: number;
  despachar: Dispatch<Accion>;
}) {
  return (
    <nav
      aria-label="Secciones"
      className="grid flex-none grid-cols-3 border-t border-borde bg-white pb-[env(safe-area-inset-bottom)]"
    >
      {SECCIONES.map(({ id, nombre, Icono }) => {
        const actual = tab === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => despachar({ tipo: "ir", tab: id })}
            aria-current={actual ? "page" : undefined}
            className={`flex h-[76px] cursor-pointer flex-col items-center justify-center gap-[3px] text-[17px] ${
              actual
                ? "bg-verde-suave font-extrabold text-verde shadow-[inset_0_4px_0_var(--color-verde)]"
                : "bg-white font-semibold text-tinta-3"
            }`}
          >
            <span className="relative flex">
              <Icono />
              {id === "reportar" && pendientes > 0 && (
                <span className="absolute -top-1.5 -right-4 h-6 min-w-6 rounded-full bg-naranja px-1.5 text-center text-[15px] leading-6 font-black text-white">
                  <span className="sr-only">Por enviar: </span>
                  {pendientes}
                </span>
              )}
            </span>
            <span>{nombre}</span>
          </button>
        );
      })}
    </nav>
  );
}
