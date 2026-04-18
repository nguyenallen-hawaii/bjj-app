"use client";

import { useState, useEffect } from "react";
import CoachCard from "./CoachCard";
import type { CoachCardData } from "./CoachCard";

export default function PrivateCoaching() {
  const [coaches, setCoaches] = useState<CoachCardData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/coaches")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setCoaches(Array.isArray(data) ? data.slice(0, 10) : []))
      .catch(() => setCoaches([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="space-y-3">
      <h2 className="px-4 text-lg font-bold text-foreground">Book 1-on-1 Private Coaching</h2>
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-accent" />
        </div>
      ) : coaches.length === 0 ? (
        <p className="px-4 text-sm text-muted">No coaches available yet</p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2 px-4">
          {coaches.map((coach) => (
            <CoachCard key={coach.id} coach={coach} />
          ))}
        </div>
      )}
    </section>
  );
}
