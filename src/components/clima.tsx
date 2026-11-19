import type { Dispatch, ReactNode } from "react";
import type { FincaActiva, Informe } from "@/lib/datos";
import type { Accion, Consulta } from "@/lib/estado";
import { decimal, haceCuanto, miles } from "@/lib/formato";
import {
  IconoAntena,
  IconoGota,
  IconoLluvia,
  IconoReloj,
  IconoTermometro,
} from "./iconos";
import { AvisoSinSenal, NoSeActualizo, SinInforme } from "./riesgo";

const RETRASO_IDEAM =
  "El IDEAM publica sus datos con retraso; por eso el aviso usa el clima de Open-Meteo.";

export function Clima({
  finca,
  online,
  consulta,
  despachar,
}: {
  finca: FincaActiva;
  online: boolean;
  consulta: Consulta["estado"] | null;
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
          <section aria-labelledby="ahora-t" className="flex flex-col gap-2.5">
            <h2 id="ahora-t" className="text-[21px] font-extrabold">
              Ahora en su finca
            </h2>
            <div className="grid grid-cols-3 gap-2">
              <Medida
                icono={<IconoTermometro className="text-rojo" />}
                valor={`${decimal(datos.ahora.temperatura)}°`}
                nombre="Temperatura"
              />
              <Medida
                icono={<IconoGota className="text-azul" />}
                valor={`${Math.round(datos.ahora.humedad)} %`}
                nombre="Humedad"
              />
              <Medida
                icono={<IconoLluvia className="text-azul" />}
                valor={`${decimal(datos.ahora.lluvia)} mm`}
                nombre="Lluvia"
              />
            </div>
            <p className="text-tinta-3">
              Open-Meteo, {haceCuanto(datos.ahora.hora)}. Temperatura llevada de
              los {miles(datos.alturaModelo)} m del modelo a los{" "}
              {miles(datos.altura)} m de su finca.
            </p>
          </section>

          <section
            aria-labelledby="semana-t"
            className="flex flex-col gap-3 rounded-2xl border border-borde bg-white p-4"
          >
            <h2 id="semana-t" className="text-[21px] font-extrabold">
              Esta semana
            </h2>
            <p className="text-[18px]">{datos.semana.resumen}</p>
            <GraficoSemana semana={datos.semana} />
            <p className="flex flex-wrap gap-x-4 gap-y-1.5 text-[16px] text-tinta-2">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-3.5 rounded-[3px] bg-azul" />
                Lluvia (mm)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-[3px] w-[18px] rounded-sm bg-rojo" />
                Temperatura promedio (°C)
              </span>
            </p>
          </section>

          <section
            aria-labelledby="ideam-t"
            className="flex flex-col gap-2.5 rounded-2xl border border-borde bg-white p-4"
          >
            <div className="flex items-center gap-2.5">
              <span className="flex size-10 flex-none items-center justify-center rounded-full bg-verde-tinte text-verde">
                <IconoAntena />
              </span>
              <h2 id="ideam-t" className="text-[20px] font-extrabold">
                Estación oficial del IDEAM
              </h2>
            </div>
            {datos.ideam ? (
              <>
                <p>
                  {datos.ideam.estacion}, a {decimal(datos.ideam.distanciaKm)}{" "}
                  km de su finca.
                </p>
                <p>
                  Marcó {decimal(datos.ideam.temperatura)} °C a{" "}
                  {miles(datos.ideam.alturaEstacion)} m; en su finca serían unos{" "}
                  <strong>{decimal(datos.ideam.temperaturaFinca)} °C</strong>.
                </p>
              </>
            ) : (
              <p>No hay una estación del IDEAM con datos recientes cerca.</p>
            )}
            <p className="flex items-start gap-2 rounded-xl bg-naranja-tinte px-3 py-2.5 font-semibold text-naranja-texto">
              <IconoReloj grosor={2.4} className="mt-px flex-none" />
              <span>
                {datos.ideam
                  ? `Dato ${haceCuanto(datos.ideam.fecha)}. ${RETRASO_IDEAM}`
                  : RETRASO_IDEAM}
              </span>
            </p>
          </section>
        </>
      )}
    </div>
  );
}

function Medida({
  icono,
  valor,
  nombre,
}: {
  icono: ReactNode;
  valor: string;
  nombre: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-[14px] border border-borde bg-white px-2 py-3 text-center">
      {icono}
      <span className="text-[28px] leading-[1.1] font-extrabold tabular-nums">
        {valor}
      </span>
      <span className="text-tinta-2">{nombre}</span>
    </div>
  );
}

// La línea de temperatura va en una banda arriba y las barras de lluvia (con
// su número encima) debajo, para que nunca se tapen.
const ALTO = 130;
const BANDA_LINEA = { arriba: 10, abajo: 38 };
const BARRA_MAX = 62;
/** Lluvia (mm) que llena la barra, salvo que algún día llueva más. */
const LLUVIA_MAX = 20;

function GraficoSemana({ semana }: { semana: Informe["semana"] }) {
  const dias = semana.dias;
  const tMin = Math.min(...semana.temperatura);
  const tRango = Math.max(...semana.temperatura) - tMin;
  const lluviaMax = Math.max(LLUVIA_MAX, ...semana.lluvia);
  const puntos = semana.temperatura.map((t, i) => ({
    x: i + 0.5,
    // Semana pareja (sin rango): línea recta a media banda.
    y:
      BANDA_LINEA.abajo -
      (tRango ? (t - tMin) / tRango : 0.5) *
        (BANDA_LINEA.abajo - BANDA_LINEA.arriba),
  }));
  const linea = puntos
    .map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y.toFixed(1)}`)
    .join(" ");
  const descripcion = `Gráfico de la semana. Lluvia en mm: ${semana.lluvia
    .map((mm, i) => `${dias[i]} ${decimal(mm)}`)
    .join(", ")}. ${semana.resumen}`;

  return (
    <div role="img" aria-label={descripcion} className="flex flex-col gap-1">
      <div
        className="relative border-b-2 border-borde"
        style={{ height: ALTO }}
      >
        <div className="absolute inset-0 grid grid-cols-7 items-end">
          {semana.lluvia.map((mm, i) => (
            <div
              key={dias[i]}
              className="flex flex-col items-center justify-end gap-0.5"
            >
              <span className="text-[16px] font-bold text-azul-oscuro tabular-nums">
                {mm > 0 && mm < 10 ? decimal(mm) : Math.round(mm)}
              </span>
              <span
                className="w-[22px] rounded-t bg-azul"
                style={{
                  height: Math.max(3, Math.round((mm / lluviaMax) * BARRA_MAX)),
                }}
              />
            </div>
          ))}
        </div>
        {/* La línea se estira con el ancho; el trazo conserva su grosor. */}
        <svg
          viewBox={`0 0 7 ${ALTO}`}
          preserveAspectRatio="none"
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 size-full overflow-visible"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path
            d={linea}
            stroke="#ffffff"
            strokeWidth="6"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={linea}
            className="stroke-rojo"
            strokeWidth="2.8"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {puntos.map((p, i) => (
          <span
            key={dias[i]}
            className="pointer-events-none absolute size-[10.5px] -translate-1/2 rounded-full border-[1.5px] border-white bg-rojo"
            style={{ left: `${(p.x / 7) * 100}%`, top: p.y }}
          />
        ))}
      </div>
      <div className="grid grid-cols-7 text-center">
        {semana.temperatura.map((t, i) => (
          <div key={dias[i]} className="flex flex-col">
            <span className="text-[16px] font-bold">{dias[i]}</span>
            <span className="text-[16px] text-rojo tabular-nums">
              {decimal(t)}°
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
