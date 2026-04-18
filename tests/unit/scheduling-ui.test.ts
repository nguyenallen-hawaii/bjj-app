import { describe, it, expect } from "vitest";

/**
 * Tests for scheduling UI helper logic used in the gym dashboard.
 * These validate the formatting and display logic for classes and open mats.
 */

// Replicate the helper functions from the dashboard component
function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatPrice(cents: number) {
  return cents === 0 ? "Free" : `$${(cents / 100).toFixed(2)}`;
}

function isSessionFull(capacity: number, bookedCount: number) {
  return capacity === bookedCount;
}

function buildClassPayload(form: {
  title: string; date: string; startTime: string; endTime: string;
  trainingStyle: string; skillLevel: string; capacity: string; price: string;
}) {
  return {
    title: form.title,
    date: form.date,
    startTime: form.startTime,
    endTime: form.endTime,
    trainingStyle: form.trainingStyle,
    skillLevel: form.skillLevel,
    capacity: Number(form.capacity),
    price: Number(form.price),
  };
}

function buildOpenMatPayload(form: {
  date: string; startTime: string; endTime: string; capacity: string; price: string;
}) {
  return {
    date: form.date,
    startTime: form.startTime,
    endTime: form.endTime,
    capacity: Number(form.capacity),
    price: Number(form.price),
  };
}

describe("formatPrice", () => {
  it("returns 'Free' for zero cents", () => {
    expect(formatPrice(0)).toBe("Free");
  });

  it("formats cents to dollar amount", () => {
    expect(formatPrice(2500)).toBe("$25.00");
    expect(formatPrice(1500)).toBe("$15.00");
    expect(formatPrice(99)).toBe("$0.99");
    expect(formatPrice(10000)).toBe("$100.00");
  });
});

describe("formatDate", () => {
  it("formats ISO date string to readable format", () => {
    // Use a full ISO string to avoid timezone offset issues
    const result = formatDate("2024-08-15T12:00:00.000Z");
    expect(result).toContain("Aug");
    expect(result).toContain("2024");
  });

  it("formats full ISO datetime string", () => {
    const result = formatDate("2024-12-25T00:00:00.000Z");
    expect(result).toContain("Dec");
    expect(result).toContain("2024");
  });
});

describe("isSessionFull", () => {
  it("returns true when capacity equals bookedCount", () => {
    expect(isSessionFull(20, 20)).toBe(true);
    expect(isSessionFull(0, 0)).toBe(true);
  });

  it("returns false when capacity exceeds bookedCount", () => {
    expect(isSessionFull(20, 5)).toBe(false);
    expect(isSessionFull(1, 0)).toBe(false);
  });
});

describe("buildClassPayload", () => {
  it("converts string form values to proper API payload", () => {
    const payload = buildClassPayload({
      title: "Morning Gi",
      date: "2024-08-01",
      startTime: "06:00",
      endTime: "07:30",
      trainingStyle: "gi",
      skillLevel: "all-levels",
      capacity: "20",
      price: "2500",
    });

    expect(payload.title).toBe("Morning Gi");
    expect(payload.capacity).toBe(20);
    expect(typeof payload.capacity).toBe("number");
    expect(payload.price).toBe(2500);
    expect(typeof payload.price).toBe("number");
  });

  it("handles empty string capacity/price as 0", () => {
    // Number("") returns 0 in JavaScript — the API will validate
    const payload = buildClassPayload({
      title: "", date: "", startTime: "", endTime: "",
      trainingStyle: "", skillLevel: "", capacity: "", price: "",
    });
    expect(payload.capacity).toBe(0);
    expect(payload.price).toBe(0);
  });
});

describe("buildOpenMatPayload", () => {
  it("converts string form values to proper API payload", () => {
    const payload = buildOpenMatPayload({
      date: "2024-08-01",
      startTime: "10:00",
      endTime: "12:00",
      capacity: "30",
      price: "1500",
    });

    expect(payload.capacity).toBe(30);
    expect(typeof payload.capacity).toBe("number");
    expect(payload.price).toBe(1500);
    expect(typeof payload.price).toBe("number");
  });
});
