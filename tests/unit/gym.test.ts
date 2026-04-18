import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    gym: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    gymPhoto: {
      create: vi.fn(),
    },
    review: {
      findMany: vi.fn(),
    },
    $executeRawUnsafe: vi.fn(),
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
import { POST as gymPOST } from "@/app/api/gyms/route";
import { GET as gymGET, PUT as gymPUT } from "@/app/api/gyms/[id]/route";
import { POST as photoPOST } from "@/app/api/gyms/[id]/photos/route";
import { isValidUSState, VALID_US_STATES } from "@/lib/us-states";
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

const validGymInput = {
  name: "Gracie Barra",
  address: "123 Main St",
  city: "Austin",
  state: "TX",
  zipCode: "78701",
  contactEmail: "info@graciebarra.com",
  trainingStyles: ["gi", "no-gi"],
  operatingHours: [{ dayOfWeek: 1, openTime: "06:00", closeTime: "21:00" }],
  latitude: 30.2672,
  longitude: -97.7431,
};

const mockSession = {
  user: { id: "owner-1", email: "owner@test.com", name: "Owner", isGymOwner: true },
};

describe("US State Validation", () => {
  it("accepts all 50 states + DC", () => {
    const states = [
      "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
      "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
      "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
      "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
      "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
      "DC",
    ];
    for (const s of states) {
      expect(isValidUSState(s)).toBe(true);
    }
    expect(VALID_US_STATES.size).toBe(51);
  });

  it("rejects invalid state codes", () => {
    expect(isValidUSState("XX")).toBe(false);
    expect(isValidUSState("")).toBe(false);
    expect(isValidUSState("USA")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isValidUSState("tx")).toBe(true);
    expect(isValidUSState("Ny")).toBe(true);
  });
});

describe("POST /api/gyms", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireSession).mockResolvedValue(mockSession as never);
  });

  it("returns 401 when not authenticated", async () => {
    const { AuthError } = await import("@/lib/auth-helpers");
    vi.mocked(requireSession).mockRejectedValueOnce(new AuthError("unauthorized"));

    const res = await gymPOST(makeRequest("http://localhost/api/gyms", validGymInput));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("unauthorized");
  });

  it("returns 400 when name is missing", async () => {
    const res = await gymPOST(
      makeRequest("http://localhost/api/gyms", { ...validGymInput, name: "" })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("validation_error");
    expect(json.fields.name).toBeDefined();
  });

  it("returns 400 when address is missing", async () => {
    const res = await gymPOST(
      makeRequest("http://localhost/api/gyms", { ...validGymInput, address: "" })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.fields.address).toBeDefined();
  });

  it("returns 400 when state is invalid", async () => {
    const res = await gymPOST(
      makeRequest("http://localhost/api/gyms", { ...validGymInput, state: "XX" })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.fields.state).toContain("Invalid US state");
  });

  it("returns 400 when state is missing", async () => {
    const res = await gymPOST(
      makeRequest("http://localhost/api/gyms", { ...validGymInput, state: "" })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.fields.state).toBeDefined();
  });

  it("returns 400 when contactEmail is missing", async () => {
    const res = await gymPOST(
      makeRequest("http://localhost/api/gyms", { ...validGymInput, contactEmail: "" })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.fields.contactEmail).toBeDefined();
  });

  it("returns 400 when trainingStyles is empty", async () => {
    const res = await gymPOST(
      makeRequest("http://localhost/api/gyms", { ...validGymInput, trainingStyles: [] })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.fields.trainingStyles).toBeDefined();
  });

  it("returns 400 when operatingHours is empty", async () => {
    const res = await gymPOST(
      makeRequest("http://localhost/api/gyms", { ...validGymInput, operatingHours: [] })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.fields.operatingHours).toBeDefined();
  });

  it("returns 400 with multiple field errors", async () => {
    const res = await gymPOST(
      makeRequest("http://localhost/api/gyms", {})
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("validation_error");
    expect(Object.keys(json.fields).length).toBeGreaterThan(1);
  });

  it("returns 201 on successful gym creation", async () => {
    const createdGym = {
      id: "gym-1",
      ownerId: "owner-1",
      name: "Gracie Barra",
      address: "123 Main St",
      city: "Austin",
      state: "TX",
      zipCode: "78701",
      contactEmail: "info@graciebarra.com",
      contactPhone: null,
      trainingStyles: ["gi", "no-gi"],
      skillLevels: [],
      operatingHours: [{ dayOfWeek: 1, openTime: "06:00", closeTime: "21:00" }],
      averageRating: 0,
      createdAt: new Date(),
    };
    vi.mocked(prisma.gym.create).mockResolvedValueOnce(createdGym as never);

    const res = await gymPOST(makeRequest("http://localhost/api/gyms", validGymInput));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.name).toBe("Gracie Barra");
    expect(json.state).toBe("TX");
  });

  it("sets PostGIS point when lat/lng provided", async () => {
    const createdGym = {
      id: "gym-1",
      ownerId: "owner-1",
      name: "Gracie Barra",
      address: "123 Main St",
      city: "Austin",
      state: "TX",
      zipCode: "78701",
      contactEmail: "info@graciebarra.com",
      contactPhone: null,
      trainingStyles: ["gi", "no-gi"],
      skillLevels: [],
      operatingHours: [{ dayOfWeek: 1, openTime: "06:00", closeTime: "21:00" }],
      averageRating: 0,
      createdAt: new Date(),
    };
    vi.mocked(prisma.gym.create).mockResolvedValueOnce(createdGym as never);

    await gymPOST(makeRequest("http://localhost/api/gyms", validGymInput));

    expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining("ST_MakePoint"),
      -97.7431,
      30.2672,
      "gym-1"
    );
  });

  it("uppercases state code", async () => {
    const createdGym = {
      id: "gym-1",
      ownerId: "owner-1",
      name: "Test Gym",
      address: "123 Main St",
      city: "Austin",
      state: "TX",
      zipCode: "78701",
      contactEmail: "info@test.com",
      contactPhone: null,
      trainingStyles: ["gi"],
      skillLevels: [],
      operatingHours: [{ dayOfWeek: 1, openTime: "06:00", closeTime: "21:00" }],
      averageRating: 0,
      createdAt: new Date(),
    };
    vi.mocked(prisma.gym.create).mockResolvedValueOnce(createdGym as never);

    await gymPOST(
      makeRequest("http://localhost/api/gyms", { ...validGymInput, state: "tx" })
    );

    expect(prisma.gym.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ state: "TX" }),
      })
    );
  });
});

describe("GET /api/gyms/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when gym not found", async () => {
    vi.mocked(prisma.gym.findUnique).mockResolvedValueOnce(null);
    const req = new Request("http://localhost/api/gyms/nonexistent") as unknown as NextRequest;
    const res = await gymGET(req, makeCtx("nonexistent"));
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("not_found");
  });

  it("returns gym detail with related data", async () => {
    const gymData = {
      id: "gym-1",
      ownerId: "owner-1",
      name: "Gracie Barra",
      address: "123 Main St",
      city: "Austin",
      state: "TX",
      zipCode: "78701",
      contactEmail: "info@graciebarra.com",
      contactPhone: null,
      trainingStyles: ["gi", "no-gi"],
      skillLevels: ["all-levels"],
      operatingHours: [{ dayOfWeek: 1, openTime: "06:00", closeTime: "21:00" }],
      averageRating: 4.5,
      createdAt: new Date("2024-01-01"),
      photos: [{ id: "p1", url: "https://example.com/photo.jpg", sortOrder: 0, createdAt: new Date() }],
      classes: [
        {
          id: "c1",
          title: "Morning Gi",
          date: new Date("2024-06-01"),
          startTime: "06:00",
          endTime: "07:30",
          trainingStyle: "gi",
          skillLevel: "all-levels",
          capacity: 20,
          bookedCount: 5,
          price: 2500,
          status: "active",
        },
      ],
      openMats: [],
      coaches: [
        { id: "coach-1", name: "Prof. Silva", credentials: "3rd degree", beltRank: "black", pricePerSession: 10000 },
      ],
    };
    vi.mocked(prisma.gym.findUnique).mockResolvedValueOnce(gymData as never);
    vi.mocked(prisma.review.findMany).mockResolvedValueOnce([
      {
        id: "r1",
        authorId: "member-1",
        rating: 5,
        text: "Great gym!",
        createdAt: new Date(),
        author: { id: "member-1", displayName: "John", profilePhoto: null },
      },
    ] as never);

    const req = new Request("http://localhost/api/gyms/gym-1") as unknown as NextRequest;
    const res = await gymGET(req, makeCtx("gym-1"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.name).toBe("Gracie Barra");
    expect(json.photos).toHaveLength(1);
    expect(json.classes).toHaveLength(1);
    expect(json.coaches).toHaveLength(1);
    expect(json.reviews).toHaveLength(1);
    expect(json.reviews[0].rating).toBe(5);
  });
});

describe("PUT /api/gyms/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireSession).mockResolvedValue(mockSession as never);
  });

  it("returns 401 when not authenticated", async () => {
    const { AuthError } = await import("@/lib/auth-helpers");
    vi.mocked(requireSession).mockRejectedValueOnce(new AuthError("unauthorized"));

    const res = await gymPUT(
      makeRequest("http://localhost/api/gyms/gym-1", { name: "Updated" }, "PUT"),
      makeCtx("gym-1")
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 when gym not found", async () => {
    vi.mocked(prisma.gym.findUnique).mockResolvedValueOnce(null);
    const res = await gymPUT(
      makeRequest("http://localhost/api/gyms/nonexistent", { name: "Updated" }, "PUT"),
      makeCtx("nonexistent")
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 when user is not the owner", async () => {
    vi.mocked(prisma.gym.findUnique).mockResolvedValueOnce({
      id: "gym-1",
      ownerId: "other-owner",
    } as never);

    const res = await gymPUT(
      makeRequest("http://localhost/api/gyms/gym-1", { name: "Updated" }, "PUT"),
      makeCtx("gym-1")
    );
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe("forbidden");
  });

  it("returns 400 for invalid state on update", async () => {
    vi.mocked(prisma.gym.findUnique).mockResolvedValueOnce({
      id: "gym-1",
      ownerId: "owner-1",
    } as never);

    const res = await gymPUT(
      makeRequest("http://localhost/api/gyms/gym-1", { state: "XX" }, "PUT"),
      makeCtx("gym-1")
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.fields.state).toContain("Invalid US state");
  });

  it("updates gym successfully", async () => {
    vi.mocked(prisma.gym.findUnique).mockResolvedValueOnce({
      id: "gym-1",
      ownerId: "owner-1",
    } as never);
    vi.mocked(prisma.gym.update).mockResolvedValueOnce({
      id: "gym-1",
      ownerId: "owner-1",
      name: "Updated Gym",
      address: "123 Main St",
      city: "Austin",
      state: "TX",
      zipCode: "78701",
      contactEmail: "info@test.com",
      contactPhone: null,
      trainingStyles: ["gi"],
      skillLevels: [],
      operatingHours: [],
      averageRating: 0,
      createdAt: new Date(),
    } as never);

    const res = await gymPUT(
      makeRequest("http://localhost/api/gyms/gym-1", { name: "Updated Gym" }, "PUT"),
      makeCtx("gym-1")
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.name).toBe("Updated Gym");
  });
});

describe("POST /api/gyms/[id]/photos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireSession).mockResolvedValue(mockSession as never);
  });

  it("returns 401 when not authenticated", async () => {
    const { AuthError } = await import("@/lib/auth-helpers");
    vi.mocked(requireSession).mockRejectedValueOnce(new AuthError("unauthorized"));

    const res = await photoPOST(
      makeRequest("http://localhost/api/gyms/gym-1/photos", { url: "https://example.com/photo.jpg" }),
      makeCtx("gym-1")
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 when gym not found", async () => {
    vi.mocked(prisma.gym.findUnique).mockResolvedValueOnce(null);
    const res = await photoPOST(
      makeRequest("http://localhost/api/gyms/nonexistent/photos", { url: "https://example.com/photo.jpg" }),
      makeCtx("nonexistent")
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 when user is not the owner", async () => {
    vi.mocked(prisma.gym.findUnique).mockResolvedValueOnce({
      id: "gym-1",
      ownerId: "other-owner",
    } as never);

    const res = await photoPOST(
      makeRequest("http://localhost/api/gyms/gym-1/photos", { url: "https://example.com/photo.jpg" }),
      makeCtx("gym-1")
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 when url is missing", async () => {
    vi.mocked(prisma.gym.findUnique).mockResolvedValueOnce({
      id: "gym-1",
      ownerId: "owner-1",
    } as never);

    const res = await photoPOST(
      makeRequest("http://localhost/api/gyms/gym-1/photos", {}),
      makeCtx("gym-1")
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.fields.url).toBeDefined();
  });

  it("creates photo successfully", async () => {
    vi.mocked(prisma.gym.findUnique).mockResolvedValueOnce({
      id: "gym-1",
      ownerId: "owner-1",
    } as never);
    vi.mocked(prisma.gymPhoto.create).mockResolvedValueOnce({
      id: "photo-1",
      gymId: "gym-1",
      url: "https://example.com/photo.jpg",
      sortOrder: 0,
      createdAt: new Date(),
    } as never);

    const res = await photoPOST(
      makeRequest("http://localhost/api/gyms/gym-1/photos", { url: "https://example.com/photo.jpg" }),
      makeCtx("gym-1")
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.url).toBe("https://example.com/photo.jpg");
  });
});
