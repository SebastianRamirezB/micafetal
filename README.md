# Mi Cafetal — prototipo

Sistema híbrido de alertas tempranas de roya y broca. Prototipo funcional de la
"Arquitectura consolidada", sin el módulo IoT, sin Redis y sin la PWA instalable.

## Cómo correrlo

Requiere **Node 24** (usa el módulo `node:sqlite` incluido en Node).

```bash
npm install
npm run dev
```

- App del caficultor: <http://localhost:3000>
- Panel de cooperativas: <http://localhost:3000/cooperativa>
- La base SQLite se crea sola en `data/micafetal.db` (otra ruta: `MICAFETAL_DB`).
  Para empezar de cero, borre la carpeta `data/`.

## Qué parte del diagrama cubre

| Diagrama | Prototipo |
|---|---|
| Capa 1 · APIs de clima | Open-Meteo (`src/lib/open-meteo.ts`), 7 días hora a hora; caché de 15 min. El IDEAM (datos.gov.co) se muestra como estación de contraste (`src/lib/ideam.ts`). |
| Capa 1 · Captura local | App para celular: reportes, floración y respuestas; guarda sin señal y sincroniza al volver la señal (`POST /api/sincronizar`). |
| Capa 2 · Validación y fusión | Rangos válidos (T, HR, lluvia) y corrección por altitud `T_finca = T_est + 0,0065 × (h_est − h_finca)` (`src/lib/riesgo.ts`). |
| Capa 2 · Motor de reglas | IRF = 100 × (0,3·f_T + 0,4·f_HR + 0,3·f_P) para roya; 0–4 puntos para broca, con «plaga en la zona» desde los reportes de vecinos a ≤10 km. |
| Capa 2 · Asistente | Mensaje de ≤70 caracteres según la causa principal (`src/lib/mensajes.ts`). |
| Capa 3 · Persistencia | SQLite en lugar de PostgreSQL (`src/lib/db.ts`). |
| Capa 4 · Gestor y pasarela | Alerta en riesgo ALTO; WhatsApp si la finca se conectó en las últimas 24 h, si no cae a SMS. **Simulado**: se registra, no se envía (`src/lib/alertas.ts`). |
| Capa 4 · Dashboard + GIS | `/cooperativa`: indicadores, mapa por zona (Leaflet + OpenStreetMap), fincas, alertas y reportes. |
| Retroalimentación | La respuesta «¿encontró…?» confirma la última alerta; A = confirmadas / enviadas × 100, con aviso al administrador si A < 80 %. La recalibración de pesos es manual. |

## Diferencias declaradas

- **Fuente de clima**: el IDEAM publica con 1–2 días de retraso, por eso el cálculo usa Open-Meteo.
- **Cenicafé** no tiene API pública del estado fitosanitario; se usan sus umbrales.
- **Consulta cada 15 min**: en el prototipo, el botón «Actualizar ahora» del panel llama a `POST /api/ciclo`; en producción lo llamaría un cron.
- Sin inicio de sesión en el panel.
- SQLite local: no sirve en hosting sin disco persistente (p. ej. funciones serverless).
