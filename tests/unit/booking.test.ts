import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Transaction helper ────────────────────────────────────────────────────────
// Prisma's $transaction with interactive callback receives a `tx` proxy.
// We simulate this by passing the same mock prisma object as `tx`.

const mockBookingUpdate = vi.fn();
const mockBookingCreate = vi.fn();
const mockBookingFindFirst = vi.fn();
const mockBookingFindMany = vi.fn();
const mockBookingFindUnique = vi.fn();
const mockGymClassFindUnique = vi.fn();
const mockGymClassUpdate = vi.fn();
const mockOpenMatFindUnique = vi.fn();
const mockOpenMatUpdate = vi.fn();
const mockEventFindUnique = vi.fn();
const mockEventUpdate = vi.fn();
const mockTimeSlotFindUnique = vi.fn();
const mockTransaction = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    booking: {
      findFirst: (...args: unknown[]) => mockBookingFindFirst(...args),
      findMany: (...args: unknown[]) => mockBookingFindMany(...args),
      findUnique: (...args: unknown[]) => mockBookingFindUnique(...args),
      create: (...args: unknown[]) => mockBookingCreate(...args),
      update: (...args: unknown[]) => mockBookingUpdate(...args),
    },
    gymClass: {
      findUnique: (...args: unknown[]) => mockGymClassFindUnique(...args),
      update: (...args: unknown[]) => mockGymClassUpdate(...args),
    },
    openMat: {
      findUnique: (...args: unknown[]) => mockOpenMatFindUnique(...args),
      update: (...args: unknown[]) => mockOpenMatUpdate(...args),
    },
    event: {
      findUnique: (...args: unknown[]) => mockEventFindUnique(...args),
      update: (...args: unknown[]) => mockEventUpdate(...args),
    },
    timeSlot: {
      findUnique: (...args: unknown[]) => mockTimeSlotFindUnique(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

vi.mock("@/lib/auth-helpers", () => ({
  requireSession: vi.fn(),
  AuthError: class AuthError extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
      this.name = "AuthError";
    }
  },
}));

import { requireSession } from "@/lib/auth-helpers";
import { POST, GET } from "@/app/api/bookings/route";
import { DELETE } from "@/app/api/bookings/[id]/route";
import type { NextRequest } from "next/server";

function makeRequest(url: string, body?: unknown, method = "POST"): NextRequest {
  const init: RequestInit = { method, headers: { "Content-Type": "application/json" } };
  if (body !== undefined) init.body = JSON.stringify(body);
  return new Request(url, init) as unknown as NextRequest;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeCtx(id: string): any {
  return { params: Promise.resolve({ id }) };
}

const mockSession = {
  user: { id: "member-1", email: "member@test.com", name: "Member" },
};

// Future date for bookings (well beyond 24 hours)
const futureDate = new Date();
futureDate.setDate(futureDate.getDate() + 7);
const futureDateStr = futureDate.toISOString().split("T")[0];

// ─── POST /api/bookings — Create Booking ───────────────────────────────────────

describe("POST /api/bookings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireSession).mockResolvedValue(mockSession as never);
  });

  it("returns 401 when not authenticated", async () => {
    const { AuthError } = await import("@/lib/auth-helpers");
    vi.mocked(requireSession).mockRejectedValueOnce(new AuthError("unauthorized"));

    const res = await POST(
      makeRequest("http://localhost/api/bookings", { type: "class", referenceId: "c1" })
    );
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("unauthorized");
  });

  it("returns 400 when type is missing", async () => {
    const res = await POST(
      makeRequest("http://localhost/api/bookings", { referenceId: "c1" })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("validation_error");
    expect(json.fields.type).toBeDefined();
  });

  it("returns 400 when referenceId is missing", async () => {
    const res = await POST(
      makeRequest("http://localhost/api/bookings", { type: "class" })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("validation_error");
    expect(json.fields.referenceId).toBeDefined();
  });

  it("returns 400 when type is invalid", async () => {
    const res = await POST(
      makeRequest("http://localhost/api/bookings", { type: "invalid", referenceId: "c1" })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.fields.type).toBeDefined();
  });

  it("returns 404 when referenced class not found", async () => {
    mockGymClassFindUnique.mockResolvedValueOnce(null);

    const res = await POST(
      makeRequest("http://localhost/api/bookings", { type: "class", referenceId: "nonexistent" })
    );
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("not_found");
  });

  it("creates a class booking and decrements capacity", async () => {
    // getSessionInfo lookup
    mockGymClassFindUnique.mockResolvedValueOnce({
      date: futureDate,
      startTime: "10:00",
    });
    // No scheduling conflict
    mockBookingFindFirst.mockResolvedValueOnce(null);

    const createdBooking = {
      id: "booking-1",
      memberId: "member-1",
      type: "class",
      referenceId: "class-1",
      status: "confirmed",
      sessionDate: futureDate,
      sessionStartTime: "10:00",
      createdAt: new Date(),
    };

    // Transaction: re-fetch class, update capacity, create booking
    mockTransaction.mockImplementationOnce(async (fn: Function) => {
      // Inside the transaction, the callback receives a tx object
      const tx = {
        gymClass: {
          findUnique: vi.fn().mockResolvedValueOnce({
            id: "class-1",
            capacity: 20,
            bookedCount: 5,
          }),
          update: vi.fn().mockResolvedValueOnce({}),
        },
        booking: {
          create: vi.fn().mockResolvedValueOnce(createdBooking),
        },
      };
      return fn(tx);
    });

    const res = await POST(
      makeRequest("http://localhost/api/bookings", { type: "class", referenceId: "class-1" })
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.status).toBe("confirmed");
    expect(json.type).toBe("class");
  });

  it("returns 409 when class capacity is full", async () => {
    mockGymClassFindUnique.mockResolvedValueOnce({
      date: futureDate,
      startTime: "10:00",
    });
    mockBookingFindFirst.mockResolvedValueOnce(null);

    // Transaction returns null (capacity full)
    mockTransaction.mockImplementationOnce(async (fn: Function) => {
      const tx = {
        gymClass: {
          findUnique: vi.fn().mockResolvedValueOnce({
            id: "class-1",
            capacity: 10,
            bookedCount: 10, // full
          }),
          update: vi.fn(),
        },
        booking: { create: vi.fn() },
      };
      return fn(tx);
    });

    const res = await POST(
      makeRequest("http://localhost/api/bookings", { type: "class", referenceId: "class-1" })
    );
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toBe("capacity_full");
  });

  it("returns 409 when scheduling conflict exists", async () => {
    mockGymClassFindUnique.mockResolvedValueOnce({
      date: futureDate,
      startTime: "10:00",
    });
    // Existing booking at same date/time
    mockBookingFindFirst.mockResolvedValueOnce({
      id: "existing-booking",
      memberId: "member-1",
      status: "confirmed",
      sessionDate: futureDate,
      sessionStartTime: "10:00",
    });

    const res = await POST(
      makeRequest("http://localhost/api/bookings", { type: "class", referenceId: "class-2" })
    );
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toBe("scheduling_conflict");
  });

  it("creates an open_mat booking with capacity decrement", async () => {
    mockOpenMatFindUnique.mockResolvedValueOnce({
      date: futureDate,
      startTime: "14:00",
    });
    mockBookingFindFirst.mockResolvedValueOnce(null);

    const createdBooking = {
      id: "booking-2",
      memberId: "member-1",
      type: "open_mat",
      referenceId: "om-1",
      status: "confirmed",
      sessionDate: futureDate,
      sessionStartTime: "14:00",
      createdAt: new Date(),
    };

    mockTransaction.mockImplementationOnce(async (fn: Function) => {
      const tx = {
        openMat: {
          findUnique: vi.fn().mockResolvedValueOnce({
            id: "om-1",
            capacity: 30,
            bookedCount: 10,
          }),
          update: vi.fn().mockResolvedValueOnce({}),
        },
        booking: {
          create: vi.fn().mockResolvedValueOnce(createdBooking),
        },
      };
      return fn(tx);
    });

    const res = await POST(
      makeRequest("http://localhost/api/bookings", { type: "open_mat", referenceId: "om-1" })
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.type).toBe("open_mat");
    expect(json.status).toBe("confirmed");
  });

  it("returns 409 when open_mat capacity is full", async () => {
    mockOpenMatFindUnique.mockResolvedValueOnce({
      date: futureDate,
      startTime: "14:00",
    });
    mockBookingFindFirst.mockResolvedValueOnce(null);

    mockTransaction.mockImplementationOnce(async (fn: Function) => {
      const tx = {
        openMat: {
          findUnique: vi.fn().mockResolvedValueOnce({
            id: "om-1",
            capacity: 15,
            bookedCount: 15,
          }),
          update: vi.fn(),
        },
        booking: { create: vi.fn() },
      };
      return fn(tx);
    });

    const res = await POST(
      makeRequest("http://localhost/api/bookings", { type: "open_mat", referenceId: "om-1" })
    );
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toBe("capacity_full");
  });

  it("creates an event booking with capacity decrement", async () => {
    mockEventFindUnique.mockResolvedValueOnce({
      date: futureDate,
      startTime: "09:00",
    });
    mockBookingFindFirst.mockResolvedValueOnce(null);

    const createdBooking = {
      id: "booking-3",
      memberId: "member-1",
      type: "event",
      referenceId: "event-1",
      status: "confirmed",
      sessionDate: futureDate,
      sessionStartTime: "09:00",
      createdAt: new Date(),
    };

    mockTransaction.mockImplementationOnce(async (fn: Function) => {
      const tx = {
        event: {
          findUnique: vi.fn().mockResolvedValueOnce({
            id: "event-1",
            capacity: 100,
            bookedCount: 50,
          }),
          update: vi.fn().mockResolvedValueOnce({}),
        },
        booking: {
          create: vi.fn().mockResolvedValueOnce(createdBooking),
        },
      };
      return fn(tx);
    });

    const res = await POST(
      makeRequest("http://localhost/api/bookings", { type: "event", referenceId: "event-1" })
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.type).toBe("event");
  });

  it("creates a private_session booking and marks slot as booked", async () => {
    mockTimeSlotFindUnique.mockResolvedValueOnce({
      date: futureDate,
      startTime: "15:00",
    });
    mockBookingFindFirst.mockResolvedValueOnce(null);

    const createdBooking = {
      id: "booking-4",
      memberId: "member-1",
      type: "private_session",
      referenceId: "slot-1",
      status: "confirmed",
      sessionDate: futureDate,
      sessionStartTime: "15:00",
      createdAt: new Date(),
    };

    mockTransaction.mockImplementationOnce(async (fn: Function) => {
      const tx = {
        timeSlot: {
          findUnique: vi.fn().mockResolvedValueOnce({
            id: "slot-1",
            isBooked: false,
            date: futureDate,
            startTime: "15:00",
          }),
          update: vi.fn().mockResolvedValueOnce({}),
        },
        booking: {
          create: vi.fn().mockResolvedValueOnce(createdBooking),
        },
      };
      return fn(tx);
    });

    const res = await POST(
      makeRequest("http://localhost/api/bookings", { type: "private_session", referenceId: "slot-1" })
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.type).toBe("private_session");
    // Transaction should have been called to mark slot as booked
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });
});

// ─── GET /api/bookings — List Bookings ─────────────────────────────────────────

describe("GET /api/bookings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireSession).mockResolvedValue(mockSession as never);
  });

  it("returns 401 when not authenticated", async () => {
    const { AuthError } = await import("@/lib/auth-helpers");
    vi.mocked(requireSession).mockRejectedValueOnce(new AuthError("unauthorized"));

    const res = await GET(
      makeRequest("http://localhost/api/bookings", undefined, "GET")
    );
    expect(res.status).toBe(401);
  });

  it("returns active bookings sorted by session date ascending", async () => {
    const bookings = [
      {
        id: "b1",
        memberId: "member-1",
        type: "class",
        referenceId: "c1",
        status: "confirmed",
        sessionDate: new Date("2024-08-01"),
        sessionStartTime: "10:00",
        createdAt: new Date(),
      },
      {
        id: "b2",
        memberId: "member-1",
        type: "open_mat",
        referenceId: "om1",
        status: "confirmed",
        sessionDate: new Date("2024-08-03"),
        sessionStartTime: "14:00",
        createdAt: new Date(),
      },
    ];
    mockBookingFindMany.mockResolvedValueOnce(bookings);

    const res = await GET(
      makeRequest("http://localhost/api/bookings", undefined, "GET")
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveLength(2);
    // Verify sorted order (first date before second)
    expect(new Date(json[0].sessionDate).getTime()).toBeLessThanOrEqual(
      new Date(json[1].sessionDate).getTime()
    );
  });

  it("returns empty array when member has no bookings", async () => {
    mockBookingFindMany.mockResolvedValueOnce([]);

    const res = await GET(
      makeRequest("http://localhost/api/bookings", undefined, "GET")
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveLength(0);
  });

  it("only returns confirmed bookings", async () => {
    mockBookingFindMany.mockResolvedValueOnce([
      {
        id: "b1",
        memberId: "member-1",
        type: "class",
        referenceId: "c1",
        status: "confirmed",
        sessionDate: new Date("2024-08-01"),
        sessionStartTime: "10:00",
        createdAt: new Date(),
      },
    ]);

    const res = await GET(
      makeRequest("http://localhost/api/bookings", undefined, "GET")
    );
    const json = await res.json();
    // The mock was called with status: "confirmed" filter
    expect(mockBookingFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { memberId: "member-1", status: "confirmed" },
      })
    );
    expect(json).toHaveLength(1);
  });
});

// ─── DELETE /api/bookings/[id] — Cancel Booking ────────────────────────────────

describe("DELETE /api/bookings/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireSession).mockResolvedValue(mockSession as never);
  });

  it("returns 401 when not authenticated", async () => {
    const { AuthError } = await import("@/lib/auth-helpers");
    vi.mocked(requireSession).mockRejectedValueOnce(new AuthError("unauthorized"));

    const res = await DELETE(
      makeRequest("http://localhost/api/bookings/b1", undefined, "DELETE"),
      makeCtx("b1")
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 when booking not found", async () => {
    mockBookingFindUnique.mockResolvedValueOnce(null);

    const res = await DELETE(
      makeRequest("http://localhost/api/bookings/nonexistent", undefined, "DELETE"),
      makeCtx("nonexistent")
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 when booking belongs to another member", async () => {
    mockBookingFindUnique.mockResolvedValueOnce({
      id: "b1",
      memberId: "other-member",
      status: "confirmed",
    });

    const res = await DELETE(
      makeRequest("http://localhost/api/bookings/b1", undefined, "DELETE"),
      makeCtx("b1")
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 when booking is already cancelled", async () => {
    mockBookingFindUnique.mockResolvedValueOnce({
      id: "b1",
      memberId: "member-1",
      status: "cancelled",
    });

    const res = await DELETE(
      makeRequest("http://localhost/api/bookings/b1", undefined, "DELETE"),
      makeCtx("b1")
    );
    expect(res.status).toBe(404);
  });

  it("cancels booking ≥ 24 hours before session and restores class capacity", async () => {
    const sessionDate = new Date();
    sessionDate.setDate(sessionDate.getDate() + 3);

    mockBookingFindUnique.mockResolvedValueOnce({
      id: "b1",
      memberId: "member-1",
      type: "class",
      referenceId: "class-1",
      status: "confirmed",
      sessionDate,
      sessionStartTime: "10:00",
    });

    mockTransaction.mockImplementationOnce(async (fn: Function) => {
      const tx = {
        booking: {
          update: vi.fn().mockResolvedValueOnce({}),
        },
        gymClass: {
          update: vi.fn().mockResolvedValueOnce({}),
        },
      };
      return fn(tx);
    });

    const cancelledBooking = {
      id: "b1",
      memberId: "member-1",
      type: "class",
      referenceId: "class-1",
      status: "cancelled",
      sessionDate,
      sessionStartTime: "10:00",
    };
    // After transaction, findUnique returns the updated booking
    mockBookingFindUnique.mockResolvedValueOnce(cancelledBooking);

    const res = await DELETE(
      makeRequest("http://localhost/api/bookings/b1", undefined, "DELETE"),
      makeCtx("b1")
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("cancelled");
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });

  it("returns 422 when cancelling < 24 hours before session", async () => {
    const sessionDate = new Date();
    // Session is in 2 hours
    const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000);

    mockBookingFindUnique.mockResolvedValueOnce({
      id: "b1",
      memberId: "member-1",
      type: "class",
      referenceId: "class-1",
      status: "confirmed",
      sessionDate: twoHoursFromNow,
      sessionStartTime: `${String(twoHoursFromNow.getHours()).padStart(2, "0")}:${String(twoHoursFromNow.getMinutes()).padStart(2, "0")}`,
    });

    const res = await DELETE(
      makeRequest("http://localhost/api/bookings/b1", undefined, "DELETE"),
      makeCtx("b1")
    );
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toBe("cancellation_window_passed");
  });

  it("cancels open_mat booking and restores capacity", async () => {
    const sessionDate = new Date();
    sessionDate.setDate(sessionDate.getDate() + 5);

    mockBookingFindUnique.mockResolvedValueOnce({
      id: "b2",
      memberId: "member-1",
      type: "open_mat",
      referenceId: "om-1",
      status: "confirmed",
      sessionDate,
      sessionStartTime: "14:00",
    });

    mockTransaction.mockImplementationOnce(async (fn: Function) => {
      const tx = {
        booking: { update: vi.fn().mockResolvedValueOnce({}) },
        openMat: { update: vi.fn().mockResolvedValueOnce({}) },
      };
      return fn(tx);
    });

    mockBookingFindUnique.mockResolvedValueOnce({
      id: "b2",
      memberId: "member-1",
      type: "open_mat",
      referenceId: "om-1",
      status: "cancelled",
      sessionDate,
      sessionStartTime: "14:00",
    });

    const res = await DELETE(
      makeRequest("http://localhost/api/bookings/b2", undefined, "DELETE"),
      makeCtx("b2")
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("cancelled");
  });

  it("cancels event booking and restores capacity", async () => {
    const sessionDate = new Date();
    sessionDate.setDate(sessionDate.getDate() + 10);

    mockBookingFindUnique.mockResolvedValueOnce({
      id: "b3",
      memberId: "member-1",
      type: "event",
      referenceId: "event-1",
      status: "confirmed",
      sessionDate,
      sessionStartTime: "09:00",
    });

    mockTransaction.mockImplementationOnce(async (fn: Function) => {
      const tx = {
        booking: { update: vi.fn().mockResolvedValueOnce({}) },
        event: { update: vi.fn().mockResolvedValueOnce({}) },
      };
      return fn(tx);
    });

    mockBookingFindUnique.mockResolvedValueOnce({
      id: "b3",
      memberId: "member-1",
      type: "event",
      referenceId: "event-1",
      status: "cancelled",
      sessionDate,
      sessionStartTime: "09:00",
    });

    const res = await DELETE(
      makeRequest("http://localhost/api/bookings/b3", undefined, "DELETE"),
      makeCtx("b3")
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("cancelled");
  });

  it("cancels private_session booking without capacity restore", async () => {
    const sessionDate = new Date();
    sessionDate.setDate(sessionDate.getDate() + 4);

    mockBookingFindUnique.mockResolvedValueOnce({
      id: "b4",
      memberId: "member-1",
      type: "private_session",
      referenceId: "slot-1",
      status: "confirmed",
      sessionDate,
      sessionStartTime: "15:00",
    });

    mockBookingUpdate.mockResolvedValueOnce({});

    mockBookingFindUnique.mockResolvedValueOnce({
      id: "b4",
      memberId: "member-1",
      type: "private_session",
      referenceId: "slot-1",
      status: "cancelled",
      sessionDate,
      sessionStartTime: "15:00",
    });

    const res = await DELETE(
      makeRequest("http://localhost/api/bookings/b4", undefined, "DELETE"),
      makeCtx("b4")
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("cancelled");
    // No transaction for private_session
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});
