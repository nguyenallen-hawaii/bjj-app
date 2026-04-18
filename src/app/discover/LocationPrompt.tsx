"use client";

import { useState } from "react";
import { VALID_US_STATES } from "@/lib/us-states";

const statesList = Array.from(VALID_US_STATES).sort();

interface LocationPromptProps {
  onLocationSet: (lat: number, lng: number) => void;
}

// Rough center coordinates for US states (subset for demo)
const STATE_COORDS: Record<string, [number, number]> = {
  AL: [32.8, -86.8], AK: [64.2, -152.5], AZ: [34.0, -111.1], AR: [35.2, -91.8],
  CA: [36.8, -119.4], CO: [39.1, -105.4], CT: [41.6, -72.7], DE: [39.0, -75.5],
  FL: [27.8, -81.7], GA: [32.2, -83.4], HI: [19.9, -155.6], ID: [44.1, -114.7],
  IL: [40.3, -89.0], IN: [40.3, -86.1], IA: [42.0, -93.2], KS: [38.5, -98.8],
  KY: [37.8, -84.3], LA: [30.4, -91.9], ME: [45.3, -69.4], MD: [39.0, -76.6],
  MA: [42.4, -71.4], MI: [44.3, -85.6], MN: [46.7, -94.7], MS: [32.3, -89.4],
  MO: [38.6, -92.6], MT: [46.8, -110.4], NE: [41.1, -98.3], NV: [38.8, -116.4],
  NH: [43.2, -71.6], NJ: [40.1, -74.5], NM: [34.5, -105.9], NY: [43.0, -75.0],
  NC: [35.6, -79.0], ND: [47.5, -100.5], OH: [40.4, -82.9], OK: [35.0, -97.1],
  OR: [43.8, -120.6], PA: [41.2, -77.2], RI: [41.6, -71.5], SC: [33.8, -81.2],
  SD: [43.9, -99.4], TN: [35.5, -86.6], TX: [31.0, -97.6], UT: [39.3, -111.1],
  VT: [44.6, -72.6], VA: [37.8, -78.2], WA: [47.8, -120.7], WV: [38.6, -80.6],
  WI: [43.8, -88.8], WY: [43.1, -107.6], DC: [38.9, -77.0],
};

export default function LocationPrompt({ onLocationSet }: LocationPromptProps) {
  const [selectedState, setSelectedState] = useState("");

  function handleSubmit() {
    if (!selectedState) return;
    const coords = STATE_COORDS[selectedState];
    if (coords) {
      onLocationSet(coords[0], coords[1]);
    }
  }

  return (
    <div className="mx-4 rounded-xl border border-border bg-surface p-4 space-y-3">
      <p className="text-sm text-foreground font-medium">
        Enable location for nearby results, or select a state:
      </p>
      <div className="flex gap-2">
        <select
          value={selectedState}
          onChange={(e) => setSelectedState(e.target.value)}
          className="flex-1 rounded-lg border border-border bg-surface-light px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
          aria-label="Select US state"
        >
          <option value="">Select a state</option>
          {statesList.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button
          onClick={handleSubmit}
          disabled={!selectedState}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50 transition-opacity"
        >
          Go
        </button>
      </div>
    </div>
  );
}
