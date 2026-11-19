import type { Dispatch } from "react";
import {
  type FincaActiva,
  type Nivel,
  PLAGAS,
  type PlagaId,
  QUE_HACER,
  type RiesgoPlaga,
} from "@/lib/datos";
import type { Accion, Consulta, ItemCola, Respuesta } from "@/lib/estado";
import { haceCuanto, miles } from "@/lib/formato";
import {
  IconoAlerta,
  IconoCheck,
  IconoChevron,
  IconoExclamacion,
  IconoLista,
  IconoNubeCortada,
  IconoPregunta,
  IconoReloj,
  IconoRelojArena,
  IconoTriangulo,
} from "./iconos";

const NIVEL: Record<
  Nivel,
  { palabra: string; fondo: string; texto: string; tinte: string }
> = {
  bajo: {
    palabra: "BAJO",
    fondo: "bg-verde",
    texto: "text-verde",
    tinte: "bg-verde-tinte",
  },
  medio: {
    palabra: "MEDIO",
    fondo: "bg-ambar",
    texto: "text-ambar",
    tinte: "bg-ambar-tinte",
  },
  alto: {
    palabra: "ALTO",
    fondo: "bg-rojo",
    texto: "text-rojo",
    tinte: "bg-rojo-tinte",
  },
};

export function AvisoSinSenal() {
  return (
    <p className="flex items-center gap-2.5 rounded-xl border border-naranja-borde bg-naranja-tinte px-3.5 py-3 font-bold text-naranja-oscuro">
      <IconoNubeCortada className="flex-none text-naranja" />
      Sin señal: mostrando lo último guardado
    </p>
  );
}

type EstadoConsulta = Consulta["estado"] | null;

/** Pantalla cuando todavía no hay ningún cálculo guardado de la finca. */
export function SinInforme({
  finca,
  online,
  consulta,
  despachar,
}: {
  finca: FincaActiva;
  online: boolean;
  consulta: EstadoConsulta;
  despachar: Dispatch<Accion>;
}) {
  const donde =
    finca.altura === null
      ? `en ${finca.nombre}`
      : `en ${finca.nombre}, a ${miles(finca.altura)} m`;

  if (consulta === "error" || !online) {
    return (
      <div className="my-auto flex flex-col items-center gap-3 px-2 py-6 text-center">
        <span className="flex size-[116px] items-center justify-center rounded-full bg-naranja-tinte text-naranja">
          <IconoNubeCortada size={60} grosor={1.8} />
        </span>
        <h1 className="mt-1.5 text-[24px] leading-[1.2] font-extrabold">
          {online
            ? "No pudimos traer el clima de su finca"
            : "Todavía no hay un cálculo guardado"}
        </h1>
        <p className="text-[19px] text-tinta-2">
          {online
            ? "Puede ser la señal o el servicio del clima."
            : "Cuando vuelva la señal calculamos el riesgo de su finca."}
        </p>
        {online && (
          <button
            type="button"
            onClick={() => despachar({ tipo: "reintentar" })}
            className="mt-1 min-h-14 cursor-pointer rounded-[14px] bg-verde px-6 text-[18px] font-extrabold text-white"
          >
            Intentar otra vez
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="my-auto flex flex-col items-center gap-3 px-2 py-6 text-center">
      <span className="flex size-[116px] items-center justify-center rounded-full bg-verde-tinte text-verde">
        <IconoRelojArena size={60} grosor={1.8} />
      </span>
      <h1 className="mt-1.5 text-[24px] leading-[1.2] font-extrabold">
        Estamos calculando el riesgo de su finca
      </h1>
      <p className="text-[19px] text-tinta-2">Un momento, por favor.</p>
      <p className="text-tinta-3">
        Usamos el clima de los últimos 7 días {donde}.
      </p>
    </div>
  );
}

/** Aviso pequeño cuando hay un cálculo guardado pero no se pudo actualizar. */
export function NoSeActualizo({
  calculado,
  despachar,
}: {
  calculado: string;
  despachar: Dispatch<Accion>;
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-naranja-borde bg-naranja-tinte px-3.5 py-3 text-naranja-oscuro">
      <IconoAlerta size={22} className="mt-px flex-none text-naranja" />
      <p className="min-w-0 flex-1">
        <span className="font-bold">No se pudo actualizar.</span> Mostrando el
        cálculo de {haceCuanto(calculado)}.{" "}
        <button
          type="button"
          onClick={() => despachar({ tipo: "reintentar" })}
          className="min-h-10 cursor-pointer font-bold underline"
        >
          Intentar otra vez
        </button>
      </p>
    </div>
  );
}

export function Riesgo({
  finca,
  online,
  abierto,
  respuesta,
  cola,
  consulta,
  despachar,
}: {
  finca: FincaActiva;
  online: boolean;
  abierto: Record<string, boolean>;
  respuesta: Partial<Record<PlagaId, Respuesta>>;
  cola: ItemCola[];
  consulta: EstadoConsulta;
  despachar: Dispatch<Accion>;
}) {
  const datos = finca.informe;

  return (
    <div className="absolute inset-0 flex flex-col gap-3.5 overflow-y-auto px-4 pt-3.5 pb-5 *:shrink-0">
      {!online && <AvisoSinSenal />}

      {!datos ? (
        <SinInforme
          finca={finca}
          online={online}
          consulta={consulta}
          despachar={despachar}
        />
      ) : (
        <>
          {online && consulta === "error" && (
            <NoSeActualizo calculado={datos.calculado} despachar={despachar} />
          )}
          <p className="flex items-start gap-2 text-tinta-3">
            <IconoReloj className="mt-0.5 flex-none" />
            <span>
              {consulta === "cargando"
                ? "Actualizando con el clima de hoy…"
                : `Calculado ${haceCuanto(datos.calculado)} con el clima de los últimos 7 días de su finca`}
            </span>
          </p>

          {PLAGAS.map((plaga) => (
            <Tarjeta
              key={plaga.id}
              plaga={plaga}
              riesgo={datos[plaga.id]}
              abierto={abierto}
              respuesta={respuesta[plaga.id] ?? null}
              pendiente={cola.some(
                (q) =>
                  q.contenido.tipo === "respuesta" &&
                  q.contenido.plaga === plaga.id &&
                  q.fincaId === finca.id,
              )}
              despachar={despachar}
            />
          ))}

          <p className="mt-1 text-center text-[17px] text-tinta-3">
            Fuente: Open-Meteo, corregido a la altura de su finca. Umbrales de
            Cenicafé.{" "}
            <strong className="text-tinta">La app avisa; usted decide.</strong>
          </p>
        </>
      )}
    </div>
  );
}

function Tarjeta({
  plaga,
  riesgo,
  abierto,
  respuesta,
  pendiente,
  despachar,
}: {
  plaga: (typeof PLAGAS)[number];
  riesgo: RiesgoPlaga;
  abierto: Record<string, boolean>;
  respuesta: Respuesta | null;
  pendiente: boolean;
  despachar: Dispatch<Accion>;
}) {
  const n = NIVEL[riesgo.nivel];
  const titulo = `${plaga.nombre}, riesgo ${riesgo.nivel}`;
  const claveHacer = `${plaga.id}-hacer`;
  const clavePorque = `${plaga.id}-porque`;
  // «¿Qué hacer?» viene abierto salvo cuando el riesgo es bajo.
  const hacerAbierto =
    claveHacer in abierto ? abierto[claveHacer] : riesgo.nivel !== "bajo";
  const porqueAbierto = !!abierto[clavePorque];

  return (
    <section
      aria-label={titulo}
      className="overflow-hidden rounded-[18px] border border-borde bg-white"
    >
      <div className={`flex items-center gap-3.5 p-4 ${n.tinte}`}>
        <div
          className={`flex size-[88px] flex-none flex-col items-center justify-center gap-0.5 rounded-full text-white ${n.fondo}`}
        >
          {riesgo.nivel === "bajo" && <IconoCheck size={26} />}
          {riesgo.nivel === "medio" && <IconoExclamacion size={26} />}
          {riesgo.nivel === "alto" && <IconoTriangulo size={26} />}
          <span className="text-[18px] font-black tracking-[0.04em]">
            {n.palabra}
          </span>
        </div>
        <div className="min-w-0">
          <h2 className="text-[22px] leading-[1.2] font-extrabold">{titulo}</h2>
          <p className="mt-0.5 text-tinta-2">{plaga.descripcion}</p>
          <p className={`mt-1 text-[17px] font-bold ${n.texto}`}>
            {riesgo.dato}
          </p>
        </div>
      </div>

      <div className="px-4 pb-3.5">
        <button
          type="button"
          onClick={() =>
            despachar({
              tipo: "alternar",
              clave: claveHacer,
              valor: !hacerAbierto,
            })
          }
          aria-expanded={hacerAbierto}
          className="flex min-h-14 w-full cursor-pointer items-center gap-2.5 text-left text-[19px] font-extrabold"
        >
          <IconoLista className="flex-none text-verde" />
          <span className="flex-1">¿Qué hacer?</span>
          <IconoChevron dir={hacerAbierto ? "arriba" : "abajo"} />
        </button>
        {hacerAbierto && (
          <ol className="mb-3 flex flex-col gap-2.5">
            {QUE_HACER[plaga.id][riesgo.nivel].map((paso, i) => (
              <li key={paso} className="flex items-start gap-2.5">
                <span
                  className={`flex size-7 flex-none items-center justify-center rounded-full font-black ${n.tinte} ${n.texto}`}
                >
                  {i + 1}
                </span>
                <span>{paso}</span>
              </li>
            ))}
          </ol>
        )}

        <button
          type="button"
          onClick={() =>
            despachar({
              tipo: "alternar",
              clave: clavePorque,
              valor: !porqueAbierto,
            })
          }
          aria-expanded={porqueAbierto}
          className="flex min-h-14 w-full cursor-pointer items-center gap-2.5 border-t border-borde-suave text-left text-[19px] font-extrabold"
        >
          <IconoPregunta className="flex-none text-verde" />
          <span className="flex-1">¿Por qué?</span>
          <IconoChevron dir={porqueAbierto ? "arriba" : "abajo"} />
        </button>
        {porqueAbierto && (
          <div className="mb-3 flex flex-col gap-2.5">
            <p aria-hidden="true" className="text-[16px] text-tinta-3">
              <span className="font-extrabold text-rojo">▲</span> suma al riesgo
              · <span className="font-extrabold text-verde">▽</span> no suma
            </p>
            <ul className="flex flex-col gap-2.5">
              {riesgo.factores.map((f) => (
                <li key={f.texto} className="flex items-start gap-2.5">
                  <span
                    aria-hidden="true"
                    className={`w-6 flex-none text-[20px] leading-[1.2] font-black ${f.suma ? "text-rojo" : "text-verde"}`}
                  >
                    {f.suma ? "▲" : "▽"}
                  </span>
                  <span>
                    <span className="sr-only">
                      {f.suma ? "Suma al riesgo: " : "No suma: "}
                    </span>
                    <span className="block font-bold">{f.texto}</span>
                    <span className="block text-tinta-3">{f.nota}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {riesgo.nivel !== "bajo" && (
          <div className="flex flex-col gap-2.5 rounded-[14px] bg-fondo p-3.5">
            {respuesta === null ? (
              <>
                <p className="text-[18px] font-extrabold">
                  Cuando revise: ¿encontró {plaga.id}?
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() =>
                      despachar({
                        tipo: "responder",
                        plaga: plaga.id,
                        valor: "si",
                        ahora: new Date().toISOString(),
                      })
                    }
                    className="min-h-14 cursor-pointer rounded-[14px] bg-verde px-2 text-[17px] font-extrabold text-white"
                  >
                    Sí, la encontré
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      despachar({
                        tipo: "responder",
                        plaga: plaga.id,
                        valor: "no",
                        ahora: new Date().toISOString(),
                      })
                    }
                    className="min-h-14 cursor-pointer rounded-[14px] border-2 border-verde bg-white px-2 text-[17px] font-extrabold text-verde"
                  >
                    No la encontré
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="flex items-start gap-2.5 font-bold text-verde-oscuro">
                  <span className="flex size-[30px] flex-none items-center justify-center rounded-full bg-verde text-white">
                    <IconoCheck size={18} grosor={3.2} />
                  </span>
                  <span>
                    Gracias, su respuesta nos ayuda a mejorar los avisos.
                  </span>
                </p>
                <p className="text-tinta-2">
                  Usted respondió:{" "}
                  <strong>
                    {respuesta === "si" ? "Sí, la encontré" : "No la encontré"}
                  </strong>
                  {pendiente && " · guardada en el celular"}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    despachar({ tipo: "borrar-respuesta", plaga: plaga.id })
                  }
                  className="min-h-11 cursor-pointer self-start font-bold text-verde underline"
                >
                  Cambiar respuesta
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
