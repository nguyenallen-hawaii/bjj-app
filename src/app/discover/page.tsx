"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import WelcomeBanner from "./WelcomeBanner";
import SearchBar from "./SearchBar";
import OpenMatsNearby from "./OpenMatsNearby";
import TodaysPicks from "./TodaysPicks";
import PrivateCoaching from "./PrivateCoaching";
import LocationPrompt from "./LocationPrompt";

export default function DiscoverPage() {
  const { data: session } = useSession();
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const [locationLoading, setLocationLoading] = useState(true);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationDenied(true);
      setLocationLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setLocationLoading(false);
      },
      () => {
        setLocationDenied(true);
        setLocationLoading(false);
      },
      { timeout: 10000 }
    );
  }, []);

  function handleManualLocation(newLat: number, newLng: number) {
    setLat(newLat);
    setLng(newLng);
    setLocationDenied(false);
  }

  const displayName = session?.user?.name || "Practitioner";

  return (
    <div className="space-y-6 pb-8">
      <WelcomeBanner displayName={displayName} />
      <SearchBar />

      {locationLoading && (
        <div className="flex items-center justify-center py-4">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-accent" />
          <span className="ml-2 text-sm text-muted">Getting your location…</span>
        </div>
      )}

      {!locationLoading && locationDenied && (
        <LocationPrompt onLocationSet={handleManualLocation} />
      )}

      <OpenMatsNearby lat={lat} lng={lng} />
      <TodaysPicks />
      <PrivateCoaching />
    </div>
  );
}
