"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

interface CoachDetail {
  id: string;
  gymId: string;
  name: string;
  credentials: string;
  beltRank: string;
  pricePerSession: number;
  gym?: { id: string; name: string; city?: string; state?: string };
}

interface TimeSlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  isBooked: boolean;
}

interface SlotsResponse {
  slots: TimeSlot[];
  alternativeDates?: string[];
  message?: string;
}

type BookingStep = "select_date" | "select_slot" | "confirm" | "done";

export default function CoachDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: session } = useSession();

  const [coach, setCoach] = useState<CoachDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Booking flow state
  const [step, setStep] = useState<BookingStep>("select_date");
  const [selectedDate, setSelectedDate] = useState("");
  const [slotsData, setSlotsData] = useState<SlotsResponse | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [bookingResult, setBookingResult] = useState<{
    id: string;
    sessionDate: string;
    sessionStartTime: string;
  } | null>(null);

  // Fetch coach info
  useEffect(() => {
    fetch(`/api/coaches?search=`)
      .then((res) => (res.ok ? res.json() : []))
      .then((coaches: CoachDetail[]) => {
        const found = coaches.find((c) => c.id === id);
        if (found) {
          setCoach(found);
        } else {
          setError("Coach not found");
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load coach");
        setLoading(false);
      });
  }, [id]);

  // Fetch available slots when date changes
  const fetchSlots = useCallback(
    async (date: string) => {
      setSlotsLoading(true);
      setSlotsData(null);
      setSelectedSlot(null);
      setBookingError("");
      try {
        const res = await fetch(`/api/coaches/${id}/slots?date=${date}`);
        if (!res.ok) throw new Error("Failed to fetch slots");
        const data: SlotsResponse = await res.json();
        setSlotsData(data);
      } catch {
        setSlotsData({ slots: [] });
      } finally {
        setSlotsLoading(false);
      }
    },
    [id]
  );

  function handleDateChange(date: string) {
    setSelectedDate(date);
    setStep("select_slot");
    fetchSlots(date);
  }

  function handleSlotSelect(slot: TimeSlot) {
    setSelectedSlot(slot);
    setStep("confirm");
  }

  async function handleConfirmBooking() {
    if (!selectedSlot || !session) return;
    setBookingLoading(true);
    setBookingError("");
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "private_session",
          referenceId: selectedSlot.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg =
          data.error === "capacity_full"
            ? "This time slot is already booked"
            : data.error === "scheduling_conflict"
            ? "You have a scheduling conflict at this time"
            : data.message || "Booking failed";
        setBookingError(msg);
        setBookingLoading(false);
        return;
      }
      setBookingResult(data);
      setStep("done");
    } catch {
      setBookingError("Network error. Please try again.");
    } finally {
      setBookingLoading(false);
    }
  }

  function handleAlternativeDate(dateStr: string) {
    const d = new Date(dateStr);
    const formatted = d.toISOString().split("T")[0];
    setSelectedDate(formatted);
    setStep("select_slot");
    fetchSlots(formatted);
  }

  function resetBooking() {
    setStep("select_date");
    setSelectedDate("");
    setSlotsData(null);
    setSelectedSlot(null);
    setBookingError("");
    setBookingResult(null);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted">Loading…</p>
      </div>
    );
  }

  if (error || !coach) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center">
          <p className="text-muted">{error || "Coach not found"}</p>
          <Link
            href="/discover"
            className="mt-4 inline-block text-sm text-accent-light hover:underline"
          >
            Back to Discover
          </Link>
        </div>
      </div>
    );
  }

  const price = (coach.pricePerSession / 100).toFixed(2);
  const gymName = coach.gym?.name || "Independent";
  const gymLocation =
    coach.gym?.city && coach.gym?.state
      ? `${coach.gym.city}, ${coach.gym.state}`
      : "";

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 space-y-6">
      {/* Coach Header */}
      <div className="rounded-lg bg-surface p-4 border border-border space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/20 text-accent-light text-xl font-bold">
            {coach.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">{coach.name}</h1>
            <p className="text-sm text-accent-light">{coach.credentials}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded bg-accent/20 px-2.5 py-1 text-xs font-medium text-accent-light">
            {coach.beltRank}
          </span>
          <span className="text-sm font-semibold text-foreground">
            ${price}
            <span className="text-xs text-muted font-normal">/session</span>
          </span>
        </div>
        {coach.gym && (
          <div className="text-sm text-muted">
            <Link
              href={`/gyms/${coach.gymId}`}
              className="text-accent-light hover:underline"
            >
              {gymName}
            </Link>
            {gymLocation && <span> · {gymLocation}</span>}
          </div>
        )}
      </div>

      {/* Booking Flow */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-foreground">Book a Private Session</h2>

        {!session && (
          <div className="rounded-lg bg-surface p-4 border border-border text-center">
            <p className="text-sm text-muted">
              <Link href="/login" className="text-accent-light hover:underline">
                Sign in
              </Link>{" "}
              to book a private session.
            </p>
          </div>
        )}

        {session && step !== "done" && (
          <>
            {/* Step 1: Select Date */}
            <div className="rounded-lg bg-surface p-4 border border-border space-y-3">
              <div className="flex items-center gap-2">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                    step === "select_date"
                      ? "bg-accent text-white"
                      : "bg-accent/20 text-accent-light"
                  }`}
                >
                  1
                </span>
                <h3 className="text-sm font-semibold text-foreground">
                  Select a Date
                </h3>
              </div>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                className="w-full rounded-lg border border-border bg-surface-light px-3 py-2 text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                aria-label="Select date for private session"
              />
            </div>

            {/* Step 2: Select Slot */}
            {(step === "select_slot" || step === "confirm") && selectedDate && (
              <div className="rounded-lg bg-surface p-4 border border-border space-y-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                      step === "select_slot"
                        ? "bg-accent text-white"
                        : "bg-accent/20 text-accent-light"
                    }`}
                  >
                    2
                  </span>
                  <h3 className="text-sm font-semibold text-foreground">
                    Select a Time Slot
                  </h3>
                </div>

                {slotsLoading ? (
                  <p className="text-sm text-muted text-center py-2">
                    Loading available slots…
                  </p>
                ) : slotsData && slotsData.slots.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {slotsData.slots.map((slot) => (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() => handleSlotSelect(slot)}
                        disabled={slot.isBooked}
                        className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                          selectedSlot?.id === slot.id
                            ? "border-accent bg-accent/20 text-accent-light"
                            : slot.isBooked
                            ? "border-border bg-surface-light text-muted opacity-50 cursor-not-allowed"
                            : "border-border bg-surface-light text-foreground hover:border-accent"
                        }`}
                        aria-label={
                          slot.isBooked
                            ? `${slot.startTime}–${slot.endTime} unavailable`
                            : `Select ${slot.startTime}–${slot.endTime}`
                        }
                        aria-pressed={selectedSlot?.id === slot.id}
                      >
                        {slot.startTime}–{slot.endTime}
                        {slot.isBooked && (
                          <span className="block text-[10px] text-red-400">
                            Booked
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                ) : slotsData ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted">
                      {slotsData.message ||
                        "No available slots on this date."}
                    </p>
                    {slotsData.alternativeDates &&
                      slotsData.alternativeDates.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs text-muted">
                            Try one of these dates:
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {slotsData.alternativeDates.map((d) => (
                              <button
                                key={d}
                                type="button"
                                onClick={() => handleAlternativeDate(d)}
                                className="rounded-lg border border-accent/50 bg-accent/10 px-3 py-1.5 text-xs text-accent-light hover:bg-accent/20 transition-colors"
                              >
                                {new Date(d).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>
                ) : null}
              </div>
            )}

            {/* Step 3: Confirm */}
            {step === "confirm" && selectedSlot && (
              <div className="rounded-lg bg-surface p-4 border border-border space-y-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-white text-xs font-bold">
                    3
                  </span>
                  <h3 className="text-sm font-semibold text-foreground">
                    Confirm Booking
                  </h3>
                </div>
                <div className="rounded-lg bg-surface-light p-3 border border-border space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted">Coach</span>
                    <span className="text-foreground font-medium">
                      {coach.name}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted">Date</span>
                    <span className="text-foreground">
                      {new Date(selectedDate + "T00:00:00").toLocaleDateString(
                        "en-US",
                        {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        }
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted">Time</span>
                    <span className="text-foreground">
                      {selectedSlot.startTime}–{selectedSlot.endTime}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted">Location</span>
                    <span className="text-foreground">
                      {gymName}
                      {gymLocation ? `, ${gymLocation}` : ""}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted">Price</span>
                    <span className="text-foreground font-semibold">
                      ${price}
                    </span>
                  </div>
                </div>

                {bookingError && (
                  <p className="text-sm text-red-400">{bookingError}</p>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleConfirmBooking}
                    disabled={bookingLoading}
                    className="flex-1 rounded-lg bg-accent py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-dark disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {bookingLoading ? "Booking…" : "Confirm Booking"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSlot(null);
                      setStep("select_slot");
                      setBookingError("");
                    }}
                    className="rounded-lg border border-border px-4 py-2.5 text-sm text-muted hover:text-foreground hover:border-accent transition-colors"
                  >
                    Back
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Booking Confirmation */}
        {step === "done" && bookingResult && (
          <div className="rounded-lg bg-surface p-5 border border-accent/50 space-y-4 text-center">
            <div className="flex justify-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-green-900/30 text-green-300 text-2xl">
                ✓
              </span>
            </div>
            <h3 className="text-lg font-bold text-foreground">
              Booking Confirmed!
            </h3>
            <div className="rounded-lg bg-surface-light p-3 border border-border space-y-2 text-left">
              <div className="flex justify-between text-sm">
                <span className="text-muted">Coach</span>
                <span className="text-foreground font-medium">
                  {coach.name}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted">Date</span>
                <span className="text-foreground">
                  {new Date(
                    bookingResult.sessionDate
                  ).toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted">Time</span>
                <span className="text-foreground">
                  {bookingResult.sessionStartTime}–
                  {selectedSlot?.endTime || ""}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted">Location</span>
                <span className="text-foreground">
                  {gymName}
                  {gymLocation ? `, ${gymLocation}` : ""}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted">Price</span>
                <span className="text-foreground font-semibold">
                  ${price}
                </span>
              </div>
            </div>
            <div className="flex gap-3 justify-center">
              <Link
                href="/bookings"
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-dark"
              >
                View My Bookings
              </Link>
              <button
                type="button"
                onClick={resetBooking}
                className="rounded-lg border border-border px-4 py-2 text-sm text-muted hover:text-foreground hover:border-accent transition-colors"
              >
                Book Another
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
