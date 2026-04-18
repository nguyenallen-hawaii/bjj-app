"use client";

export default function WelcomeBanner({ displayName }: { displayName: string }) {
  return (
    <div className="px-4 pt-6 pb-2">
      <h1 className="text-2xl font-bold text-foreground">
        Welcome, {displayName}
      </h1>
      <p className="mt-1 text-sm text-muted">Find your next roll</p>
    </div>
  );
}
