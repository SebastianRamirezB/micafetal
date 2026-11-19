import Link from "next/link";
import type { Dispatch } from "react";
import type { Accion, Registro } from "@/lib/estado";
import {
  IconoChevron,
  IconoGirando,
  IconoMira,
  IconoMontana,
  IconoPin,
} from "./iconos";

const CAMPO =
  "h-[54px] rounded-xl border-2 border-borde bg-white px-3 text-[18px] text-tinta";

export function Bienvenida({
  fincas,
  registro,
  despachar,
}: {
  fincas: { id: string; nombre: string; detalle: string }[];
  registro: Registro;
  despachar: Dispatch<Accion>;
}) {
  return (
    <div className="absolute inset-0 flex flex-col gap-3.5 overflow-y-auto px-4 pt-[18px] pb-6 *:shrink-0">
      <div>
        <h1 className="text-[24px] leading-[1.2] font-extrabold">
          ¿Cuál es su finca?
        </h1>
        <p className="mt-1 text-tinta-3">
          Tóquela para ver su riesgo de la semana.
        </p>
      </div>

      {fincas.map((f) => (
        <button
          key={f.id}
          type="button"
          onClick={() => despachar({ tipo: "elegir-finca", id: f.id })}
          className="flex min-h-[76px] cursor-pointer items-center gap-3 rounded-2xl border-2 border-borde bg-white px-3.5 py-3 text-left"
        >
          <span className="flex size-11 flex-none items-center justify-center rounded-full bg-verde-tinte text-verde">
            <IconoMontana size={24} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[19px] font-extrabold">{f.nombre}</span>
            <span className="block text-tinta-3">{f.detalle}</span>
          </span>
          <IconoChevron dir="derecha" className="flex-none text-verde" />
        </button>
      ))}

      <form
        aria-labelledby="reg-t"
        onSubmit={(ev) => {
          ev.preventDefault();
          despachar({ tipo: "registrar" });
        }}
        className="mt-1.5 flex flex-col gap-3 rounded-2xl border border-borde bg-white p-4"
      >
        <h2 id="reg-t" className="text-[20px] font-extrabold">
          ¿No aparece? Registre su finca
        </h2>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="reg-nombre" className="font-bold">
            Nombre de la finca
          </label>
          <input
            id="reg-nombre"
            type="text"
            value={registro.nombre}
            onChange={(ev) =>
              despachar({
                tipo: "registro",
                cambios: { nombre: ev.target.value },
              })
            }
            placeholder="Ej.: La Esperanza"
            className={CAMPO}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="reg-alt" className="font-bold">
            Altura{" "}
            <span className="font-normal text-tinta-3">
              (opcional, en metros)
            </span>
          </label>
          <input
            id="reg-alt"
            type="number"
            inputMode="numeric"
            value={registro.altura}
            onChange={(ev) =>
              despachar({
                tipo: "registro",
                cambios: { altura: ev.target.value },
              })
            }
            placeholder="Ej.: 1400"
            className={CAMPO}
          />
        </div>
        <button
          type="submit"
          disabled={registro.enviando}
          className="flex min-h-14 cursor-pointer items-center justify-center gap-2.5 rounded-[14px] bg-verde text-[18px] font-extrabold text-white"
        >
          {registro.enviando ? <IconoGirando /> : <IconoMira />}
          {registro.enviando
            ? "Buscando su ubicación…"
            : "Usar mi ubicación y registrar"}
        </button>
        <p className="flex items-center gap-2 text-tinta-3">
          <IconoPin size={20} className="flex-none text-verde" />
          Hágalo parado en la finca.
        </p>
      </form>

      <p className="text-center text-tinta-3">
        ¿Es técnico o de una cooperativa?{" "}
        <Link href="/cooperativa" className="font-bold text-verde underline">
          Ver el panel
        </Link>
      </p>
    </div>
  );
}
