"use client";

import { useState, useEffect, useCallback } from "react";

interface Booking {
  id: string;
  type: string;
  referenceId: string;
  status: string;
  sessionDate: string;
  sessionStartTime: string;
  createdAt: string;
}

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancelState, setCancelState] = useState<Record<string, { loading?: boolean; error?: string; confirming?: boolean }>>({});

  useEffect(() => {
    fetch("/api/bookings")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load bookings");
        return res.json();
      })
      .then((data) => {
        setBookings(data);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load bookings");
        setLoading(false);
      });
  }, []);

  const handleCancelClick = useCallback((id: string) => {
    setCancelState((prev) => ({ ...prev, [id]: { confirming: true } }));
  }, []);

  const handleCancelConfirm = useCallback(async (id: string) => {
    setCancelState((prev) => ({ ...prev, [id]: { loading: true } }));
    try {
      const res = await fetch(`/api/bookings/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        const msg =
          data.error === "cancellation_window_passed"
            ? "Cannot cancel less than 24 hours before the session"
            : data.message || "Cancellation failed";
        setCancelState((prev) => ({ ...prev, [id]: { error: msg } }));
        return;
      }
      setBookings((prev) => prev.filter((b) => b.id !== id));
      setCancelState((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch {
      setCancelState((prev) => ({ ...prev, [id]: { error: "Network error" } }));
    }
  }, []);

  const handleCancelDismiss = useCallback((id: string) => {
    setCancelState((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const formatType = (type: string) => {
    switch (type) {
      case "class": return "Class";
      case "open_mat": return "Open Mat";
      case "private_session": return "Private Session";
      case "event": return "Event";
      default: return type;
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted">Loading bookings…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <p className="text-muted">{error}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-2xl font-bold text-foreground">Bookings</h1>
      <p className="mt-1 text-sm text-muted">Your upcoming sessions</p>

      {bookings.length === 0 ? (
        <div className="mt-12 text-center">
          <p className="text-muted">No upcoming bookings.</p>
          <a href="/discover" className="mt-3 inline-block text-sm text-accent-light hover:underline">
            Discover gyms
          </a>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {bookings.map((booking) => {
            const cs = cancelState[booking.id];
            return (
              <div key={booking.id} className="rounded-lg bg-surface p-4 border border-border">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="rounded bg-accent/20 px-2 py-0.5 text-xs font-medium text-accent-light">
                      {formatType(booking.type)}
                    </span>
                    <p className="mt-2 text-sm text-foreground">
                      {new Date(booking.sessionDate).toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                    <p className="text-xs text-muted mt-0.5">
                      Starts at {booking.sessionStartTime}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="rounded bg-green-900/30 px-2 py-0.5 text-xs text-green-300">
                      Confirmed
                    </span>
                  </div>
                </div>

                {/* Cancel flow */}
                {cs?.confirming ? (
                  <div className="mt-3 rounded bg-surface-light p-3 border border-border">
                    <p className="text-sm text-foreground">Cancel this booking?</p>
                    <p className="text-xs text-muted mt-1">
                      Cancellations must be made at least 24 hours before the session.
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => handleCancelConfirm(booking.id)}
                        className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 transition-colors"
                      >
                        Yes, cancel
                      </button>
                      <button
                        onClick={() => handleCancelDismiss(booking.id)}
                        className="rounded bg-surface px-3 py-1 text-xs font-medium text-muted border border-border hover:text-foreground transition-colors"
                      >
                        Keep booking
                      </button>
                    </div>
                  </div>
                ) : cs?.loading ? (
                  <p className="mt-3 text-xs text-muted">Cancelling…</p>
                ) : (
                  <button
                    onClick={() => handleCancelClick(booking.id)}
                    className="mt-3 text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    Cancel booking
                  </button>
                )}
                {cs?.error && (
                  <p className="mt-2 text-xs text-red-400">{cs.error}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
