"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

const BELT_RANKS = [
  "White",
  "Blue",
  "Purple",
  "Brown",
  "Black",
];

const ACHIEVEMENT_TYPES = [
  { value: "belt_rank", label: "Belt Promotion" },
  { value: "competition", label: "Competition" },
  { value: "seminar", label: "Seminar" },
  { value: "other", label: "Other" },
];

export default function ProfileSetupPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [profile, setProfile] = useState({
    displayName: "",
    beltRank: "",
    trainingHistory: "",
    profilePhoto: "",
  });
  const [achievement, setAchievement] = useState({
    type: "competition",
    title: "",
    description: "",
    date: "",
  });
  const [achievements, setAchievements] = useState<
    { id: string; type: string; title: string; description?: string; date?: string }[]
  >([]);
  const [saving, setSaving] = useState(false);
  const [addingAchievement, setAddingAchievement] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Load existing profile data
  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id) return;
    fetch(`/api/members/${session.user.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setProfile({
            displayName: data.displayName || "",
            beltRank: data.beltRank || "",
            trainingHistory: data.trainingHistory || "",
            profilePhoto: data.profilePhoto || "",
          });
          if (data.achievements) setAchievements(data.achievements);
        }
      })
      .catch(() => {});
  }, [session?.user?.id, status]);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.user?.id) return;
    setError("");
    setSuccess("");
    setSaving(true);

    try {
      const res = await fetch(`/api/members/${session.user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.fields?.displayName || "Failed to update profile");
      } else {
        setSuccess("Profile updated");
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddAchievement(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.user?.id) return;
    if (!achievement.title.trim()) return;
    setAddingAchievement(true);

    try {
      const res = await fetch(`/api/members/${session.user.id}/achievements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...achievement,
          date: achievement.date || undefined,
        }),
      });

      if (res.ok) {
        const created = await res.json();
        setAchievements((prev) => [created, ...prev]);
        setAchievement({ type: "competition", title: "", description: "", date: "" });
      }
    } catch {
      // silently fail
    } finally {
      setAddingAchievement(false);
    }
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setProfile((prev) => ({ ...prev, profilePhoto: reader.result as string }));
    };
    reader.readAsDataURL(file);
  }

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Set Up Your Profile</h1>
        <p className="mt-1 text-sm text-muted">Tell the community about your BJJ journey</p>
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

      <form onSubmit={handleSaveProfile} className="space-y-4">
        {/* Photo Upload */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Profile Photo</label>
          <div className="flex items-center gap-4">
            {profile.profilePhoto ? (
              <img
                src={profile.profilePhoto}
                alt="Profile preview"
                className="h-16 w-16 rounded-full object-cover border border-border"
              />
            ) : (
              <div className="h-16 w-16 rounded-full bg-surface-light border border-border flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-6 w-6 text-muted" aria-hidden="true">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className="text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-surface-light file:px-3 file:py-1.5 file:text-sm file:text-foreground hover:file:bg-accent/20"
            />
          </div>
        </div>

        {/* Display Name */}
        <div>
          <label htmlFor="displayName" className="block text-sm font-medium text-foreground mb-1">
            Display Name
          </label>
          <input
            id="displayName"
            type="text"
            value={profile.displayName}
            onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>

        {/* Belt Rank */}
        <div>
          <label htmlFor="beltRank" className="block text-sm font-medium text-foreground mb-1">
            Belt Rank
          </label>
          <select
            id="beltRank"
            value={profile.beltRank}
            onChange={(e) => setProfile({ ...profile, beltRank: e.target.value })}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="">Select belt rank</option>
            {BELT_RANKS.map((belt) => (
              <option key={belt} value={belt}>{belt}</option>
            ))}
          </select>
        </div>

        {/* Training History */}
        <div>
          <label htmlFor="trainingHistory" className="block text-sm font-medium text-foreground mb-1">
            Training History
          </label>
          <textarea
            id="trainingHistory"
            rows={4}
            value={profile.trainingHistory}
            onChange={(e) => setProfile({ ...profile, trainingHistory: e.target.value })}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-none"
            placeholder="Years training, gyms visited, styles practiced…"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-dark disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Saving…" : "Save Profile"}
        </button>
      </form>

      {/* Achievements Section */}
      <div className="border-t border-border pt-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Achievements</h2>

        {achievements.length > 0 && (
          <ul className="space-y-2 mb-4">
            {achievements.map((a) => (
              <li key={a.id} className="rounded-lg bg-surface p-3 border border-border">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-accent/20 px-2 py-0.5 text-xs text-accent-light capitalize">
                    {a.type.replace("_", " ")}
                  </span>
                  <span className="font-medium text-foreground text-sm">{a.title}</span>
                </div>
                {a.description && <p className="mt-1 text-sm text-muted">{a.description}</p>}
                {a.date && (
                  <p className="mt-1 text-xs text-muted">
                    {new Date(a.date).toLocaleDateString()}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={handleAddAchievement} className="space-y-3 rounded-lg bg-surface-light p-4 border border-border">
          <p className="text-sm font-medium text-foreground">Add Achievement</p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="achType" className="block text-xs text-muted mb-1">Type</label>
              <select
                id="achType"
                value={achievement.type}
                onChange={(e) => setAchievement({ ...achievement, type: e.target.value })}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              >
                {ACHIEVEMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="achDate" className="block text-xs text-muted mb-1">Date</label>
              <input
                id="achDate"
                type="date"
                value={achievement.date}
                onChange={(e) => setAchievement({ ...achievement, date: e.target.value })}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
          </div>

          <div>
            <label htmlFor="achTitle" className="block text-xs text-muted mb-1">Title</label>
            <input
              id="achTitle"
              type="text"
              value={achievement.title}
              onChange={(e) => setAchievement({ ...achievement, title: e.target.value })}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              placeholder="e.g. Gold at IBJJF Worlds"
            />
          </div>

          <div>
            <label htmlFor="achDesc" className="block text-xs text-muted mb-1">Description (optional)</label>
            <input
              id="achDesc"
              type="text"
              value={achievement.description}
              onChange={(e) => setAchievement({ ...achievement, description: e.target.value })}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              placeholder="Brief description"
            />
          </div>

          <button
            type="submit"
            disabled={addingAchievement || !achievement.title.trim()}
            className="rounded-lg bg-surface border border-accent px-4 py-2 text-sm text-accent-light transition-colors hover:bg-accent/10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {addingAchievement ? "Adding…" : "Add Achievement"}
          </button>
        </form>
      </div>

      <div className="pt-2">
        <button
          type="button"
          onClick={() => router.push("/profile")}
          className="w-full rounded-lg border border-border py-2.5 text-sm text-muted transition-colors hover:text-foreground hover:border-accent"
        >
          View Profile
        </button>
      </div>
    </div>
  );
}
