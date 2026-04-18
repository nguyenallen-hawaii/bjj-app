import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ─────────────────────────────────────────────────────────────────────

const mockEventCreate = vi.fn();
const mockEventFindUnique = vi.fn();
const mockEventFindMany = vi.fn();
const mockEventUpdate = vi.fn();
const mockGymFindUnique = vi.fn();
const mockBookingFindFirst = vi.fn();
const mockBookingCreate = vi.fn();
const mockTransaction = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    event: {
      create: (...args: unknown[]) => mockEventCreate(...args),
      findUnique: (...args: unknown[]) => mockEventFindUnique(...args),
      findMany: (...args: unknown[]) => mockEventFindMany(...args),
      update: (...args: unknown[]) => mockEventUpdate(...args),
    },
    gym: {
      findUnique: (...args: unknown[]) => mockGymFindUnique(...args),
    },
    booking: {
      findFirst: (...args: unknown[]) => mockBookingFindFirst(...args),
      create: (...args: unknown[]) => mockBookingCreate(...args),
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
import { POST, GET } from "@/app/api/events/route";
import { POST as REGISTER } from "@/app/api/events/[id]/register/route";
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

const mockOwnerSession = {
  user: { id: "owner-1", email: "owner@test.com", name: "Owner" },
};

const mockMemberSession = {
  user: { id: "member-1", email: "member@test.com", name: "Member" },
};

const futureDate = new Date();
futureDate.setDate(futureDate.getDate() + 14);

const validEventBody = {
  gymId: "gym-1",
  title: "Summer BJJ Tournament",
  description: "Annual summer tournament for all belt levels",
  date: futureDate.toISOString().split("T")[0],
  startTime: "09:00",
  endTime: "17:00",
  location: "Main Arena, 123 Fight St",
  capacity: 100,
  price: 5000,
};

// ─── POST /api/events — Create Event ───────────────────────────────────────────

describe("POST /api/events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireSession).mockResolvedValue(mockOwnerSession as never);
  });

  it("returns 401 when not authenticated", async () => {
    const { AuthError } = await import("@/lib/auth-helpers");
    vi.mocked(requireSession).mockRejectedValueOnce(new AuthError("unauthorized"));

    const res = await POST(makeRequest("http://localhost/api/events", validEventBody));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("unauthorized");
  });

  it("returns 400 when required fields are missing", async () => {
    const res = await POST(makeRequest("http://localhost/api/events", { gymId: "gym-1" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("validation_error");
    expect(json.fields.title).toBeDefined();
    expect(json.fields.description).toBeDefined();
    expect(json.fields.date).toBeDefined();
    expect(json.fields.startTime).toBeDefined();
    expect(json.fields.location).toBeDefined();
    expect(json.fields.capacity).toBeDefined();
    expect(json.fields.price).toBeDefined();
  });

  it("returns 404 when gym not found", async () => {
    mockGymFindUnique.mockResolvedValueOnce(null);

    const res = await POST(makeRequest("http://localhost/api/events", validEventBody));
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("not_found");
  });

  it("returns 403 when non-owner tries to create event", async () => {
    vi.mocked(requireSession).mockResolvedValue(mockMemberSession as never);
    mockGymFindUnique.mockResolvedValueOnce({ id: "gym-1", ownerId: "owner-1" });

    const res = await POST(makeRequest("http://localhost/api/events", validEventBody));
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe("forbidden");
  });

  it("creates event with valid data as owner", async () => {
    mockGymFindUnique.mockResolvedValueOnce({ id: "gym-1", ownerId: "owner-1" });

    const createdEvent = {
      id: "event-1",
      gymId: "gym-1",
      title: "Summer BJJ Tournament",
      description: "Annual summer tournament for all belt levels",
      date: futureDate,
      startTime: "09:00",
      endTime: "17:00",
      location: "Main Arena, 123 Fight St",
      capacity: 100,
      bookedCount: 0,
      price: 5000,
      status: "active",
    };
    mockEventCreate.mockResolvedValueOnce(createdEvent);

    const res = await POST(makeRequest("http://localhost/api/events", validEventBody));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.title).toBe("Summer BJJ Tournament");
    expect(json.capacity).toBe(100);
    expect(json.isSoldOut).toBe(false);
  });

  it("returns isSoldOut true when bookedCount equals capacity", async () => {
    mockGymFindUnique.mockResolvedValueOnce({ id: "gym-1", ownerId: "owner-1" });

    const soldOutEvent = {
      id: "event-2",
      gymId: "gym-1",
      title: "Sold Out Seminar",
      description: "A popular seminar",
      date: futureDate,
      startTime: "10:00",
      endTime: "12:00",
      location: "Gym Hall",
      capacity: 5,
      bookedCount: 5,
      price: 3000,
      status: "active",
    };
    mockEventCreate.mockResolvedValueOnce(soldOutEvent);

    const res = await POST(makeRequest("http://localhost/api/events", {
      ...validEventBody,
      title: "Sold Out Seminar",
      capacity: 5,
    }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.isSoldOut).toBe(true);
  });
});

// ─── GET /api/events — List Upcoming Events ────────────────────────────────────

describe("GET /api/events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns upcoming events sorted by date ascending", async () => {
    const date1 = new Date();
    date1.setDate(date1.getDate() + 5);
    const date2 = new Date();
    date2.setDate(date2.getDate() + 10);

    const events = [
      {
        id: "e1",
        gymId: "gym-1",
        title: "Event A",
        description: "Desc A",
        date: date1,
        startTime: "09:00",
        endTime: "12:00",
        location: "Loc A",
        capacity: 50,
        bookedCount: 10,
        price: 2000,
        status: "active",
        gym: { id: "gym-1", name: "BJJ Academy" },
      },
      {
        id: "e2",
        gymId: "gym-2",
        title: "Event B",
        description: "Desc B",
        date: date2,
        startTime: "14:00",
        endTime: "18:00",
        location: "Loc B",
        capacity: 30,
        bookedCount: 30,
        price: 4000,
        status: "active",
        gym: { id: "gym-2", name: "Grapple House" },
      },
    ];
    mockEventFindMany.mockResolvedValueOnce(events);

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveLength(2);
    // First event before second
    expect(new Date(json[0].date).getTime()).toBeLessThanOrEqual(
      new Date(json[1].date).getTime()
    );
    // Includes gym info
    expect(json[0].gym.name).toBe("BJJ Academy");
    // isSoldOut flags
    expect(json[0].isSoldOut).toBe(false);
    expect(json[1].isSoldOut).toBe(true);
  });

  it("returns empty array when no upcoming events", async () => {
    mockEventFindMany.mockResolvedValueOnce([]);

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveLength(0);
  });
});

// ─── POST /api/events/[id]/register — Register for Event ──────────────────────

describe("POST /api/events/[id]/register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireSession).mockResolvedValue(mockMemberSession as never);
  });

  it("returns 401 when not authenticated", async () => {
    const { AuthError } = await import("@/lib/auth-helpers");
    vi.mocked(requireSession).mockRejectedValueOnce(new AuthError("unauthorized"));

    const res = await REGISTER(
      makeRequest("http://localhost/api/events/e1/register"),
      makeCtx("e1")
    );
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("unauthorized");
  });

  it("returns 404 when event not found", async () => {
    mockEventFindUnique.mockResolvedValueOnce(null);

    const res = await REGISTER(
      makeRequest("http://localhost/api/events/nonexistent/register"),
      makeCtx("nonexistent")
    );
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("not_found");
  });

  it("registers member for event and creates booking", async () => {
    mockEventFindUnique.mockResolvedValueOnce({
      id: "e1",
      date: futureDate,
      startTime: "09:00",
      capacity: 100,
      bookedCount: 10,
      status: "active",
    });
    mockBookingFindFirst.mockResolvedValueOnce(null);

    const createdBooking = {
      id: "booking-1",
      memberId: "member-1",
      type: "event",
      referenceId: "e1",
      status: "confirmed",
      sessionDate: futureDate,
      sessionStartTime: "09:00",
      createdAt: new Date(),
    };

    mockTransaction.mockImplementationOnce(async (fn: Function) => {
      const tx = {
        event: {
          findUnique: vi.fn().mockResolvedValueOnce({
            id: "e1",
            capacity: 100,
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

    const res = await REGISTER(
      makeRequest("http://localhost/api/events/e1/register"),
      makeCtx("e1")
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.type).toBe("event");
    expect(json.status).toBe("confirmed");
    expect(json.referenceId).toBe("e1");
  });

  it("returns 409 when event capacity is full (sold out)", async () => {
    mockEventFindUnique.mockResolvedValueOnce({
      id: "e1",
      date: futureDate,
      startTime: "09:00",
      capacity: 50,
      bookedCount: 49,
      status: "active",
    });
    mockBookingFindFirst.mockResolvedValueOnce(null);

    mockTransaction.mockImplementationOnce(async (fn: Function) => {
      const tx = {
        event: {
          findUnique: vi.fn().mockResolvedValueOnce({
            id: "e1",
            capacity: 50,
            bookedCount: 50, // full at transaction time
          }),
          update: vi.fn(),
        },
        booking: { create: vi.fn() },
      };
      return fn(tx);
    });

    const res = await REGISTER(
      makeRequest("http://localhost/api/events/e1/register"),
      makeCtx("e1")
    );
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toBe("capacity_full");
  });

  it("returns 409 when scheduling conflict exists", async () => {
    mockEventFindUnique.mockResolvedValueOnce({
      id: "e1",
      date: futureDate,
      startTime: "09:00",
      capacity: 100,
      bookedCount: 10,
      status: "active",
    });
    mockBookingFindFirst.mockResolvedValueOnce({
      id: "existing-booking",
      memberId: "member-1",
      status: "confirmed",
      sessionDate: futureDate,
      sessionStartTime: "09:00",
    });

    const res = await REGISTER(
      makeRequest("http://localhost/api/events/e1/register"),
      makeCtx("e1")
    );
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toBe("scheduling_conflict");
  });
});
