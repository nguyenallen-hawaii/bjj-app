"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";

interface SearchResult {
  id: string;
  name: string;
  city?: string;
  state?: string;
  type: "gym" | "coach";
}

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }
    setLoading(true);
    try {
      const [gymsRes, coachesRes] = await Promise.all([
        fetch(`/api/gyms?search=${encodeURIComponent(q)}`),
        fetch(`/api/coaches?search=${encodeURIComponent(q)}`),
      ]);
      const gyms = gymsRes.ok ? await gymsRes.json() : [];
      const coaches = coachesRes.ok ? await coachesRes.json() : [];

      const mapped: SearchResult[] = [
        ...gyms.slice(0, 5).map((g: { id: string; name: string; city?: string; state?: string }) => ({
          id: g.id, name: g.name, city: g.city, state: g.state, type: "gym" as const,
        })),
        ...coaches.slice(0, 5).map((c: { id: string; name: string; gym?: { city?: string; state?: string } }) => ({
          id: c.id, name: c.name, city: c.gym?.city, state: c.gym?.state, type: "coach" as const,
        })),
      ];
      setResults(mapped);
      setIsOpen(mapped.length > 0);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(query), 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query, search]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={containerRef} className="relative px-4 py-2">
      <div className="relative">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder="Search gyms, coaches, styles..."
          className="w-full rounded-xl border border-border bg-surface py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
          aria-label="Search gyms and coaches"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-accent" />
          </div>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute left-4 right-4 z-50 mt-1 rounded-xl border border-border bg-surface shadow-lg overflow-hidden">
          {results.map((r) => (
            <Link
              key={`${r.type}-${r.id}`}
              href={r.type === "gym" ? `/gyms/${r.id}` : `/gyms/${r.id}`}
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-light transition-colors"
            >
              <span className="rounded bg-accent/20 px-1.5 py-0.5 text-[10px] font-medium text-accent-light uppercase">
                {r.type}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground truncate">{r.name}</p>
                {(r.city || r.state) && (
                  <p className="text-[10px] text-muted">{[r.city, r.state].filter(Boolean).join(", ")}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
