import type { Dispatch } from "react";
import {
  type Accion,
  cuandoSeGuardo,
  type Floracion,
  type Formulario,
  type Hallazgo,
  type ItemCola,
} from "@/lib/estado";
import {
  DibujoFloracion,
  DibujoHallazgo,
  IconoCheck,
  IconoGirando,
  IconoGuardar,
  IconoMas,
  IconoMenos,
  IconoNubeCortada,
} from "./iconos";

const HALLAZGOS: { id: Hallazgo; nombre: string }[] = [
  { id: "nada", nombre: "Nada" },
  { id: "roya", nombre: "Roya" },
  { id: "broca", nombre: "Broca" },
  { id: "ambas", nombre: "Las dos" },
];

const FLORACIONES: { id: Floracion; nombre: string }[] = [
  { id: "no", nombre: "No" },
  { id: "empezando", nombre: "Empezando" },
  { id: "plena", nombre: "Plena" },
];

const ETIQUETA = "text-[19px] font-extrabold";
const CAMPO =
  "rounded-xl border-2 border-borde bg-white px-3 text-[18px] text-tinta";
const BOTON_PASO =
  "flex size-[52px] flex-none cursor-pointer items-center justify-center rounded-full border-2 border-borde bg-white text-verde";

function opcion(elegida: boolean) {
  return elegida ? "border-verde bg-verde-tinte" : "border-borde bg-white";
}

export function Reportar({
  formulario,
  cola,
  enviando,
  despachar,
}: {
  formulario: Formulario;
  cola: ItemCola[];
  enviando: boolean;
  despachar: Dispatch<Accion>;
}) {
  const cambiar = (cambios: Partial<Formulario>) =>
    despachar({ tipo: "formulario", cambios });
  const pct = formulario.porcentaje;

  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-4 pt-3.5 pb-5 *:shrink-0">
        {cola.length === 0 ? (
          <p className="flex items-center gap-2.5 rounded-[14px] bg-verde-tinte px-3.5 py-3 font-extrabold text-verde-oscuro">
            <span className="flex size-8 flex-none items-center justify-center rounded-full bg-verde text-white">
              <IconoCheck size={18} grosor={3.2} />
            </span>
            Todo enviado
          </p>
        ) : (
          <section
            aria-labelledby="cola-t"
            className="flex flex-col gap-2.5 rounded-2xl border-2 border-naranja-borde bg-white p-3.5"
          >
            <div className="flex items-center gap-2.5">
              <h2 id="cola-t" className="flex-1 text-[20px] font-extrabold">
                Por enviar
              </h2>
              <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-naranja px-2 text-[18px] font-black text-white">
                {cola.length}
              </span>
            </div>
            <ul className="flex flex-col gap-2">
              {cola.map((q) => (
                <li
                  key={q.id}
                  className="flex items-center gap-2.5 rounded-xl bg-fondo px-3 py-2.5"
                >
                  {enviando ? (
                    <IconoGirando className="flex-none text-verde" />
                  ) : (
                    <IconoNubeCortada className="flex-none text-naranja" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">{q.texto}</span>
                    <span
                      className={`block font-semibold ${enviando ? "text-verde" : "text-naranja"}`}
                    >
                      {enviando
                        ? "Enviando…"
                        : `Guardado ${cuandoSeGuardo(q.guardado)} · espera señal`}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-tinta-3">Se envía solo cuando haya señal.</p>
          </section>
        )}

        <h1 className="text-[24px] font-extrabold">Cuéntenos qué vio hoy</h1>

        <fieldset className="min-w-0">
          <legend className={`mb-2 ${ETIQUETA}`}>¿Qué encontró?</legend>
          <div className="grid grid-cols-2 gap-2.5">
            {HALLAZGOS.map((h) => {
              const elegida = formulario.hallazgo === h.id;
              return (
                <button
                  key={h.id}
                  type="button"
                  onClick={() =>
                    despachar({ tipo: "elegir-hallazgo", hallazgo: h.id })
                  }
                  aria-pressed={elegida}
                  className={`relative flex min-h-[76px] cursor-pointer items-center gap-2.5 rounded-2xl border-[3px] px-3 text-left text-[19px] font-extrabold ${opcion(elegida)}`}
                >
                  <DibujoHallazgo tipo={h.id} />
                  <span>{h.nombre}</span>
                  {elegida && (
                    <span className="absolute top-[5px] right-[5px] flex size-6 items-center justify-center rounded-full bg-verde text-white">
                      <IconoCheck size={15} grosor={3.2} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </fieldset>

        {formulario.hallazgo !== null && formulario.hallazgo !== "nada" && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="pct" className={ETIQUETA}>
              ¿Cuánto del lote está afectado?
            </label>
            <p className="text-[40px] leading-none font-black text-rojo tabular-nums">
              {pct} %
            </p>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => cambiar({ porcentaje: Math.max(0, pct - 5) })}
                aria-label="Bajar 5 %"
                className={BOTON_PASO}
              >
                <IconoMenos />
              </button>
              <input
                id="pct"
                type="range"
                min={0}
                max={100}
                step={5}
                value={pct}
                onChange={(ev) =>
                  cambiar({ porcentaje: Number(ev.target.value) })
                }
                className="h-[52px] min-w-0 flex-1 accent-verde"
              />
              <button
                type="button"
                onClick={() => cambiar({ porcentaje: Math.min(100, pct + 5) })}
                aria-label="Subir 5 %"
                className={BOTON_PASO}
              >
                <IconoMas />
              </button>
            </div>
          </div>
        )}

        <fieldset className="min-w-0">
          <legend className={`mb-2 ${ETIQUETA}`}>¿Hay floración?</legend>
          <div className="grid grid-cols-3 gap-2">
            {FLORACIONES.map((f) => {
              const elegida = formulario.floracion === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => cambiar({ floracion: f.id })}
                  aria-pressed={elegida}
                  className={`flex min-h-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-[3px] px-1 text-[17px] font-bold ${opcion(elegida)}`}
                >
                  <DibujoFloracion tipo={f.id} />
                  <span>{f.nombre}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="fecha" className={ETIQUETA}>
            Fecha
          </label>
          <input
            id="fecha"
            type="date"
            value={formulario.fecha}
            onChange={(ev) => cambiar({ fecha: ev.target.value })}
            className={`h-[54px] ${CAMPO}`}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="notas" className={ETIQUETA}>
            Notas <span className="font-normal text-tinta-3">(opcional)</span>
          </label>
          <textarea
            id="notas"
            rows={3}
            value={formulario.notas}
            onChange={(ev) => cambiar({ notas: ev.target.value })}
            placeholder="Ej.: lote de abajo, cerca de la quebrada"
            className={`resize-none py-2.5 ${CAMPO}`}
          />
        </div>
      </div>

      <div className="flex-none border-t border-borde bg-fondo px-4 pt-2.5 pb-3">
        <button
          type="button"
          onClick={() =>
            despachar({ tipo: "guardar", ahora: new Date().toISOString() })
          }
          className="flex h-[58px] w-full cursor-pointer items-center justify-center gap-2.5 rounded-[14px] bg-verde text-[19px] font-extrabold text-white"
        >
          <IconoGuardar />
          Guardar reporte
        </button>
      </div>
    </div>
  );
}
