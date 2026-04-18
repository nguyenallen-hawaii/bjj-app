"use client";

export interface CoachCardData {
  id: string;
  name: string;
  credentials: string;
  beltRank: string;
  pricePerSession: number;
  gym?: { id: string; name: string; city?: string; state?: string };
  gymId?: string;
}

export default function CoachCard({ coach }: { coach: CoachCardData }) {
  const gymName = coach.gym?.name || "Independent";
  const price = (coach.pricePerSession / 100).toFixed(2);

  return (
    <div className="min-w-[200px] max-w-[240px] shrink-0 rounded-xl border border-border bg-surface p-3 space-y-2 transition-colors hover:border-accent/50 cursor-pointer">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/20 text-accent-light text-sm font-bold">
          {coach.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground truncate">{coach.name}</p>
          <p className="text-[10px] text-accent-light">{coach.credentials}</p>
        </div>
      </div>
      <p className="text-xs text-muted truncate">{gymName}</p>
      <p className="text-sm font-semibold text-accent-light">${price}<span className="text-[10px] text-muted font-normal">/session</span></p>
    </div>
  );
}
