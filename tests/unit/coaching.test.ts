import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ─────────────────────────────────────────────────────────────────────

const mockCoachCreate = vi.fn();
const mockCoachFindUnique = vi.fn();
const mockTimeSlotCreateMany = vi.fn();
const mockTimeSlotFindMany = vi.fn();
const mockTimeSlotFindUnique = vi.fn();
const mockTimeSlotUpdate = vi.fn();
const mockGymFindUnique = vi.fn();
const mockBookingCreate = vi.fn();
const mockBookingFindFirst = vi.fn();
const mockTransaction = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    coach: {
      create: (...args: unknown[]) => mockCoachCreate(...args),
      findUnique: (...args: unknown[]) => mockCoachFindUnique(...args),
    },
    timeSlot: {
      createMany: (...args: unknown[]) => mockTimeSlotCreateMany(...args),
      findMany: (...args: unknown[]) => mockTimeSlotFindMany(...args),
      findUnique: (...args: unknown[]) => mockTimeSlotFindUnique(...args),
      update: (...args: unknown[]) => mockTimeSlotUpdate(...args),
    },
    gym: {
      findUnique: (...args: unknown[]) => mockGymFindUnique(...args),
    },
    booking: {
      create: (...args: unknown[]) => mockBookingCreate(...args),
      findFirst: (...args: unknown[]) => mockBookingFindFirst(...args),
    },
    gymClass: {
      findUnique: vi.fn(),
    },
    openMat: {
      findUnique: vi.fn(),
    },
    event: {
      findUnique: vi.fn(),
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
import { POST as createCoach } from "@/app/api/gyms/[id]/coaches/route";
import { GET as getSlots } from "@/app/api/coaches/[id]/slots/route";
import { POST as createBooking } from "@/app/api/bookings/route";
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

const ownerSession = {
  user: { id: "owner-1", email: "owner@test.com", name: "Owner" },
};

const memberSession = {
  user: { id: "member-1", email: "member@test.com", name: "Member" },
};

const futureDate = new Date();
futureDate.setDate(futureDate.getDate() + 7);

// ─── POST /api/gyms/[id]/coaches — Create Coach ────────────────────────────────

describe("POST /api/gyms/[id]/coaches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireSession).mockResolvedValue(ownerSession as never);
  });

  it("creates a coach with valid data", async () => {
    mockGymFindUnique.mockResolvedValueOnce({ id: "gym-1", ownerId: "owner-1" });

    const createdCoach = {
      id: "coach-1",
      gymId: "gym-1",
      name: "Professor Silva",
      credentials: "3rd degree black belt",
      beltRank: "Black",
      pricePerSession: 15000,
    };
    mockCoachCreate.mockResolvedValueOnce(createdCoach);
    mockTimeSlotCreateMany.mockResolvedValueOnce({ count: 1 });
    mockCoachFindUnique.mockResolvedValueOnce({
      ...createdCoach,
      timeSlots: [
        {
          id: "slot-1",
          date: futureDate,
          startTime: "10:00",
          endTime: "11:00",
          isBooked: false,
        },
      ],
    });

    const res = await createCoach(
      makeRequest("http://localhost/api/gyms/gym-1/coaches", {
        name: "Professor Silva",
        credentials: "3rd degree black belt",
        beltRank: "Black",
        pricePerSession: 15000,
        timeSlots: [
          { date: futureDate.toISOString(), startTime: "10:00", endTime: "11:00" },
        ],
      }),
      makeCtx("gym-1")
    );

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.name).toBe("Professor Silva");
    expect(json.pricePerSession).toBe(15000);
    expect(json.timeSlots).toHaveLength(1);
  });

  it("returns 403 when non-owner tries to create coach", async () => {
    vi.mocked(requireSession).mockResolvedValue(memberSession as never);
    mockGymFindUnique.mockResolvedValueOnce({ id: "gym-1", ownerId: "owner-1" });

    const res = await createCoach(
      makeRequest("http://localhost/api/gyms/gym-1/coaches", {
        name: "Coach",
        credentials: "Black belt",
        beltRank: "Black",
        pricePerSession: 10000,
      }),
      makeCtx("gym-1")
    );

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe("forbidden");
  });

  it("returns 400 when required fields are missing", async () => {
    mockGymFindUnique.mockResolvedValueOnce({ id: "gym-1", ownerId: "owner-1" });

    const res = await createCoach(
      makeRequest("http://localhost/api/gyms/gym-1/coaches", {
        name: "",
        credentials: "",
        beltRank: "",
      }),
      makeCtx("gym-1")
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("validation_error");
    expect(json.fields.name).toBeDefined();
    expect(json.fields.credentials).toBeDefined();
    expect(json.fields.beltRank).toBeDefined();
    expect(json.fields.pricePerSession).toBeDefined();
  });

  it("returns 404 when gym does not exist", async () => {
    mockGymFindUnique.mockResolvedValueOnce(null);

    const res = await createCoach(
      makeRequest("http://localhost/api/gyms/nonexistent/coaches", {
        name: "Coach",
        credentials: "Black belt",
        beltRank: "Black",
        pricePerSession: 10000,
      }),
      makeCtx("nonexistent")
    );

    expect(res.status).toBe(404);
  });
});

// ─── GET /api/coaches/[id]/slots — Available Slots ──────────────────────────────

describe("GET /api/coaches/[id]/slots", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns only unbooked slots for a coach", async () => {
    mockCoachFindUnique.mockResolvedValueOnce({ id: "coach-1", name: "Coach" });
    mockTimeSlotFindMany.mockResolvedValueOnce([
      { id: "slot-1", date: futureDate, startTime: "10:00", endTime: "11:00", isBooked: false },
      { id: "slot-3", date: futureDate, startTime: "14:00", endTime: "15:00", isBooked: false },
    ]);

    const res = await getSlots(
      makeRequest("http://localhost/api/coaches/coach-1/slots", undefined, "GET"),
      makeCtx("coach-1")
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.slots).toHaveLength(2);
    expect(json.slots.every((s: { isBooked: boolean }) => !s.isBooked)).toBe(true);
  });

  it("filters slots by date query param", async () => {
    mockCoachFindUnique.mockResolvedValueOnce({ id: "coach-1", name: "Coach" });
    const dateStr = futureDate.toISOString().split("T")[0];
    mockTimeSlotFindMany.mockResolvedValueOnce([
      { id: "slot-1", date: futureDate, startTime: "10:00", endTime: "11:00", isBooked: false },
    ]);

    const res = await getSlots(
      makeRequest(`http://localhost/api/coaches/coach-1/slots?date=${dateStr}`, undefined, "GET"),
      makeCtx("coach-1")
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.slots).toHaveLength(1);
    // Verify the findMany was called with a date filter
    expect(mockTimeSlotFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          coachId: "coach-1",
          isBooked: false,
          date: expect.any(Date),
        }),
      })
    );
  });

  it("suggests alternative dates when no slots on selected date", async () => {
    mockCoachFindUnique.mockResolvedValueOnce({ id: "coach-1", name: "Coach" });
    const dateStr = futureDate.toISOString().split("T")[0];
    // No slots on requested date
    mockTimeSlotFindMany.mockResolvedValueOnce([]);
    // Alternative dates query
    const altDate1 = new Date(futureDate);
    altDate1.setDate(altDate1.getDate() + 1);
    const altDate2 = new Date(futureDate);
    altDate2.setDate(altDate2.getDate() + 3);
    mockTimeSlotFindMany.mockResolvedValueOnce([
      { date: altDate1 },
      { date: altDate2 },
    ]);

    const res = await getSlots(
      makeRequest(`http://localhost/api/coaches/coach-1/slots?date=${dateStr}`, undefined, "GET"),
      makeCtx("coach-1")
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.slots).toHaveLength(0);
    expect(json.alternativeDates).toHaveLength(2);
    expect(json.message).toContain("alternative");
  });

  it("returns 404 when coach does not exist", async () => {
    mockCoachFindUnique.mockResolvedValueOnce(null);

    const res = await getSlots(
      makeRequest("http://localhost/api/coaches/nonexistent/slots", undefined, "GET"),
      makeCtx("nonexistent")
    );

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("not_found");
  });
});

// ─── POST /api/bookings — Private Session marks slot as booked ──────────────────

describe("POST /api/bookings (private_session slot marking)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireSession).mockResolvedValue(memberSession as never);
  });

  it("marks time slot as booked when creating private_session booking", async () => {
    // getSessionInfo lookup
    mockTimeSlotFindUnique.mockResolvedValueOnce({
      date: futureDate,
      startTime: "10:00",
    });
    // No scheduling conflict
    mockBookingFindFirst.mockResolvedValueOnce(null);

    const createdBooking = {
      id: "booking-ps-1",
      memberId: "member-1",
      type: "private_session",
      referenceId: "slot-1",
      status: "confirmed",
      sessionDate: futureDate,
      sessionStartTime: "10:00",
      createdAt: new Date(),
    };

    mockTransaction.mockImplementationOnce(async (fn: Function) => {
      const tx = {
        timeSlot: {
          findUnique: vi.fn().mockResolvedValueOnce({
            id: "slot-1",
            isBooked: false,
            date: futureDate,
            startTime: "10:00",
          }),
          update: vi.fn().mockResolvedValueOnce({}),
        },
        booking: {
          create: vi.fn().mockResolvedValueOnce(createdBooking),
        },
      };
      return fn(tx);
    });

    const res = await createBooking(
      makeRequest("http://localhost/api/bookings", {
        type: "private_session",
        referenceId: "slot-1",
      })
    );

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.type).toBe("private_session");
    expect(json.status).toBe("confirmed");
    // Transaction should have been called (slot marking)
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });

  it("returns 409 when time slot is already booked", async () => {
    mockTimeSlotFindUnique.mockResolvedValueOnce({
      date: futureDate,
      startTime: "10:00",
    });
    mockBookingFindFirst.mockResolvedValueOnce(null);

    mockTransaction.mockImplementationOnce(async (fn: Function) => {
      const tx = {
        timeSlot: {
          findUnique: vi.fn().mockResolvedValueOnce({
            id: "slot-1",
            isBooked: true,
          }),
          update: vi.fn(),
        },
        booking: { create: vi.fn() },
      };
      return fn(tx);
    });

    const res = await createBooking(
      makeRequest("http://localhost/api/bookings", {
        type: "private_session",
        referenceId: "slot-1",
      })
    );

    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toBe("capacity_full");
  });
});
