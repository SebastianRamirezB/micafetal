import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { type ReactNode, Suspense } from "react";
import { Actualizar } from "@/components/cooperativa/actualizar";
import { MapaRiesgo, type PuntoMapa } from "@/components/cooperativa/mapa";
import { Logo } from "@/components/iconos";
import { perfilConectividad } from "@/lib/alertas";
import type { Nivel } from "@/lib/datos";
import {
  alertasRecientes,
  type FilaPanelFinca,
  historialIrf,
  indicadorAciertos,
  panelFincas,
  reportesRecientes,
} from "@/lib/db";
import { haceCuanto, miles } from "@/lib/formato";

export const metadata: Metadata = {
  title: "Panel de cooperativas · Mi Cafetal",
  description: "Riesgo de roya y broca por finca, alertas enviadas y aciertos.",
};

/** Meta del indicador de aciertos; por debajo se avisa al administrador. */
const META_A = 80;
const DIAS_INDICADOR = 30;

const ORDEN: Record<Nivel, number> = { bajo: 0, medio: 1, alto: 2 };
const ESTILO_NIVEL: Record<Nivel, string> = {
  alto: "bg-rojo-tinte text-rojo",
  medio: "bg-ambar-tinte text-ambar",
  bajo: "bg-verde-tinte text-verde-oscuro",
};
const HALLAZGO: Record<string, string> = {
  nada: "Nada",
  roya: "Roya",
  broca: "Broca",
  ambas: "Roya y broca",
};

function fechaCorta(iso: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Bogota",
  }).format(new Date(iso));
}

function peorNivel(f: FilaPanelFinca): Nivel | null {
  if (!f.nivel_roya || !f.nivel_broca) return f.nivel_roya ?? f.nivel_broca;
  return ORDEN[f.nivel_roya] >= ORDEN[f.nivel_broca]
    ? f.nivel_roya
    : f.nivel_broca;
}

export default function PanelCooperativas() {
  return (
    <div className="min-h-dvh bg-fondo text-[16px] text-tinta">
      <header className="bg-verde text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <Logo className="flex-none" />
          <div className="min-w-0 flex-1">
            <h1 className="text-[22px] leading-tight font-extrabold">
              Panel de cooperativas
            </h1>
            <p className="text-[15px] opacity-90">
              Riesgo de roya y broca, alertas y aciertos
            </p>
          </div>
          <Actualizar />
        </div>
      </header>
      <main className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-5">
        <Suspense
          fallback={<p className="text-tinta-3">Cargando datos del panel…</p>}
        >
          <Panel />
        </Suspense>
        <p className="text-[14px] text-tinta-3">
          Prototipo: los mensajes de WhatsApp y SMS se simulan (se registran, no
          se envían). Clima de Open-Meteo; el IDEAM se usa como contraste.{" "}
          <Link href="/" className="font-bold text-verde underline">
            Ir a la app del caficultor
          </Link>
        </p>
      </main>
    </div>
  );
}

async function Panel() {
  // Lecturas síncronas de SQLite: deben ocurrir en cada petición.
  await connection();
  const fincas = panelFincas();
  const historial = historialIrf();
  const alertas = alertasRecientes();
  const reportes = reportesRecientes();
  const ind = indicadorAciertos(DIAS_INDICADOR);
  const enRiesgoAlto = fincas.filter((f) => peorNivel(f) === "alto").length;
  const costo = alertas.reduce((s, a) => s + (a.costo ?? 0), 0);

  const puntos: PuntoMapa[] = fincas.map((f) => ({
    id: f.id,
    nombre: f.nombre,
    lat: f.lat,
    lon: f.lon,
    nivel: peorNivel(f),
    detalle:
      f.irf === null
        ? "Sin cálculo todavía"
        : `Roya: IRF ${f.irf} (${f.nivel_roya}) · Broca: ${f.broca_puntos} de 4 (${f.nivel_broca})`,
  }));

  return (
    <>
      <section
        aria-label="Indicadores"
        className="grid grid-cols-2 gap-3 md:grid-cols-4"
      >
        <Tarjeta titulo="Fincas" valor={String(fincas.length)} />
        <Tarjeta
          titulo="En riesgo alto"
          valor={String(enRiesgoAlto)}
          nota="Roya o broca"
        />
        <Tarjeta
          titulo="Alertas enviadas"
          valor={String(ind.enviadas)}
          nota={`Últimos ${DIAS_INDICADOR} días · $${miles(costo)} COP en SMS`}
        />
        <Tarjeta
          titulo="Aciertos (A)"
          valor={ind.a === null ? "—" : `${ind.a} %`}
          nota={`${ind.confirmadas} confirmadas de ${ind.enviadas} · meta ≥ ${META_A} %`}
        />
      </section>

      {ind.a !== null && ind.a < META_A && (
        <p
          role="alert"
          className="rounded-xl border border-naranja-borde bg-naranja-tinte px-4 py-3 font-semibold text-naranja-oscuro"
        >
          Alerta al administrador: el indicador de aciertos ({ind.a} %) está por
          debajo de la meta ({META_A} %). Revise los umbrales y los pesos del
          IRF con las confirmaciones y las guías de Cenicafé.
          {ind.respondidas < ind.enviadas &&
            ` Faltan ${ind.enviadas - ind.respondidas} alertas por responder.`}
        </p>
      )}

      <section className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <div className="flex flex-col gap-2">
          <h2 className="text-[20px] font-extrabold">
            Mapa de riesgo por zona
          </h2>
          <MapaRiesgo puntos={puntos} />
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-[14px] text-tinta-2">
            <Muestra color="bg-rojo" texto="Alto" />
            <Muestra color="bg-ambar" texto="Medio" />
            <Muestra color="bg-verde" texto="Bajo" />
            <span>Círculo: zona de 10 km</span>
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <h2 className="text-[20px] font-extrabold">Fincas</h2>
          <Tabla
            columnas={[
              "Finca",
              "Roya (IRF)",
              "Broca",
              "Histórico IRF",
              "Canal",
              "Cálculo",
            ]}
          >
            {fincas.map((f) => (
              <tr key={f.id} className="border-t border-borde-suave">
                <td className="px-3 py-2">
                  <span className="block font-bold">{f.nombre}</span>
                  <span className="text-[14px] text-tinta-3">
                    {[f.municipio, f.altura && `${miles(f.altura)} m`]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </td>
                <td className="px-3 py-2">
                  {f.nivel_roya ? (
                    <Etiqueta nivel={f.nivel_roya} texto={String(f.irf)} />
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2">
                  {f.nivel_broca ? (
                    <Etiqueta
                      nivel={f.nivel_broca}
                      texto={`${f.broca_puntos} de 4`}
                    />
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2 text-[14px] text-tinta-2 tabular-nums">
                  {historial[f.id]?.join(" → ") ?? "—"}
                </td>
                <td className="px-3 py-2 text-[14px]">
                  {perfilConectividad(f) === "con-datos" ? "WhatsApp" : "SMS"}
                </td>
                <td className="px-3 py-2 text-[14px] text-tinta-3">
                  {f.fecha ? haceCuanto(f.fecha) : "—"}
                </td>
              </tr>
            ))}
          </Tabla>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-[20px] font-extrabold">Alertas y mensajes</h2>
        {alertas.length === 0 ? (
          <Vacio texto="Todavía no hay alertas. Se crean cuando una finca llega a riesgo alto." />
        ) : (
          <Tabla
            columnas={[
              "Fecha",
              "Finca",
              "Mensaje",
              "Canal",
              "Costo",
              "Confirmación",
            ]}
          >
            {alertas.map((a) => (
              <tr key={a.id} className="border-t border-borde-suave">
                <td className="px-3 py-2 text-[14px] whitespace-nowrap">
                  {fechaCorta(a.creada)}
                </td>
                <td className="px-3 py-2">{a.finca}</td>
                <td className="px-3 py-2">
                  <span className="block">{a.mensaje}</span>
                  <span className="text-[13px] text-tinta-3">
                    {a.mensaje.length} caracteres · 1 SMS
                  </span>
                </td>
                <td className="px-3 py-2 text-[14px]">
                  {a.canales
                    ?.replace("whatsapp", "WhatsApp")
                    .replace("sms", "SMS")}
                </td>
                <td className="px-3 py-2 text-[14px] tabular-nums">
                  ${miles(a.costo ?? 0)}
                </td>
                <td className="px-3 py-2 text-[14px]">
                  {a.confirmada === null
                    ? "Sin respuesta"
                    : a.confirmada
                      ? "Sí la encontró"
                      : "No la encontró"}
                </td>
              </tr>
            ))}
          </Tabla>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-[20px] font-extrabold">Reportes de caficultores</h2>
        {reportes.length === 0 ? (
          <Vacio texto="Todavía no han llegado reportes desde la app." />
        ) : (
          <Tabla
            columnas={["Recibido", "Finca", "Encontró", "Floración", "Notas"]}
          >
            {reportes.map((r) => (
              <tr key={r.id} className="border-t border-borde-suave">
                <td className="px-3 py-2 text-[14px] whitespace-nowrap">
                  {fechaCorta(r.recibido)}
                </td>
                <td className="px-3 py-2">{r.finca}</td>
                <td className="px-3 py-2">
                  {HALLAZGO[r.hallazgo] ?? r.hallazgo}
                  {r.hallazgo !== "nada" && `, ${r.porcentaje} % del lote`}
                </td>
                <td className="px-3 py-2 text-[14px]">{r.floracion ?? "—"}</td>
                <td className="px-3 py-2 text-[14px] text-tinta-2">
                  {r.notas || "—"}
                </td>
              </tr>
            ))}
          </Tabla>
        )}
      </section>
    </>
  );
}

function Tarjeta({
  titulo,
  valor,
  nota,
}: {
  titulo: string;
  valor: string;
  nota?: string;
}) {
  return (
    <div className="rounded-2xl border border-borde bg-white p-4">
      <p className="font-bold text-tinta-2">{titulo}</p>
      <p className="mt-1 text-[32px] leading-none font-extrabold tabular-nums">
        {valor}
      </p>
      {nota && <p className="mt-1.5 text-[14px] text-tinta-3">{nota}</p>}
    </div>
  );
}

function Etiqueta({ nivel, texto }: { nivel: Nivel; texto: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[14px] font-bold whitespace-nowrap ${ESTILO_NIVEL[nivel]}`}
    >
      {texto} · {nivel}
    </span>
  );
}

function Muestra({ color, texto }: { color: string; texto: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`size-3 rounded-full ${color}`} />
      {texto}
    </span>
  );
}

function Tabla({
  columnas,
  children,
}: {
  columnas: string[];
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-borde bg-white">
      <table className="w-full text-left">
        <thead className="bg-verde-suave text-[14px] text-tinta-2">
          <tr>
            {columnas.map((c) => (
              <th key={c} scope="col" className="px-3 py-2 font-bold">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Vacio({ texto }: { texto: string }) {
  return (
    <p className="rounded-2xl border border-borde bg-white px-4 py-5 text-tinta-3">
      {texto}
    </p>
  );
}
