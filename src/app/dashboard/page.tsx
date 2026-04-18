"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { VALID_US_STATES } from "@/lib/us-states";

const TRAINING_STYLES = [
  { value: "gi", label: "Gi" },
  { value: "no-gi", label: "No-Gi" },
  { value: "both", label: "Both" },
  { value: "wrestling", label: "Wrestling" },
  { value: "judo", label: "Judo" },
];

const SKILL_LEVELS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
  { value: "all-levels", label: "All Levels" },
];

const DAYS_OF_WEEK = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

const US_STATES_ARRAY = Array.from(VALID_US_STATES).sort();

interface OperatingHoursEntry {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
}

interface GymListing {
  id: string;
  ownerId: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  contactEmail: string;
  contactPhone?: string;
  trainingStyles: string[];
  skillLevels: string[];
  operatingHours: OperatingHoursEntry[];
  averageRating: number;
}

interface GymClassItem {
  id: string;
  gymId: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  trainingStyle: string;
  skillLevel: string;
  capacity: number;
  bookedCount: number;
  price: number;
  status: string;
  isFull: boolean;
}

interface OpenMatItem {
  id: string;
  gymId: string;
  date: string;
  startTime: string;
  endTime: string;
  capacity: number;
  bookedCount: number;
  price: number;
  status: string;
  isFull: boolean;
}

interface CoachItem {
  id: string;
  gymId: string;
  name: string;
  credentials: string;
  beltRank: string;
  pricePerSession: number;
  timeSlots?: { id: string; date: string; startTime: string; endTime: string; isBooked: boolean }[];
}

interface TimeSlotEntry {
  date: string;
  startTime: string;
  endTime: string;
}

/* ─── Confirmation Dialog ─────────────────────────────────────────────────── */

function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="w-full max-w-sm rounded-lg bg-surface border border-border p-5 space-y-4"
      >
        <h3 id="confirm-title" className="text-lg font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-border px-4 py-2 text-sm text-muted hover:text-foreground hover:border-accent transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const [gym, setGym] = useState<GymListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Edit form state
  const [form, setForm] = useState({
    name: "", address: "", city: "", state: "", zipCode: "",
    contactEmail: "", contactPhone: "",
  });
  const [trainingStyles, setTrainingStyles] = useState<string[]>([]);
  const [skillLevels, setSkillLevels] = useState<string[]>([]);
  const [operatingHours, setOperatingHours] = useState<OperatingHoursEntry[]>([]);

  // Schedule state
  const [classes, setClasses] = useState<GymClassItem[]>([]);
  const [openMats, setOpenMats] = useState<OpenMatItem[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);

  // Class creation form
  const [showClassForm, setShowClassForm] = useState(false);
  const [classForm, setClassForm] = useState({
    title: "", date: "", startTime: "", endTime: "",
    trainingStyle: "", skillLevel: "", capacity: "", price: "",
  });
  const [classFormErrors, setClassFormErrors] = useState<Record<string, string>>({});
  const [classSubmitting, setClassSubmitting] = useState(false);

  // Open mat creation form
  const [showOpenMatForm, setShowOpenMatForm] = useState(false);
  const [openMatForm, setOpenMatForm] = useState({
    date: "", startTime: "", endTime: "", capacity: "", price: "",
  });
  const [openMatFormErrors, setOpenMatFormErrors] = useState<Record<string, string>>({});
  const [openMatSubmitting, setOpenMatSubmitting] = useState(false);

  // Confirmation dialog
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
  }>({ open: false, title: "", message: "", confirmLabel: "", onConfirm: () => {} });

  // Coaches state
  const [coaches, setCoaches] = useState<CoachItem[]>([]);
  const [coachesLoading, setCoachesLoading] = useState(false);
  const [showCoachForm, setShowCoachForm] = useState(false);
  const [coachForm, setCoachForm] = useState({
    name: "", credentials: "", beltRank: "", pricePerSession: "",
  });
  const [coachTimeSlots, setCoachTimeSlots] = useState<TimeSlotEntry[]>([]);
  const [coachFormErrors, setCoachFormErrors] = useState<Record<string, string>>({});
  const [coachSubmitting, setCoachSubmitting] = useState(false);

  const fetchSchedule = useCallback(async (gymId: string) => {
    setScheduleLoading(true);
    try {
      const [classesRes, openMatsRes] = await Promise.all([
        fetch(`/api/gyms/${gymId}/classes`),
        fetch(`/api/gyms/${gymId}/open-mats`),
      ]);
      if (classesRes.ok) setClasses(await classesRes.json());
      if (openMatsRes.ok) setOpenMats(await openMatsRes.json());
    } catch {
      // silently fail — schedule section will show empty
    } finally {
      setScheduleLoading(false);
    }
  }, []);

  const fetchCoaches = useCallback(async (gymId: string) => {
    setCoachesLoading(true);
    try {
      const res = await fetch(`/api/coaches?gymId=${gymId}`);
      if (res.ok) setCoaches(await res.json());
    } catch {
      // silently fail
    } finally {
      setCoachesLoading(false);
    }
  }, []);

  // Fetch the owner's gym
  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id) return;
    fetch("/api/gyms?ownerId=" + session.user.id)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        let g: GymListing | null = null;
        if (data && Array.isArray(data) && data.length > 0) {
          g = data[0];
        } else if (data && !Array.isArray(data) && data.id) {
          g = data;
        }
        if (g) {
          setGym(g);
          populateForm(g);
          fetchSchedule(g.id);
          fetchCoaches(g.id);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [session?.user?.id, status, fetchSchedule, fetchCoaches]);

  function populateForm(g: GymListing) {
    setForm({
      name: g.name, address: g.address, city: g.city, state: g.state,
      zipCode: g.zipCode, contactEmail: g.contactEmail, contactPhone: g.contactPhone || "",
    });
    setTrainingStyles(g.trainingStyles || []);
    setSkillLevels(g.skillLevels || []);
    setOperatingHours(g.operatingHours || []);
  }

  function toggleStyle(value: string) {
    setTrainingStyles((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]
    );
  }

  function toggleLevel(value: string) {
    setSkillLevels((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]
    );
  }

  function addHoursEntry() {
    setOperatingHours((prev) => [
      ...prev,
      { dayOfWeek: 1, openTime: "09:00", closeTime: "21:00" },
    ]);
  }

  function updateHoursEntry(index: number, field: keyof OperatingHoursEntry, value: string | number) {
    setOperatingHours((prev) =>
      prev.map((entry, i) => (i === index ? { ...entry, [field]: value } : entry))
    );
  }

  function removeHoursEntry(index: number) {
    setOperatingHours((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!gym) return;
    setError(""); setSuccess(""); setFieldErrors({}); setSaving(true);
    try {
      const res = await fetch(`/api/gyms/${gym.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, trainingStyles, skillLevels, operatingHours }),
      });
      if (!res.ok) {
        const data = await res.json();
        if (data.fields) setFieldErrors(data.fields);
        else setError(data.message || "Failed to update gym listing.");
        setSaving(false);
        return;
      }
      const updated = await res.json();
      setGym(updated); setSuccess("Gym listing updated"); setEditing(false);
    } catch {
      setError("Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  /* ─── Class creation ──────────────────────────────────────────────────── */

  async function handleCreateClass(e: React.FormEvent) {
    e.preventDefault();
    if (!gym) return;
    setClassFormErrors({});
    setClassSubmitting(true);
    setError(""); setSuccess("");
    try {
      const res = await fetch(`/api/gyms/${gym.id}/classes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: classForm.title,
          date: classForm.date,
          startTime: classForm.startTime,
          endTime: classForm.endTime,
          trainingStyle: classForm.trainingStyle,
          skillLevel: classForm.skillLevel,
          capacity: Number(classForm.capacity),
          price: Number(classForm.price),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        if (data.fields) setClassFormErrors(data.fields);
        else setError(data.message || "Failed to create class.");
        return;
      }
      setSuccess("Class created");
      setShowClassForm(false);
      setClassForm({ title: "", date: "", startTime: "", endTime: "", trainingStyle: "", skillLevel: "", capacity: "", price: "" });
      fetchSchedule(gym.id);
    } catch {
      setError("Something went wrong.");
    } finally {
      setClassSubmitting(false);
    }
  }

  /* ─── Open mat creation ───────────────────────────────────────────────── */

  async function handleCreateOpenMat(e: React.FormEvent) {
    e.preventDefault();
    if (!gym) return;
    setOpenMatFormErrors({});
    setOpenMatSubmitting(true);
    setError(""); setSuccess("");
    try {
      const res = await fetch(`/api/gyms/${gym.id}/open-mats`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: openMatForm.date,
          startTime: openMatForm.startTime,
          endTime: openMatForm.endTime,
          capacity: Number(openMatForm.capacity),
          price: Number(openMatForm.price),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        if (data.fields) setOpenMatFormErrors(data.fields);
        else setError(data.message || "Failed to create open mat.");
        return;
      }
      setSuccess("Open mat created");
      setShowOpenMatForm(false);
      setOpenMatForm({ date: "", startTime: "", endTime: "", capacity: "", price: "" });
      fetchSchedule(gym.id);
    } catch {
      setError("Something went wrong.");
    } finally {
      setOpenMatSubmitting(false);
    }
  }

  /* ─── Coach creation ────────────────────────────────────────────────── */

  function addCoachTimeSlot() {
    setCoachTimeSlots((prev) => [...prev, { date: "", startTime: "", endTime: "" }]);
  }

  function updateCoachTimeSlot(index: number, field: keyof TimeSlotEntry, value: string) {
    setCoachTimeSlots((prev) =>
      prev.map((entry, i) => (i === index ? { ...entry, [field]: value } : entry))
    );
  }

  function removeCoachTimeSlot(index: number) {
    setCoachTimeSlots((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleCreateCoach(e: React.FormEvent) {
    e.preventDefault();
    if (!gym) return;
    setCoachFormErrors({});
    setCoachSubmitting(true);
    setError(""); setSuccess("");
    try {
      const res = await fetch(`/api/gyms/${gym.id}/coaches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: coachForm.name,
          credentials: coachForm.credentials,
          beltRank: coachForm.beltRank,
          pricePerSession: Number(coachForm.pricePerSession),
          timeSlots: coachTimeSlots.filter((s) => s.date && s.startTime && s.endTime),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        if (data.fields) setCoachFormErrors(data.fields);
        else setError(data.message || "Failed to add coach.");
        return;
      }
      setSuccess("Coach added");
      setShowCoachForm(false);
      setCoachForm({ name: "", credentials: "", beltRank: "", pricePerSession: "" });
      setCoachTimeSlots([]);
      fetchCoaches(gym.id);
    } catch {
      setError("Something went wrong.");
    } finally {
      setCoachSubmitting(false);
    }
  }

  /* ─── Cancel class ────────────────────────────────────────────────────── */

  function promptCancelClass(cls: GymClassItem) {
    setConfirmDialog({
      open: true,
      title: "Cancel Class",
      message: `Are you sure you want to cancel "${cls.title}"? All booked members will be notified.`,
      confirmLabel: "Cancel Class",
      onConfirm: async () => {
        setConfirmDialog((d) => ({ ...d, open: false }));
        setError(""); setSuccess("");
        try {
          const res = await fetch(`/api/classes/${cls.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "cancelled" }),
          });
          if (!res.ok) {
            const data = await res.json();
            setError(data.message || "Failed to cancel class.");
            return;
          }
          setSuccess("Class cancelled");
          if (gym) fetchSchedule(gym.id);
        } catch {
          setError("Something went wrong.");
        }
      },
    });
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function formatPrice(cents: number) {
    return cents === 0 ? "Free" : `$${(cents / 100).toFixed(2)}`;
  }

  /* ─── Loading / empty states ──────────────────────────────────────────── */

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted">Loading…</p>
      </div>
    );
  }

  if (!gym) {
    return (
      <div className="mx-auto max-w-lg px-4 py-6 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">Gym Dashboard</h1>
          <p className="mt-2 text-sm text-muted">You haven&apos;t registered a gym yet.</p>
          <Link
            href="/gyms/new"
            className="mt-4 inline-block rounded-lg bg-accent px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-dark"
          >
            Register Your Gym
          </Link>
        </div>
      </div>
    );
  }

  const inputClass =
    "w-full rounded-lg border border-border bg-surface px-3 py-2 text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";
  const labelClass = "block text-sm font-medium text-foreground mb-1";
  const errorMsgClass = "mt-1 text-sm text-red-400";

  const activeClasses = classes.filter((c) => c.status === "active");
  const cancelledClasses = classes.filter((c) => c.status === "cancelled");
  const activeOpenMats = openMats.filter((om) => om.status === "active");
  const cancelledOpenMats = openMats.filter((om) => om.status === "cancelled");

  return (
    <div className="mx-auto max-w-lg px-4 py-6 space-y-6">
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel={confirmDialog.confirmLabel}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog((d) => ({ ...d, open: false }))}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gym Dashboard</h1>
          <p className="mt-1 text-sm text-muted">Manage your gym listing</p>
        </div>
        <Link
          href={`/gyms/${gym.id}`}
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:text-foreground hover:border-accent transition-colors"
        >
          View Public Page
        </Link>
      </div>

      {error && (
        <div role="alert" className="rounded-lg bg-red-900/30 border border-red-700 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}
      {success && (
        <div role="status" className="rounded-lg bg-green-900/30 border border-green-700 px-4 py-3 text-sm text-green-300">
          {success}
        </div>
      )}

      {/* ─── Gym Info Section ─────────────────────────────────────────────── */}
      {!editing ? (
        <div className="space-y-4">
          <div className="rounded-lg bg-surface p-4 border border-border space-y-3">
            <div>
              <p className="text-xs text-muted">Gym Name</p>
              <p className="text-foreground font-medium">{gym.name}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Address</p>
              <p className="text-foreground text-sm">{gym.address}, {gym.city}, {gym.state} {gym.zipCode}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Contact</p>
              <p className="text-foreground text-sm">{gym.contactEmail}{gym.contactPhone ? ` · ${gym.contactPhone}` : ""}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Training Styles</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {gym.trainingStyles.map((s) => (
                  <span key={s} className="rounded bg-accent/20 px-2 py-0.5 text-xs text-accent-light capitalize">{s}</span>
                ))}
              </div>
            </div>
            {gym.skillLevels.length > 0 && (
              <div>
                <p className="text-xs text-muted">Skill Levels</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {gym.skillLevels.map((l) => (
                    <span key={l} className="rounded bg-surface-light px-2 py-0.5 text-xs text-muted capitalize">{l}</span>
                  ))}
                </div>
              </div>
            )}
            {gym.operatingHours.length > 0 && (
              <div>
                <p className="text-xs text-muted">Operating Hours</p>
                <ul className="mt-1 space-y-0.5">
                  {gym.operatingHours.map((h, i) => (
                    <li key={i} className="text-sm text-foreground">
                      {DAYS_OF_WEEK[h.dayOfWeek]}: {h.openTime} – {h.closeTime}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {gym.averageRating > 0 && (
              <div>
                <p className="text-xs text-muted">Average Rating</p>
                <p className="text-foreground text-sm">{gym.averageRating.toFixed(1)} / 5</p>
              </div>
            )}
          </div>
          <button type="button" onClick={() => setEditing(true)}
            className="w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-dark">
            Edit Listing
          </button>
        </div>
      ) : (
        /* Edit Mode */
        <form onSubmit={handleSave} className="space-y-5">
          <div>
            <label htmlFor="dash-name" className={labelClass}>Gym Name</label>
            <input id="dash-name" type="text" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={inputClass} aria-invalid={!!fieldErrors.name} />
            {fieldErrors.name && <p className={errorMsgClass}>{fieldErrors.name}</p>}
          </div>
          <div>
            <label htmlFor="dash-address" className={labelClass}>Street Address</label>
            <input id="dash-address" type="text" value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className={inputClass} aria-invalid={!!fieldErrors.address} />
            {fieldErrors.address && <p className={errorMsgClass}>{fieldErrors.address}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label htmlFor="dash-city" className={labelClass}>City</label>
              <input id="dash-city" type="text" value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className={inputClass} aria-invalid={!!fieldErrors.city} />
              {fieldErrors.city && <p className={errorMsgClass}>{fieldErrors.city}</p>}
            </div>
            <div>
              <label htmlFor="dash-state" className={labelClass}>State</label>
              <select id="dash-state" value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
                className={inputClass} aria-invalid={!!fieldErrors.state}>
                <option value="">Select state</option>
                {US_STATES_ARRAY.map((s) => (<option key={s} value={s}>{s}</option>))}
              </select>
              {fieldErrors.state && <p className={errorMsgClass}>{fieldErrors.state}</p>}
            </div>
            <div>
              <label htmlFor="dash-zip" className={labelClass}>Zip Code</label>
              <input id="dash-zip" type="text" value={form.zipCode}
                onChange={(e) => setForm({ ...form, zipCode: e.target.value })}
                className={inputClass} aria-invalid={!!fieldErrors.zipCode} />
              {fieldErrors.zipCode && <p className={errorMsgClass}>{fieldErrors.zipCode}</p>}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="dash-email" className={labelClass}>Contact Email</label>
              <input id="dash-email" type="email" value={form.contactEmail}
                onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                className={inputClass} aria-invalid={!!fieldErrors.contactEmail} />
              {fieldErrors.contactEmail && <p className={errorMsgClass}>{fieldErrors.contactEmail}</p>}
            </div>
            <div>
              <label htmlFor="dash-phone" className={labelClass}>Phone (optional)</label>
              <input id="dash-phone" type="tel" value={form.contactPhone}
                onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                className={inputClass} />
            </div>
          </div>
          <fieldset>
            <legend className={labelClass}>Training Styles</legend>
            <div className="flex flex-wrap gap-2 mt-1">
              {TRAINING_STYLES.map((style) => (
                <button key={style.value} type="button" onClick={() => toggleStyle(style.value)}
                  className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                    trainingStyles.includes(style.value)
                      ? "border-accent bg-accent/20 text-accent-light"
                      : "border-border bg-surface text-muted hover:border-accent/50"
                  }`} aria-pressed={trainingStyles.includes(style.value)}>
                  {style.label}
                </button>
              ))}
            </div>
            {fieldErrors.trainingStyles && <p className={errorMsgClass}>{fieldErrors.trainingStyles}</p>}
          </fieldset>
          <fieldset>
            <legend className={labelClass}>Skill Levels</legend>
            <div className="flex flex-wrap gap-2 mt-1">
              {SKILL_LEVELS.map((level) => (
                <button key={level.value} type="button" onClick={() => toggleLevel(level.value)}
                  className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                    skillLevels.includes(level.value)
                      ? "border-accent bg-accent/20 text-accent-light"
                      : "border-border bg-surface text-muted hover:border-accent/50"
                  }`} aria-pressed={skillLevels.includes(level.value)}>
                  {level.label}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className={labelClass}>Operating Hours</legend>
            <div className="space-y-2 mt-1">
              {operatingHours.map((entry, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg bg-surface-light p-2 border border-border">
                  <select value={entry.dayOfWeek}
                    onChange={(e) => updateHoursEntry(i, "dayOfWeek", parseInt(e.target.value))}
                    className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground focus:border-accent focus:outline-none"
                    aria-label="Day of week">
                    {DAYS_OF_WEEK.map((day, idx) => (<option key={idx} value={idx}>{day}</option>))}
                  </select>
                  <input type="time" value={entry.openTime}
                    onChange={(e) => updateHoursEntry(i, "openTime", e.target.value)}
                    className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground focus:border-accent focus:outline-none"
                    aria-label="Open time" />
                  <span className="text-muted text-xs">to</span>
                  <input type="time" value={entry.closeTime}
                    onChange={(e) => updateHoursEntry(i, "closeTime", e.target.value)}
                    className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground focus:border-accent focus:outline-none"
                    aria-label="Close time" />
                  <button type="button" onClick={() => removeHoursEntry(i)}
                    className="text-red-400 hover:text-red-300 text-sm px-1" aria-label="Remove hours entry">✕</button>
                </div>
              ))}
              <button type="button" onClick={addHoursEntry}
                className="rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted hover:border-accent hover:text-accent-light transition-colors w-full">
                + Add Hours
              </button>
            </div>
            {fieldErrors.operatingHours && <p className={errorMsgClass}>{fieldErrors.operatingHours}</p>}
          </fieldset>
          <div className="flex gap-3">
            <button type="submit" disabled={saving}
              className="flex-1 rounded-lg bg-accent py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-dark disabled:opacity-50 disabled:cursor-not-allowed">
              {saving ? "Saving…" : "Save Changes"}
            </button>
            <button type="button" onClick={() => { setEditing(false); if (gym) populateForm(gym); setFieldErrors({}); setError(""); }}
              className="rounded-lg border border-border px-4 py-2.5 text-sm text-muted hover:text-foreground hover:border-accent transition-colors">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* ─── Schedule Section ─────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground">Schedule</h2>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button type="button" onClick={() => { setShowClassForm(!showClassForm); setShowOpenMatForm(false); }}
            className="flex-1 rounded-lg bg-accent py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-dark">
            {showClassForm ? "Hide Class Form" : "+ New Class"}
          </button>
          <button type="button" onClick={() => { setShowOpenMatForm(!showOpenMatForm); setShowClassForm(false); }}
            className="flex-1 rounded-lg border border-accent py-2.5 text-sm font-medium text-accent-light transition-colors hover:bg-accent/10">
            {showOpenMatForm ? "Hide Open Mat Form" : "+ New Open Mat"}
          </button>
        </div>

        {/* ─── Class Creation Form ──────────────────────────────────────── */}
        {showClassForm && (
          <form onSubmit={handleCreateClass} className="rounded-lg bg-surface border border-border p-4 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Create New Class</h3>
            <div>
              <label htmlFor="class-title" className={labelClass}>Title</label>
              <input id="class-title" type="text" placeholder="e.g. Morning Gi" value={classForm.title}
                onChange={(e) => setClassForm({ ...classForm, title: e.target.value })}
                className={inputClass} aria-invalid={!!classFormErrors.title} />
              {classFormErrors.title && <p className={errorMsgClass}>{classFormErrors.title}</p>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="class-date" className={labelClass}>Date</label>
                <input id="class-date" type="date" value={classForm.date}
                  onChange={(e) => setClassForm({ ...classForm, date: e.target.value })}
                  className={inputClass} aria-invalid={!!classFormErrors.date} />
                {classFormErrors.date && <p className={errorMsgClass}>{classFormErrors.date}</p>}
              </div>
              <div>
                <label htmlFor="class-start" className={labelClass}>Start Time</label>
                <input id="class-start" type="time" value={classForm.startTime}
                  onChange={(e) => setClassForm({ ...classForm, startTime: e.target.value })}
                  className={inputClass} aria-invalid={!!classFormErrors.startTime} />
                {classFormErrors.startTime && <p className={errorMsgClass}>{classFormErrors.startTime}</p>}
              </div>
              <div>
                <label htmlFor="class-end" className={labelClass}>End Time</label>
                <input id="class-end" type="time" value={classForm.endTime}
                  onChange={(e) => setClassForm({ ...classForm, endTime: e.target.value })}
                  className={inputClass} aria-invalid={!!classFormErrors.endTime} />
                {classFormErrors.endTime && <p className={errorMsgClass}>{classFormErrors.endTime}</p>}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="class-style" className={labelClass}>Training Style</label>
                <select id="class-style" value={classForm.trainingStyle}
                  onChange={(e) => setClassForm({ ...classForm, trainingStyle: e.target.value })}
                  className={inputClass} aria-invalid={!!classFormErrors.trainingStyle}>
                  <option value="">Select style</option>
                  {TRAINING_STYLES.map((s) => (<option key={s.value} value={s.value}>{s.label}</option>))}
                </select>
                {classFormErrors.trainingStyle && <p className={errorMsgClass}>{classFormErrors.trainingStyle}</p>}
              </div>
              <div>
                <label htmlFor="class-level" className={labelClass}>Skill Level</label>
                <select id="class-level" value={classForm.skillLevel}
                  onChange={(e) => setClassForm({ ...classForm, skillLevel: e.target.value })}
                  className={inputClass} aria-invalid={!!classFormErrors.skillLevel}>
                  <option value="">Select level</option>
                  {SKILL_LEVELS.map((l) => (<option key={l.value} value={l.value}>{l.label}</option>))}
                </select>
                {classFormErrors.skillLevel && <p className={errorMsgClass}>{classFormErrors.skillLevel}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="class-capacity" className={labelClass}>Capacity</label>
                <input id="class-capacity" type="number" min="0" placeholder="20" value={classForm.capacity}
                  onChange={(e) => setClassForm({ ...classForm, capacity: e.target.value })}
                  className={inputClass} aria-invalid={!!classFormErrors.capacity} />
                {classFormErrors.capacity && <p className={errorMsgClass}>{classFormErrors.capacity}</p>}
              </div>
              <div>
                <label htmlFor="class-price" className={labelClass}>Price (cents)</label>
                <input id="class-price" type="number" min="0" placeholder="2500" value={classForm.price}
                  onChange={(e) => setClassForm({ ...classForm, price: e.target.value })}
                  className={inputClass} aria-invalid={!!classFormErrors.price} />
                {classFormErrors.price && <p className={errorMsgClass}>{classFormErrors.price}</p>}
              </div>
            </div>
            <button type="submit" disabled={classSubmitting}
              className="w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-dark disabled:opacity-50 disabled:cursor-not-allowed">
              {classSubmitting ? "Creating…" : "Create Class"}
            </button>
          </form>
        )}

        {/* ─── Open Mat Creation Form ───────────────────────────────────── */}
        {showOpenMatForm && (
          <form onSubmit={handleCreateOpenMat} className="rounded-lg bg-surface border border-border p-4 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Create New Open Mat</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="om-date" className={labelClass}>Date</label>
                <input id="om-date" type="date" value={openMatForm.date}
                  onChange={(e) => setOpenMatForm({ ...openMatForm, date: e.target.value })}
                  className={inputClass} aria-invalid={!!openMatFormErrors.date} />
                {openMatFormErrors.date && <p className={errorMsgClass}>{openMatFormErrors.date}</p>}
              </div>
              <div>
                <label htmlFor="om-start" className={labelClass}>Start Time</label>
                <input id="om-start" type="time" value={openMatForm.startTime}
                  onChange={(e) => setOpenMatForm({ ...openMatForm, startTime: e.target.value })}
                  className={inputClass} aria-invalid={!!openMatFormErrors.startTime} />
                {openMatFormErrors.startTime && <p className={errorMsgClass}>{openMatFormErrors.startTime}</p>}
              </div>
              <div>
                <label htmlFor="om-end" className={labelClass}>End Time</label>
                <input id="om-end" type="time" value={openMatForm.endTime}
                  onChange={(e) => setOpenMatForm({ ...openMatForm, endTime: e.target.value })}
                  className={inputClass} aria-invalid={!!openMatFormErrors.endTime} />
                {openMatFormErrors.endTime && <p className={errorMsgClass}>{openMatFormErrors.endTime}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="om-capacity" className={labelClass}>Capacity</label>
                <input id="om-capacity" type="number" min="0" placeholder="30" value={openMatForm.capacity}
                  onChange={(e) => setOpenMatForm({ ...openMatForm, capacity: e.target.value })}
                  className={inputClass} aria-invalid={!!openMatFormErrors.capacity} />
                {openMatFormErrors.capacity && <p className={errorMsgClass}>{openMatFormErrors.capacity}</p>}
              </div>
              <div>
                <label htmlFor="om-price" className={labelClass}>Price (cents)</label>
                <input id="om-price" type="number" min="0" placeholder="1500" value={openMatForm.price}
                  onChange={(e) => setOpenMatForm({ ...openMatForm, price: e.target.value })}
                  className={inputClass} aria-invalid={!!openMatFormErrors.price} />
                {openMatFormErrors.price && <p className={errorMsgClass}>{openMatFormErrors.price}</p>}
              </div>
            </div>
            <button type="submit" disabled={openMatSubmitting}
              className="w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-dark disabled:opacity-50 disabled:cursor-not-allowed">
              {openMatSubmitting ? "Creating…" : "Create Open Mat"}
            </button>
          </form>
        )}

        {/* ─── Schedule Listings ─────────────────────────────────────────── */}
        {scheduleLoading ? (
          <p className="text-sm text-muted text-center py-4">Loading schedule…</p>
        ) : (
          <>
            {/* Active Classes */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Classes ({activeClasses.length})</h3>
              {activeClasses.length === 0 ? (
                <p className="text-sm text-muted">No classes scheduled yet.</p>
              ) : (
                <div className="space-y-2">
                  {activeClasses.map((cls) => (
                    <div key={cls.id} className="rounded-lg bg-surface border border-border p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-foreground font-medium text-sm truncate">{cls.title}</p>
                            {cls.isFull && (
                              <span className="shrink-0 rounded bg-red-600/20 border border-red-600/40 px-1.5 py-0.5 text-xs font-medium text-red-400">
                                Full
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted mt-0.5">
                            {formatDate(cls.date)} · {cls.startTime} – {cls.endTime}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => promptCancelClass(cls)}
                          className="shrink-0 rounded-lg border border-red-600/40 px-2.5 py-1 text-xs text-red-400 hover:bg-red-600/10 transition-colors"
                          aria-label={`Cancel class ${cls.title}`}
                        >
                          Cancel
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="rounded bg-accent/20 px-2 py-0.5 text-accent-light capitalize">{cls.trainingStyle}</span>
                        <span className="rounded bg-surface-light px-2 py-0.5 text-muted capitalize">{cls.skillLevel}</span>
                        <span className="text-muted">{cls.bookedCount}/{cls.capacity} booked</span>
                        <span className="text-muted">{formatPrice(cls.price)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Active Open Mats */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Open Mats ({activeOpenMats.length})</h3>
              {activeOpenMats.length === 0 ? (
                <p className="text-sm text-muted">No open mats scheduled yet.</p>
              ) : (
                <div className="space-y-2">
                  {activeOpenMats.map((om) => (
                    <div key={om.id} className="rounded-lg bg-surface border border-border p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-foreground font-medium text-sm">Open Mat</p>
                            {om.isFull && (
                              <span className="shrink-0 rounded bg-red-600/20 border border-red-600/40 px-1.5 py-0.5 text-xs font-medium text-red-400">
                                Full
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted mt-0.5">
                            {formatDate(om.date)} · {om.startTime} – {om.endTime}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="text-muted">{om.bookedCount}/{om.capacity} booked</span>
                        <span className="text-muted">{formatPrice(om.price)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Cancelled items (collapsed) */}
            {(cancelledClasses.length > 0 || cancelledOpenMats.length > 0) && (
              <details className="rounded-lg bg-surface-light border border-border">
                <summary className="cursor-pointer px-4 py-2 text-sm text-muted hover:text-foreground transition-colors">
                  Cancelled ({cancelledClasses.length + cancelledOpenMats.length})
                </summary>
                <div className="px-4 pb-3 space-y-2">
                  {cancelledClasses.map((cls) => (
                    <div key={cls.id} className="rounded-lg bg-surface border border-border p-3 opacity-60">
                      <p className="text-foreground text-sm line-through">{cls.title}</p>
                      <p className="text-xs text-muted">{formatDate(cls.date)} · {cls.startTime} – {cls.endTime}</p>
                    </div>
                  ))}
                  {cancelledOpenMats.map((om) => (
                    <div key={om.id} className="rounded-lg bg-surface border border-border p-3 opacity-60">
                      <p className="text-foreground text-sm line-through">Open Mat</p>
                      <p className="text-xs text-muted">{formatDate(om.date)} · {om.startTime} – {om.endTime}</p>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </>
        )}
      </div>

      {/* ─── Coaches Section ──────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground">Coaches</h2>
        </div>

        <button
          type="button"
          onClick={() => setShowCoachForm(!showCoachForm)}
          className="w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-dark"
        >
          {showCoachForm ? "Hide Coach Form" : "+ Add Coach"}
        </button>

        {showCoachForm && (
          <form onSubmit={handleCreateCoach} className="rounded-lg bg-surface border border-border p-4 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Add New Coach</h3>
            <div>
              <label htmlFor="coach-name" className={labelClass}>Name</label>
              <input id="coach-name" type="text" placeholder="Coach name" value={coachForm.name}
                onChange={(e) => setCoachForm({ ...coachForm, name: e.target.value })}
                className={inputClass} aria-invalid={!!coachFormErrors.name} />
              {coachFormErrors.name && <p className={errorMsgClass}>{coachFormErrors.name}</p>}
            </div>
            <div>
              <label htmlFor="coach-credentials" className={labelClass}>Credentials</label>
              <input id="coach-credentials" type="text" placeholder="e.g. 3rd Degree Black Belt" value={coachForm.credentials}
                onChange={(e) => setCoachForm({ ...coachForm, credentials: e.target.value })}
                className={inputClass} aria-invalid={!!coachFormErrors.credentials} />
              {coachFormErrors.credentials && <p className={errorMsgClass}>{coachFormErrors.credentials}</p>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="coach-belt" className={labelClass}>Belt Rank</label>
                <input id="coach-belt" type="text" placeholder="e.g. Black Belt" value={coachForm.beltRank}
                  onChange={(e) => setCoachForm({ ...coachForm, beltRank: e.target.value })}
                  className={inputClass} aria-invalid={!!coachFormErrors.beltRank} />
                {coachFormErrors.beltRank && <p className={errorMsgClass}>{coachFormErrors.beltRank}</p>}
              </div>
              <div>
                <label htmlFor="coach-price" className={labelClass}>Price per Session (cents)</label>
                <input id="coach-price" type="number" min="0" placeholder="5000" value={coachForm.pricePerSession}
                  onChange={(e) => setCoachForm({ ...coachForm, pricePerSession: e.target.value })}
                  className={inputClass} aria-invalid={!!coachFormErrors.pricePerSession} />
                {coachFormErrors.pricePerSession && <p className={errorMsgClass}>{coachFormErrors.pricePerSession}</p>}
              </div>
            </div>

            {/* Time Slots */}
            <fieldset>
              <legend className={labelClass}>Available Time Slots</legend>
              <div className="space-y-2 mt-1">
                {coachTimeSlots.map((slot, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg bg-surface-light p-2 border border-border">
                    <input type="date" value={slot.date}
                      onChange={(e) => updateCoachTimeSlot(i, "date", e.target.value)}
                      className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground focus:border-accent focus:outline-none flex-1"
                      aria-label="Slot date" />
                    <input type="time" value={slot.startTime}
                      onChange={(e) => updateCoachTimeSlot(i, "startTime", e.target.value)}
                      className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground focus:border-accent focus:outline-none"
                      aria-label="Slot start time" />
                    <span className="text-muted text-xs">to</span>
                    <input type="time" value={slot.endTime}
                      onChange={(e) => updateCoachTimeSlot(i, "endTime", e.target.value)}
                      className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground focus:border-accent focus:outline-none"
                      aria-label="Slot end time" />
                    <button type="button" onClick={() => removeCoachTimeSlot(i)}
                      className="text-red-400 hover:text-red-300 text-sm px-1" aria-label="Remove time slot">✕</button>
                  </div>
                ))}
                <button type="button" onClick={addCoachTimeSlot}
                  className="rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted hover:border-accent hover:text-accent-light transition-colors w-full">
                  + Add Time Slot
                </button>
              </div>
            </fieldset>

            <button type="submit" disabled={coachSubmitting}
              className="w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-dark disabled:opacity-50 disabled:cursor-not-allowed">
              {coachSubmitting ? "Adding…" : "Add Coach"}
            </button>
          </form>
        )}

        {/* Coach Listings */}
        {coachesLoading ? (
          <p className="text-sm text-muted text-center py-4">Loading coaches…</p>
        ) : coaches.length === 0 ? (
          <p className="text-sm text-muted">No coaches added yet.</p>
        ) : (
          <div className="space-y-2">
            {coaches.map((coach) => (
              <div key={coach.id} className="rounded-lg bg-surface border border-border p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-foreground font-medium text-sm">{coach.name}</p>
                    <p className="text-xs text-muted mt-0.5">{coach.credentials}</p>
                  </div>
                  <Link
                    href={`/coaches/${coach.id}`}
                    className="shrink-0 rounded-lg border border-border px-2.5 py-1 text-xs text-accent-light hover:bg-accent/10 transition-colors"
                  >
                    View
                  </Link>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded bg-accent/20 px-2 py-0.5 text-accent-light">{coach.beltRank}</span>
                  <span className="text-muted">${(coach.pricePerSession / 100).toFixed(2)}/session</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
