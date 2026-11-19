"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { IconoGirando } from "../iconos";

/** Ejecuta el ciclo (consulta + motor + alertas) y recarga el panel. */
export function Actualizar() {
  const router = useRouter();
  const [estado, setEstado] = useState<"listo" | "cargando" | "error">("listo");

  async function actualizar() {
    setEstado("cargando");
    try {
      const r = await fetch("/api/ciclo", { method: "POST" });
      if (!r.ok) throw new Error();
      setEstado("listo");
      router.refresh();
    } catch {
      setEstado("error");
    }
  }

  return (
    <div className="flex items-center gap-3">
      {estado === "error" && (
        <span className="font-semibold text-naranja-claro">
          No se pudo actualizar
        </span>
      )}
      <button
        type="button"
        onClick={actualizar}
        disabled={estado === "cargando"}
        className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-white px-4 font-extrabold text-verde disabled:opacity-70"
      >
        {estado === "cargando" && <IconoGirando size={20} grosor={2.4} />}
        {estado === "cargando" ? "Calculando…" : "Actualizar ahora"}
      </button>
    </div>
  );
}
