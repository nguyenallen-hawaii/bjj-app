"use client";

import { useState, useEffect, useRef } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import GymCard from "./GymCard";
import type { GymCardData } from "./GymCard";

interface OpenMatResult extends GymCardData {
  gymId?: string;
  distance?: number;
}

interface OpenMatsNearbyProps {
  lat: number | null;
  lng: number | null;
}

export default function OpenMatsNearby({ lat, lng }: OpenMatsNearbyProps) {
  const [openMats, setOpenMats] = useState<OpenMatResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"map" | "list">("map");
  const [mapError, setMapError] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  // Fetch nearby open mats
  useEffect(() => {
    if (lat === null || lng === null) return;
    setLoading(true);
    fetch(`/api/open-mats/nearby?lat=${lat}&lng=${lng}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        const mats = Array.isArray(data) ? data : [];
        setOpenMats(
          mats.map((m: Record<string, unknown>) => ({
            ...m,
            id: (m.gymId as string) || (m.id as string),
          })) as OpenMatResult[]
        );
      })
      .catch(() => setOpenMats([]))
      .finally(() => setLoading(false));
  }, [lat, lng]);

  // Initialize map
  useEffect(() => {
    if (view !== "map" || !mapContainerRef.current) return;
    if (mapRef.current) return; // already initialized

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      setMapError(true);
      return;
    }

    let cancelled = false;

    import("mapbox-gl").then((mapboxgl) => {
      if (cancelled || !mapContainerRef.current) return;

      mapboxgl.default.accessToken = token;
      const map = new mapboxgl.default.Map({
        container: mapContainerRef.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [lng ?? -98.5, lat ?? 39.8],
        zoom: lat !== null ? 10 : 3,
      });

      mapRef.current = map;

      map.on("error", () => setMapError(true));

      // Add markers for open mats once map loads
      map.on("load", () => {
        addMarkers(mapboxgl.default, map);
      });
    }).catch(() => setMapError(true));

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // Update markers when openMats change
  useEffect(() => {
    if (!mapRef.current || view !== "map") return;
    import("mapbox-gl").then((mapboxgl) => {
      if (mapRef.current) {
        addMarkers(mapboxgl.default, mapRef.current);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openMats, view]);

  function addMarkers(mapboxgl: typeof import("mapbox-gl").default, map: mapboxgl.Map) {
    // Clear existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // We don't have lat/lng per open mat from the API directly,
    // but we can place a single marker at user location as a reference
    // In a real app, the API would return gym coordinates per open mat
    openMats.forEach((om, i) => {
      // Offset markers slightly so they don't stack
      const offsetLat = (lat ?? 39.8) + (Math.random() - 0.5) * 0.05;
      const offsetLng = (lng ?? -98.5) + (Math.random() - 0.5) * 0.05;

      const el = document.createElement("div");
      el.style.width = "14px";
      el.style.height = "14px";
      el.style.borderRadius = "50%";
      el.style.backgroundColor = "#7c3aed";
      el.style.border = "2px solid #a78bfa";
      el.style.cursor = "pointer";
      el.title = om.gymName || om.name || `Open Mat ${i + 1}`;

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([offsetLng, offsetLat])
        .addTo(map);

      markersRef.current.push(marker);
    });
  }

  // Cleanup map on unmount
  useEffect(() => {
    return () => {
      markersRef.current.forEach((m) => m.remove());
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  if (lat === null || lng === null) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between px-4">
        <h2 className="text-lg font-bold text-foreground">Open Mats Nearby</h2>
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => setView("map")}
            className={`px-3 py-1 text-xs font-medium transition-colors ${
              view === "map"
                ? "bg-accent text-white"
                : "bg-surface text-muted hover:text-foreground"
            }`}
            aria-label="Map view"
          >
            Map
          </button>
          <button
            onClick={() => setView("list")}
            className={`px-3 py-1 text-xs font-medium transition-colors ${
              view === "list"
                ? "bg-accent text-white"
                : "bg-surface text-muted hover:text-foreground"
            }`}
            aria-label="List view"
          >
            List
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-accent" />
        </div>
      )}

      {!loading && view === "map" && (
        <div className="px-4">
          {mapError ? (
            <div className="flex h-48 items-center justify-center rounded-xl border border-border bg-surface">
              <p className="text-sm text-muted">Map unavailable. Showing list view.</p>
            </div>
          ) : (
            <div
              ref={mapContainerRef}
              className="h-48 w-full rounded-xl border border-border overflow-hidden"
            />
          )}
        </div>
      )}

      {!loading && view === "list" && (
        <div className="px-4 space-y-2">
          <p className="text-xs text-muted">
            {openMats.length} open mat{openMats.length !== 1 ? "s" : ""} found
          </p>
          {openMats.length === 0 ? (
            <p className="text-sm text-muted py-4 text-center">No open mats nearby</p>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
              {openMats.map((om, i) => (
                <GymCard key={om.id || i} gym={om} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
