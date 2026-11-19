# Pruebas experimentales de Mi Cafetal (Etapa 4)

Estas pruebas no modifican la app. Importan sus módulos de cálculo tal como están (`src/lib/riesgo.ts` y `src/lib/mensajes.ts`) y, si la app está corriendo, le hacen peticiones reales y miden los tiempos.

## Cómo correrlas

Hay que usar Node 24 y ejecutar desde la carpeta del proyecto (`micafetal`).

1. Arranque la app con una base aparte para que las pruebas no ensucien la suya:

   ```bash
   MICAFETAL_DB=data/pruebas.db npm run dev
   ```

2. En otra terminal, con internet, porque P5 consulta Open-Meteo:

   ```bash
   MICAFETAL_DB=data/pruebas.db node pruebas/correr.mjs
   ```

Si la app no está corriendo, el script solo ejecuta P1 a P4.

Los resultados quedan en `pruebas/resultados/`:

- `reporte.html` trae la tabla de KPI y los gráficos de dispersión. Ábralo en el navegador.
- Los `P*.csv` son las tablas de datos. Abren directo en Excel (separador «;», coma decimal).
- `resumen_kpi.csv` compara cada KPI con lo que se midió.

## Qué mide cada prueba

| Prueba | Qué compara | KPI de la Etapa 3 | Gráfico |
|---|---|---|---|
| P1 | IRF de la app frente al cálculo a mano en 32 semanas sintéticas: el ejemplo de la Etapa 3, los bordes de los umbrales y una rejilla de casos | IRF = 100·(0,3fT+0,4fHR+0,3fP); medio ≥ 40, alto ≥ 70 | IRF a mano vs IRF app (diagonal) |
| P1b | Bordes de los datos: HR = 90 % exacto y lluvia de 0,9 mm no deben contar | Umbrales de Cenicafé | tabla |
| P2 | Las 16 combinaciones de las 4 señales de broca | 0–4 puntos; medio ≥ 2, alto ≥ 3 | tabla |
| P3 | Longitud y segmentos SMS de todos los mensajes distintos de la app y de los ejemplos escritos en la Etapa 3 | ≤ 70 caracteres (1 segmento) | caracteres vs límite 70 |
| P4 | Corrección por altitud de 1.000 a 2.200 m | T_finca = T_est + 0,0065·(h_est − h_finca) | altura vs T corregida |
| P5 | Tiempo real de `/api/riesgo` en 8 puntos del Eje Cafetero (en frío y con caché) y de `/api/ciclo`. También compara el IRF con clima real frente al cálculo a mano | T_resp ≤ 8 s (API + motor ≤ 3 s; pasarela 5 s supuesta) | petición vs ms; horas húmedas vs IRF |
| P6 | Sincroniza colas guardadas sin señal de 1 a 200 ítems, con 10 % de inválidos, y luego las reenvía | Todo llega una sola vez | tamaño de cola vs ms |
| P7 | Indicador A leído de la base | A ≥ 80 % | tabla |

## Desvíos frente a la Etapa 3

- El mensaje de ejemplo «ALERTA ROYA: Finca [ID]. Temp 22C, HR 92%…» tiene **89 caracteres**, no los 68 que dice el informe. Los mensajes de la app sí caben en 70.
- Los mensajes de la app no llevan tildes, así que viajan en GSM-7 (160 caracteres por SMS). El límite de 70 que se usa es más estricto de lo necesario.
- T_resp: la app fija 8 s en el código (`alertas.ts`). P5 mide de verdad la parte de API + motor; los 5 s de la pasarela siguen siendo un supuesto, porque el envío está simulado.
- El costo por SMS es de 50 pesos en la app y de 25 pesos en uno de los cálculos de la Etapa 3.
- Indicador A: la base de pruebas no tiene confirmaciones, así que A no se puede medir todavía. Hacen falta respuestas reales de «¿encontró…?».
