import { listarFincas } from "@/lib/db";
import { evaluar } from "@/lib/servicio";

// POST /api/ciclo — recalcula todas las fincas y genera las alertas.
// En producción lo llamaría un cron cada 15 min (consulta automática del
// diagrama); en el prototipo, el botón «Actualizar ahora» del panel.
export async function POST() {
  const resultado = [];
  for (const f of listarFincas()) {
    try {
      const i = await evaluar({
        lat: f.lat,
        lon: f.lon,
        altura: f.altura,
        fincaId: f.id,
        desdeApp: false,
      });
      resultado.push({
        finca: f.id,
        roya: i.roya.nivel,
        irf: i.roya.valor,
        broca: i.broca.nivel,
        señales: i.broca.valor,
        alertas: i.alertasCreadas,
      });
    } catch (err) {
      console.error("[ciclo]", f.id, err);
      resultado.push({ finca: f.id, error: "sin clima" });
    }
  }
  return Response.json({ fincas: resultado });
}
