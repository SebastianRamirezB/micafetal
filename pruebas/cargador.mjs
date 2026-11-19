// Permite importar los .ts de la app sin modificarla: Node 24 ya ejecuta
// TypeScript, pero exige la extensión en los import relativos ("./datos").
// Este gancho prueba con ".ts" cuando la ruta no tiene extensión.

export async function resolve(especificador, contexto, siguiente) {
  try {
    return await siguiente(especificador, contexto);
  } catch (err) {
    const relativo = especificador.startsWith("./") || especificador.startsWith("../");
    if (relativo && !/\.[cm]?[jt]s$/.test(especificador)) {
      return siguiente(`${especificador}.ts`, contexto);
    }
    throw err;
  }
}
