"use client";

import Link from "next/link";

export interface GymCardData {
  id: string;
  name: string;
  city?: string;
  state?: string;
  trainingStyles?: string[];
  skillLevels?: string[];
  nextSessionTime?: string;
  thumbnailUrl?: string;
  // open-mat specific fields from nearby API
  gymName?: string;
  gymCity?: string;
  gymState?: string;
  gymTrainingStyles?: string[];
  startTime?: string;
  date?: string;
}

export default function GymCard({ gym }: { gym: GymCardData }) {
  const name = gym.name || gym.gymName || "Unknown Gym";
  const city = gym.city || gym.gymCity || "";
  const state = gym.state || gym.gymState || "";
  const styles = gym.trainingStyles || gym.gymTrainingStyles || [];
  const level = gym.skillLevels?.[0] || "";
  const sessionTime = gym.nextSessionTime || formatSessionTime(gym.date, gym.startTime);

  return (
    <Link
      href={`/gyms/${gym.id}`}
      className="block min-w-[220px] max-w-[260px] shrink-0 rounded-xl border border-border bg-surface overflow-hidden transition-colors hover:border-accent/50"
    >
      <div className="aspect-[4/3] w-full bg-surface-light flex items-center justify-center">
        {gym.thumbnailUrl ? (
          <img
            src={gym.thumbnailUrl}
            alt={name}
            className="h-full w-full object-cover"
          />
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            className="h-10 w-10 text-muted"
            aria-hidden="true"
          >
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        )}
      </div>
      <div className="p-3 space-y-1.5">
        <p className="text-sm font-semibold text-foreground truncate">{name}</p>
        {(city || state) && (
          <p className="text-xs text-muted truncate">
            {[city, state].filter(Boolean).join(", ")}
          </p>
        )}
        <div className="flex flex-wrap gap-1">
          {styles.slice(0, 2).map((s) => (
            <span
              key={s}
              className="rounded bg-accent/20 px-1.5 py-0.5 text-[10px] font-medium text-accent-light capitalize"
            >
              {s}
            </span>
          ))}
          {level && (
            <span className="rounded bg-surface-light px-1.5 py-0.5 text-[10px] font-medium text-muted capitalize">
              {level}
            </span>
          )}
        </div>
        {sessionTime && (
          <p className="text-[10px] text-muted">{sessionTime}</p>
        )}
      </div>
    </Link>
  );
}

function formatSessionTime(date?: string, startTime?: string): string {
  if (!date) return "";
  try {
    const d = new Date(date);
    const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return startTime ? `${dateStr} · ${startTime}` : dateStr;
  } catch {
    return "";
  }
}
