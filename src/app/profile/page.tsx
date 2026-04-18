"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";

interface MemberProfile {
  id: string;
  displayName: string;
  email: string;
  profilePhoto?: string | null;
  beltRank?: string | null;
  trainingHistory?: string | null;
  averageRating: number;
  createdAt: string;
  achievements: {
    id: string;
    type: string;
    title: string;
    description?: string | null;
    date?: string | null;
  }[];
}

interface MemberReview {
  id: string;
  authorId: string;
  rating: number;
  text?: string | null;
  createdAt: string;
  author: { id: string; displayName: string; profilePhoto?: string | null };
}

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [reviews, setReviews] = useState<MemberReview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id) return;
    const memberId = session.user.id;
    Promise.all([
      fetch(`/api/members/${memberId}`).then((res) => (res.ok ? res.json() : null)),
      fetch(`/api/members/${memberId}/reviews`).then((res) => (res.ok ? res.json() : [])),
    ])
      .then(([profileData, reviewsData]) => {
        setProfile(profileData);
        setReviews(reviewsData);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [session?.user?.id, status]);

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted">Loading…</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <p className="text-muted">Could not load profile.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        {profile.profilePhoto ? (
          <img
            src={profile.profilePhoto}
            alt={`${profile.displayName}'s photo`}
            className="h-20 w-20 rounded-full object-cover border-2 border-accent"
          />
        ) : (
          <div className="h-20 w-20 rounded-full bg-surface-light border-2 border-border flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-8 w-8 text-muted" aria-hidden="true">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
        )}
        <div className="flex-1">
          <h1 className="text-xl font-bold text-foreground">{profile.displayName}</h1>
          {profile.beltRank && (
            <span className="inline-block mt-1 rounded bg-accent/20 px-2 py-0.5 text-xs font-medium text-accent-light">
              {profile.beltRank} Belt
            </span>
          )}
          <p className="mt-1 text-xs text-muted">
            Member since {new Date(profile.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Training History */}
      {profile.trainingHistory && (
        <div className="rounded-lg bg-surface p-4 border border-border">
          <h2 className="text-sm font-semibold text-foreground mb-2">Training History</h2>
          <p className="text-sm text-muted whitespace-pre-wrap">{profile.trainingHistory}</p>
        </div>
      )}

      {/* Achievements */}
      {profile.achievements.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3">
            Achievements ({profile.achievements.length})
          </h2>
          <ul className="space-y-2">
            {profile.achievements.map((a) => (
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
        </div>
      )}

      {/* Reviews Received */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">
          Reviews {reviews.length > 0 && `(${reviews.length})`}
        </h2>
        {profile.averageRating > 0 && (
          <div className="flex items-center gap-2 mb-3">
            <ProfileStarRating rating={profile.averageRating} />
            <span className="text-sm text-muted">({profile.averageRating.toFixed(1)})</span>
          </div>
        )}
        {reviews.length === 0 ? (
          <p className="text-sm text-muted">No reviews yet.</p>
        ) : (
          <div className="space-y-2">
            {reviews.map((review) => (
              <div key={review.id} className="rounded-lg bg-surface p-3 border border-border">
                <div className="flex items-center gap-2 mb-1">
                  <ProfileStarRating rating={review.rating} />
                  <span className="text-sm font-medium text-foreground">
                    {review.author.displayName}
                  </span>
                  <span className="text-xs text-muted">
                    {new Date(review.createdAt).toLocaleDateString()}
                  </span>
                </div>
                {review.text && <p className="text-sm text-muted">{review.text}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="space-y-3 pt-2">
        <Link
          href="/profile/setup"
          className="block w-full rounded-lg bg-accent py-2.5 text-center text-sm font-medium text-white transition-colors hover:bg-accent-dark"
        >
          Edit Profile
        </Link>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full rounded-lg border border-border py-2.5 text-sm text-muted transition-colors hover:text-red-400 hover:border-red-700"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}


function ProfileStarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`Rating: ${rating.toFixed(1)} out of 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill={star <= Math.round(rating) ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth={2}
          className={`h-4 w-4 ${star <= Math.round(rating) ? "text-yellow-400" : "text-muted"}`}
          aria-hidden="true"
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </div>
  );
}
