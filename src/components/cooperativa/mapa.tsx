"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { Nivel } from "@/lib/datos";

export type PuntoMapa = {
  id: string;
  nombre: string;
  lat: number;
  lon: number;
  nivel: Nivel | null;
  detalle: string;
};

// Mismos colores que los tokens de globals.css.
const COLOR: Record<Nivel | "sin", string> = {
  alto: "#b42318",
  medio: "#8a5a00",
  bajo: "#2f6b3a",
  sin: "#4a4740",
};

/** Radio de la zona de cada finca (el mismo de «plaga en la zona»). */
const RADIO_ZONA_M = 10_000;

/** Mapa de riesgo por zona: cada finca con un círculo de 10 km de su color. */
export function MapaRiesgo({ puntos }: { puntos: PuntoMapa[] }) {
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = caja.current;
    if (!el || puntos.length === 0) return;
    let mapa: import("leaflet").Map | null = null;
    let cancelado = false;

    // Leaflet usa `window`: se carga solo en el navegador.
    import("leaflet").then((L) => {
      if (cancelado) return;
      mapa = L.map(el, { scrollWheelZoom: false });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(mapa);

      for (const p of puntos) {
        const color = COLOR[p.nivel ?? "sin"];
        L.circle([p.lat, p.lon], {
          radius: RADIO_ZONA_M,
          color,
          weight: 1,
          fillColor: color,
          fillOpacity: 0.12,
        }).addTo(mapa);
        const popup = document.createElement("div");
        const titulo = document.createElement("strong");
        titulo.textContent = p.nombre;
        const detalle = document.createElement("div");
        detalle.textContent = p.detalle;
        popup.append(titulo, detalle);
        L.circleMarker([p.lat, p.lon], {
          radius: 9,
          color: "#ffffff",
          weight: 2,
          fillColor: color,
          fillOpacity: 1,
        })
          .bindPopup(popup)
          .addTo(mapa);
      }
      mapa.fitBounds(
        L.latLngBounds(puntos.map((p) => [p.lat, p.lon] as [number, number])),
        { padding: [40, 40], maxZoom: 11 },
      );
    });

    return () => {
      cancelado = true;
      mapa?.remove();
    };
  }, [puntos]);

  return (
    <div
      ref={caja}
      role="img"
      aria-label={`Mapa de ${puntos.length} fincas coloreadas por nivel de riesgo`}
      className="h-[360px] w-full overflow-hidden rounded-2xl border border-borde bg-borde-suave"
    />
  );
}
