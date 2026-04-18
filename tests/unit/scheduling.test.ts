import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    gym: {
      findUnique: vi.fn(),
    },
    gymClass: {
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    openMat: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    booking: {
      findMany: vi.fn(),
    },
  },
}));

// Mock auth helpers
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

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth-helpers";
import { GET as classesGET, POST as classesPOST } from "@/app/api/gyms/[id]/classes/route";
import { GET as openMatsGET, POST as openMatsPOST } from "@/app/api/gyms/[id]/open-mats/route";
import { PUT as classPUT } from "@/app/api/classes/[id]/route";
import type { NextRequest } from "next/server";

function makeRequest(url: string, body: unknown, method = "POST"): NextRequest {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeCtx(id: string): any {
  return { params: Promise.resolve({ id }) };
}

const mockSession = {
  user: { id: "owner-1", email: "owner@test.com", name: "Owner", isGymOwner: true },
};

const validClassInput = {
  title: "Morning Gi",
  date: "2024-08-01",
  startTime: "06:00",
  endTime: "07:30",
  trainingStyle: "gi",
  skillLevel: "all-levels",
  capacity: 20,
  price: 2500,
};

const validOpenMatInput = {
  date: "2024-08-01",
  startTime: "10:00",
  endTime: "12:00",
  capacity: 30,
  price: 1500,
};

// ─── POST /api/gyms/[id]/classes ───────────────────────────────────────────────

describe("POST /api/gyms/[id]/classes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireSession).mockResolvedValue(mockSession as never);
  });

  it("returns 401 when not authenticated", async () => {
    const { AuthError } = await import("@/lib/auth-helpers");
    vi.mocked(requireSession).mockRejectedValueOnce(new AuthError("unauthorized"));

    const res = await classesPOST(
      makeRequest("http://localhost/api/gyms/gym-1/classes", validClassInput),
      makeCtx("gym-1")
    );
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("unauthorized");
  });

  it("returns 404 when gym not found", async () => {
    vi.mocked(prisma.gym.findUnique).mockResolvedValueOnce(null);

    const res = await classesPOST(
      makeRequest("http://localhost/api/gyms/nonexistent/classes", validClassInput),
      makeCtx("nonexistent")
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 when user is not the gym owner", async () => {
    vi.mocked(prisma.gym.findUnique).mockResolvedValueOnce({
      id: "gym-1",
      ownerId: "other-owner",
    } as never);

    const res = await classesPOST(
      makeRequest("http://localhost/api/gyms/gym-1/classes", validClassInput),
      makeCtx("gym-1")
    );
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe("forbidden");
  });

  it("returns 400 when required fields are missing", async () => {
    vi.mocked(prisma.gym.findUnique).mockResolvedValueOnce({
      id: "gym-1",
      ownerId: "owner-1",
    } as never);

    const res = await classesPOST(
      makeRequest("http://localhost/api/gyms/gym-1/classes", {}),
      makeCtx("gym-1")
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("validation_error");
    expect(json.fields.title).toBeDefined();
    expect(json.fields.date).toBeDefined();
    expect(json.fields.startTime).toBeDefined();
    expect(json.fields.endTime).toBeDefined();
    expect(json.fields.trainingStyle).toBeDefined();
    expect(json.fields.skillLevel).toBeDefined();
    expect(json.fields.capacity).toBeDefined();
    expect(json.fields.price).toBeDefined();
  });

  it("returns 201 on successful class creation", async () => {
    vi.mocked(prisma.gym.findUnique).mockResolvedValueOnce({
      id: "gym-1",
      ownerId: "owner-1",
    } as never);

    const createdClass = {
      id: "class-1",
      gymId: "gym-1",
      title: "Morning Gi",
      date: new Date("2024-08-01"),
      startTime: "06:00",
      endTime: "07:30",
      trainingStyle: "gi",
      skillLevel: "all-levels",
      capacity: 20,
      bookedCount: 0,
      price: 2500,
      status: "active",
    };
    vi.mocked(prisma.gymClass.create).mockResolvedValueOnce(createdClass as never);

    const res = await classesPOST(
      makeRequest("http://localhost/api/gyms/gym-1/classes", validClassInput),
      makeCtx("gym-1")
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.title).toBe("Morning Gi");
    expect(json.isFull).toBe(false);
  });

  it("returns isFull true when capacity equals bookedCount", async () => {
    vi.mocked(prisma.gym.findUnique).mockResolvedValueOnce({
      id: "gym-1",
      ownerId: "owner-1",
    } as never);

    const createdClass = {
      id: "class-1",
      gymId: "gym-1",
      title: "Full Class",
      date: new Date("2024-08-01"),
      startTime: "06:00",
      endTime: "07:30",
      trainingStyle: "gi",
      skillLevel: "all-levels",
      capacity: 0,
      bookedCount: 0,
      price: 2500,
      status: "active",
    };
    vi.mocked(prisma.gymClass.create).mockResolvedValueOnce(createdClass as never);

    const res = await classesPOST(
      makeRequest("http://localhost/api/gyms/gym-1/classes", { ...validClassInput, capacity: 0 }),
      makeCtx("gym-1")
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.isFull).toBe(true);
  });
});

// ─── GET /api/gyms/[id]/classes ────────────────────────────────────────────────

describe("GET /api/gyms/[id]/classes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when gym not found", async () => {
    vi.mocked(prisma.gym.findUnique).mockResolvedValueOnce(null);

    const req = new Request("http://localhost/api/gyms/nonexistent/classes") as unknown as NextRequest;
    const res = await classesGET(req, makeCtx("nonexistent"));
    expect(res.status).toBe(404);
  });

  it("returns classes with isFull flag", async () => {
    vi.mocked(prisma.gym.findUnique).mockResolvedValueOnce({ id: "gym-1" } as never);
    vi.mocked(prisma.gymClass.findMany).mockResolvedValueOnce([
      {
        id: "c1",
        gymId: "gym-1",
        title: "Morning Gi",
        date: new Date("2024-08-01"),
        startTime: "06:00",
        endTime: "07:30",
        trainingStyle: "gi",
        skillLevel: "all-levels",
        capacity: 20,
        bookedCount: 5,
        price: 2500,
        status: "active",
      },
      {
        id: "c2",
        gymId: "gym-1",
        title: "Full Class",
        date: new Date("2024-08-02"),
        startTime: "18:00",
        endTime: "19:30",
        trainingStyle: "no-gi",
        skillLevel: "advanced",
        capacity: 10,
        bookedCount: 10,
        price: 3000,
        status: "active",
      },
    ] as never);

    const req = new Request("http://localhost/api/gyms/gym-1/classes") as unknown as NextRequest;
    const res = await classesGET(req, makeCtx("gym-1"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveLength(2);
    expect(json[0].isFull).toBe(false);
    expect(json[1].isFull).toBe(true);
  });

  it("returns empty array when gym has no classes", async () => {
    vi.mocked(prisma.gym.findUnique).mockResolvedValueOnce({ id: "gym-1" } as never);
    vi.mocked(prisma.gymClass.findMany).mockResolvedValueOnce([] as never);

    const req = new Request("http://localhost/api/gyms/gym-1/classes") as unknown as NextRequest;
    const res = await classesGET(req, makeCtx("gym-1"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveLength(0);
  });
});

// ─── POST /api/gyms/[id]/open-mats ────────────────────────────────────────────

describe("POST /api/gyms/[id]/open-mats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireSession).mockResolvedValue(mockSession as never);
  });

  it("returns 401 when not authenticated", async () => {
    const { AuthError } = await import("@/lib/auth-helpers");
    vi.mocked(requireSession).mockRejectedValueOnce(new AuthError("unauthorized"));

    const res = await openMatsPOST(
      makeRequest("http://localhost/api/gyms/gym-1/open-mats", validOpenMatInput),
      makeCtx("gym-1")
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 when gym not found", async () => {
    vi.mocked(prisma.gym.findUnique).mockResolvedValueOnce(null);

    const res = await openMatsPOST(
      makeRequest("http://localhost/api/gyms/nonexistent/open-mats", validOpenMatInput),
      makeCtx("nonexistent")
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 when user is not the gym owner", async () => {
    vi.mocked(prisma.gym.findUnique).mockResolvedValueOnce({
      id: "gym-1",
      ownerId: "other-owner",
    } as never);

    const res = await openMatsPOST(
      makeRequest("http://localhost/api/gyms/gym-1/open-mats", validOpenMatInput),
      makeCtx("gym-1")
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 when required fields are missing", async () => {
    vi.mocked(prisma.gym.findUnique).mockResolvedValueOnce({
      id: "gym-1",
      ownerId: "owner-1",
    } as never);

    const res = await openMatsPOST(
      makeRequest("http://localhost/api/gyms/gym-1/open-mats", {}),
      makeCtx("gym-1")
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("validation_error");
    expect(json.fields.date).toBeDefined();
    expect(json.fields.startTime).toBeDefined();
    expect(json.fields.endTime).toBeDefined();
    expect(json.fields.capacity).toBeDefined();
    expect(json.fields.price).toBeDefined();
  });

  it("returns 201 on successful open mat creation", async () => {
    vi.mocked(prisma.gym.findUnique).mockResolvedValueOnce({
      id: "gym-1",
      ownerId: "owner-1",
    } as never);

    const createdOpenMat = {
      id: "om-1",
      gymId: "gym-1",
      date: new Date("2024-08-01"),
      startTime: "10:00",
      endTime: "12:00",
      capacity: 30,
      bookedCount: 0,
      price: 1500,
      status: "active",
    };
    vi.mocked(prisma.openMat.create).mockResolvedValueOnce(createdOpenMat as never);

    const res = await openMatsPOST(
      makeRequest("http://localhost/api/gyms/gym-1/open-mats", validOpenMatInput),
      makeCtx("gym-1")
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.startTime).toBe("10:00");
    expect(json.isFull).toBe(false);
  });
});

// ─── GET /api/gyms/[id]/open-mats ─────────────────────────────────────────────

describe("GET /api/gyms/[id]/open-mats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when gym not found", async () => {
    vi.mocked(prisma.gym.findUnique).mockResolvedValueOnce(null);

    const req = new Request("http://localhost/api/gyms/nonexistent/open-mats") as unknown as NextRequest;
    const res = await openMatsGET(req, makeCtx("nonexistent"));
    expect(res.status).toBe(404);
  });

  it("returns open mats with isFull flag", async () => {
    vi.mocked(prisma.gym.findUnique).mockResolvedValueOnce({ id: "gym-1" } as never);
    vi.mocked(prisma.openMat.findMany).mockResolvedValueOnce([
      {
        id: "om-1",
        gymId: "gym-1",
        date: new Date("2024-08-01"),
        startTime: "10:00",
        endTime: "12:00",
        capacity: 30,
        bookedCount: 10,
        price: 1500,
        status: "active",
      },
      {
        id: "om-2",
        gymId: "gym-1",
        date: new Date("2024-08-02"),
        startTime: "14:00",
        endTime: "16:00",
        capacity: 15,
        bookedCount: 15,
        price: 1000,
        status: "active",
      },
    ] as never);

    const req = new Request("http://localhost/api/gyms/gym-1/open-mats") as unknown as NextRequest;
    const res = await openMatsGET(req, makeCtx("gym-1"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveLength(2);
    expect(json[0].isFull).toBe(false);
    expect(json[1].isFull).toBe(true);
  });
});

// ─── PUT /api/classes/[id] ─────────────────────────────────────────────────────

describe("PUT /api/classes/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireSession).mockResolvedValue(mockSession as never);
  });

  it("returns 401 when not authenticated", async () => {
    const { AuthError } = await import("@/lib/auth-helpers");
    vi.mocked(requireSession).mockRejectedValueOnce(new AuthError("unauthorized"));

    const res = await classPUT(
      makeRequest("http://localhost/api/classes/class-1", { title: "Updated" }, "PUT"),
      makeCtx("class-1")
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 when class not found", async () => {
    vi.mocked(prisma.gymClass.findUnique).mockResolvedValueOnce(null);

    const res = await classPUT(
      makeRequest("http://localhost/api/classes/nonexistent", { title: "Updated" }, "PUT"),
      makeCtx("nonexistent")
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 when user is not the gym owner", async () => {
    vi.mocked(prisma.gymClass.findUnique).mockResolvedValueOnce({
      id: "class-1",
      gymId: "gym-1",
      status: "active",
      gym: { ownerId: "other-owner" },
    } as never);

    const res = await classPUT(
      makeRequest("http://localhost/api/classes/class-1", { title: "Updated" }, "PUT"),
      makeCtx("class-1")
    );
    expect(res.status).toBe(403);
  });

  it("updates class successfully", async () => {
    vi.mocked(prisma.gymClass.findUnique).mockResolvedValueOnce({
      id: "class-1",
      gymId: "gym-1",
      status: "active",
      gym: { ownerId: "owner-1" },
    } as never);

    const updatedClass = {
      id: "class-1",
      gymId: "gym-1",
      title: "Updated Title",
      date: new Date("2024-08-01"),
      startTime: "06:00",
      endTime: "07:30",
      trainingStyle: "gi",
      skillLevel: "all-levels",
      capacity: 20,
      bookedCount: 5,
      price: 2500,
      status: "active",
    };
    vi.mocked(prisma.gymClass.update).mockResolvedValueOnce(updatedClass as never);

    const res = await classPUT(
      makeRequest("http://localhost/api/classes/class-1", { title: "Updated Title" }, "PUT"),
      makeCtx("class-1")
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.title).toBe("Updated Title");
    expect(json.isFull).toBe(false);
  });

  it("notifies booked members on cancellation", async () => {
    vi.mocked(prisma.gymClass.findUnique).mockResolvedValueOnce({
      id: "class-1",
      gymId: "gym-1",
      status: "active",
      gym: { ownerId: "owner-1" },
    } as never);

    vi.mocked(prisma.booking.findMany).mockResolvedValueOnce([
      { id: "booking-1", memberId: "member-1" },
      { id: "booking-2", memberId: "member-2" },
    ] as never);

    const updatedClass = {
      id: "class-1",
      gymId: "gym-1",
      title: "Morning Gi",
      date: new Date("2024-08-01"),
      startTime: "06:00",
      endTime: "07:30",
      trainingStyle: "gi",
      skillLevel: "all-levels",
      capacity: 20,
      bookedCount: 2,
      price: 2500,
      status: "cancelled",
    };
    vi.mocked(prisma.gymClass.update).mockResolvedValueOnce(updatedClass as never);

    const consoleSpy = vi.spyOn(console, "log");

    const res = await classPUT(
      makeRequest("http://localhost/api/classes/class-1", { status: "cancelled" }, "PUT"),
      makeCtx("class-1")
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("cancelled");

    // Verify notification logs for each booked member
    expect(consoleSpy).toHaveBeenCalledTimes(2);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("member-1")
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("member-2")
    );

    consoleSpy.mockRestore();
  });

  it("does not notify when already cancelled", async () => {
    vi.mocked(prisma.gymClass.findUnique).mockResolvedValueOnce({
      id: "class-1",
      gymId: "gym-1",
      status: "cancelled",
      gym: { ownerId: "owner-1" },
    } as never);

    const updatedClass = {
      id: "class-1",
      gymId: "gym-1",
      title: "Morning Gi",
      date: new Date("2024-08-01"),
      startTime: "06:00",
      endTime: "07:30",
      trainingStyle: "gi",
      skillLevel: "all-levels",
      capacity: 20,
      bookedCount: 0,
      price: 2500,
      status: "cancelled",
    };
    vi.mocked(prisma.gymClass.update).mockResolvedValueOnce(updatedClass as never);

    const res = await classPUT(
      makeRequest("http://localhost/api/classes/class-1", { status: "cancelled" }, "PUT"),
      makeCtx("class-1")
    );
    expect(res.status).toBe(200);

    // booking.findMany should NOT have been called since class was already cancelled
    expect(prisma.booking.findMany).not.toHaveBeenCalled();
  });
});
