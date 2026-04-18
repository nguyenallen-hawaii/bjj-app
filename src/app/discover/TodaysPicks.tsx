"use client";

import { useState, useEffect } from "react";
import GymCard from "./GymCard";
import type { GymCardData } from "./GymCard";

export default function TodaysPicks() {
  const [gyms, setGyms] = useState<GymCardData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/gyms")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setGyms(Array.isArray(data) ? data.slice(0, 10) : []))
      .catch(() => setGyms([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="space-y-3">
      <h2 className="px-4 text-lg font-bold text-foreground">Today&apos;s Picks</h2>
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-accent" />
        </div>
      ) : gyms.length === 0 ? (
        <p className="px-4 text-sm text-muted">No gyms to show yet</p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2 px-4">
          {gyms.map((gym) => (
            <GymCard key={gym.id} gym={gym} />
          ))}
        </div>
      )}
    </section>
  );
}
