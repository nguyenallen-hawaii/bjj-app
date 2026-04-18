import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    gym: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    coach: {
      findMany: vi.fn(),
    },
    $queryRawUnsafe: vi.fn(),
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
import { GET as gymsGET } from "@/app/api/gyms/route";
import { GET as openMatsNearbyGET } from "@/app/api/open-mats/nearby/route";
import { GET as coachesGET } from "@/app/api/coaches/route";
import { NextRequest } from "next/server";

function makeGetRequest(url: string): NextRequest {
  return new NextRequest(url, { method: "GET" });
}

const sampleGyms = [
  {
    id: "gym-1", ownerId: "owner-1", name: "Gracie Barra Austin",
    address: "123 Main St", city: "Austin", state: "TX", zipCode: "78701",
    contactEmail: "info@gb.com", contactPhone: null,
    trainingStyles: ["gi", "no-gi"], skillLevels: ["all-levels"],
    operatingHours: [], averageRating: 4.5, createdAt: new Date(),
  },
  {
    id: "gym-2", ownerId: "owner-2", name: "10th Planet NYC",
    address: "456 Broadway", city: "New York", state: "NY", zipCode: "10001",
    contactEmail: "info@10p.com", contactPhone: null,
    trainingStyles: ["no-gi"], skillLevels: ["intermediate", "advanced"],
    operatingHours: [], averageRating: 4.8, createdAt: new Date(),
  },
  {
    id: "gym-3", ownerId: "owner-1", name: "Alliance Austin",
    address: "789 Oak Ave", city: "Austin", state: "TX", zipCode: "78702",
    contactEmail: "info@alliance.com", contactPhone: null,
    trainingStyles: ["gi", "both"], skillLevels: ["beginner", "all-levels"],
    operatingHours: [], averageRating: 4.2, createdAt: new Date(),
  },
];

describe("GET /api/gyms", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns all gyms when no filters provided", async () => {
    vi.mocked(prisma.gym.findMany).mockResolvedValueOnce(sampleGyms as never);

    const res = await gymsGET(makeGetRequest("http://localhost/api/gyms"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveLength(3);
  });

  it("filters by ownerId for dashboard", async () => {
    const ownerGyms = sampleGyms.filter((g) => g.ownerId === "owner-1");
    vi.mocked(prisma.gym.findMany).mockResolvedValueOnce(ownerGyms as never);

    const res = await gymsGET(makeGetRequest("http://localhost/api/gyms?ownerId=owner-1"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveLength(2);
    expect(prisma.gym.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerId: "owner-1" } })
    );
  });

  it("filters by state", async () => {
    const txGyms = sampleGyms.filter((g) => g.state === "TX");
    vi.mocked(prisma.gym.findMany).mockResolvedValueOnce(txGyms as never);

    const res = await gymsGET(makeGetRequest("http://localhost/api/gyms?state=TX"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveLength(2);
    expect(prisma.gym.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ state: "TX" }) })
    );
  });

  it("performs text search on gym name", async () => {
    const matched = [sampleGyms[0]];
    vi.mocked(prisma.gym.findMany).mockResolvedValueOnce(matched as never);

    const res = await gymsGET(makeGetRequest("http://localhost/api/gyms?search=Gracie"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveLength(1);
    expect(json[0].name).toBe("Gracie Barra Austin");
  });

  it("filters by trainingStyle (post-filter on JSON)", async () => {
    // Prisma returns all, then we post-filter
    vi.mocked(prisma.gym.findMany).mockResolvedValueOnce(sampleGyms as never);

    const res = await gymsGET(makeGetRequest("http://localhost/api/gyms?trainingStyle=both"));
    expect(res.status).toBe(200);
    const json = await res.json();
    // Only gym-3 has "both"
    expect(json).toHaveLength(1);
    expect(json[0].id).toBe("gym-3");
  });

  it("filters by skillLevel (post-filter on JSON)", async () => {
    vi.mocked(prisma.gym.findMany).mockResolvedValueOnce(sampleGyms as never);

    const res = await gymsGET(makeGetRequest("http://localhost/api/gyms?skillLevel=advanced"));
    expect(res.status).toBe(200);
    const json = await res.json();
    // Only gym-2 has "advanced"
    expect(json).toHaveLength(1);
    expect(json[0].id).toBe("gym-2");
  });

  it("combines state + trainingStyle filters", async () => {
    const txGyms = sampleGyms.filter((g) => g.state === "TX");
    vi.mocked(prisma.gym.findMany).mockResolvedValueOnce(txGyms as never);

    const res = await gymsGET(makeGetRequest("http://localhost/api/gyms?state=TX&trainingStyle=gi"));
    expect(res.status).toBe(200);
    const json = await res.json();
    // Both TX gyms have "gi"
    expect(json).toHaveLength(2);
  });

  it("uses PostGIS query when lat/lng provided", async () => {
    const nearbyGyms = [
      { ...sampleGyms[0], distance: 1500.5 },
      { ...sampleGyms[2], distance: 3200.1 },
    ];
    vi.mocked(prisma.$queryRawUnsafe).mockResolvedValueOnce(nearbyGyms as never);

    const res = await gymsGET(
      makeGetRequest("http://localhost/api/gyms?lat=30.2672&lng=-97.7431")
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveLength(2);
    // Should be sorted by distance (ascending)
    expect(json[0].distance).toBeLessThan(json[1].distance);
    expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining("ST_DWithin"),
      -97.7431,
      30.2672,
      50000
    );
  });

  it("uses custom radius when provided with lat/lng", async () => {
    vi.mocked(prisma.$queryRawUnsafe).mockResolvedValueOnce([] as never);

    await gymsGET(
      makeGetRequest("http://localhost/api/gyms?lat=30.2672&lng=-97.7431&radius=10000")
    );
    expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining("ST_DWithin"),
      -97.7431,
      30.2672,
      10000
    );
  });

  it("combines location + state + style filters in PostGIS query", async () => {
    vi.mocked(prisma.$queryRawUnsafe).mockResolvedValueOnce([] as never);

    await gymsGET(
      makeGetRequest("http://localhost/api/gyms?lat=30.2672&lng=-97.7431&state=TX&trainingStyle=gi")
    );
    const call = vi.mocked(prisma.$queryRawUnsafe).mock.calls[0];
    const sql = call[0] as string;
    expect(sql).toContain("ST_DWithin");
    expect(sql).toContain("g.state =");
    expect(sql).toContain(`"trainingStyles"`);
  });

  it("ignores invalid state in filter", async () => {
    vi.mocked(prisma.gym.findMany).mockResolvedValueOnce(sampleGyms as never);

    const res = await gymsGET(makeGetRequest("http://localhost/api/gyms?state=XX"));
    expect(res.status).toBe(200);
    // Invalid state is ignored, returns all gyms
    expect(prisma.gym.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.not.objectContaining({ state: "XX" }) })
    );
  });
});


describe("GET /api/open-mats/nearby", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when lat/lng missing", async () => {
    const res = await openMatsNearbyGET(makeGetRequest("http://localhost/api/open-mats/nearby"));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("validation_error");
    expect(json.fields.lat).toBeDefined();
    expect(json.fields.lng).toBeDefined();
  });

  it("returns 400 when only lat provided", async () => {
    const res = await openMatsNearbyGET(
      makeGetRequest("http://localhost/api/open-mats/nearby?lat=30.2672")
    );
    expect(res.status).toBe(400);
  });

  it("returns nearby open mats sorted by distance", async () => {
    const nearbyMats = [
      {
        id: "om-1", gymId: "gym-1", date: "2024-06-01", startTime: "10:00",
        endTime: "12:00", capacity: 30, bookedCount: 5, price: 0, status: "active",
        gymName: "Gracie Barra", gymAddress: "123 Main St", gymCity: "Austin",
        gymState: "TX", gymTrainingStyles: ["gi"], distance: 1200.5,
      },
      {
        id: "om-2", gymId: "gym-2", date: "2024-06-01", startTime: "14:00",
        endTime: "16:00", capacity: 20, bookedCount: 0, price: 500, status: "active",
        gymName: "Alliance", gymAddress: "456 Oak Ave", gymCity: "Austin",
        gymState: "TX", gymTrainingStyles: ["no-gi"], distance: 3500.2,
      },
    ];
    vi.mocked(prisma.$queryRawUnsafe).mockResolvedValueOnce(nearbyMats as never);

    const res = await openMatsNearbyGET(
      makeGetRequest("http://localhost/api/open-mats/nearby?lat=30.2672&lng=-97.7431")
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveLength(2);
    expect(json[0].distance).toBeLessThan(json[1].distance);
    expect(json[0].gymName).toBe("Gracie Barra");
  });

  it("uses default 50km radius", async () => {
    vi.mocked(prisma.$queryRawUnsafe).mockResolvedValueOnce([] as never);

    await openMatsNearbyGET(
      makeGetRequest("http://localhost/api/open-mats/nearby?lat=30.2672&lng=-97.7431")
    );
    expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining("ST_DWithin"),
      -97.7431,
      30.2672,
      50000
    );
  });

  it("uses custom radius when provided", async () => {
    vi.mocked(prisma.$queryRawUnsafe).mockResolvedValueOnce([] as never);

    await openMatsNearbyGET(
      makeGetRequest("http://localhost/api/open-mats/nearby?lat=30.2672&lng=-97.7431&radius=10000")
    );
    expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining("ST_DWithin"),
      -97.7431,
      30.2672,
      10000
    );
  });
});

describe("GET /api/coaches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns all coaches when no filters", async () => {
    const coaches = [
      {
        id: "coach-1", gymId: "gym-1", name: "Prof. Silva",
        credentials: "3rd degree black belt", beltRank: "black",
        pricePerSession: 10000,
        gym: { id: "gym-1", name: "Gracie Barra", city: "Austin", state: "TX" },
      },
      {
        id: "coach-2", gymId: "gym-2", name: "Coach Johnson",
        credentials: "ADCC competitor", beltRank: "brown",
        pricePerSession: 8000,
        gym: { id: "gym-2", name: "10th Planet", city: "New York", state: "NY" },
      },
    ];
    vi.mocked(prisma.coach.findMany).mockResolvedValueOnce(coaches as never);

    const res = await coachesGET(makeGetRequest("http://localhost/api/coaches"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveLength(2);
    expect(json[0].gym).toBeDefined();
    expect(json[0].gym.name).toBe("Gracie Barra");
  });

  it("filters coaches by search text", async () => {
    const coaches = [
      {
        id: "coach-1", gymId: "gym-1", name: "Prof. Silva",
        credentials: "3rd degree", beltRank: "black", pricePerSession: 10000,
        gym: { id: "gym-1", name: "Gracie Barra", city: "Austin", state: "TX" },
      },
    ];
    vi.mocked(prisma.coach.findMany).mockResolvedValueOnce(coaches as never);

    const res = await coachesGET(makeGetRequest("http://localhost/api/coaches?search=Silva"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveLength(1);
    expect(prisma.coach.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ name: { contains: "Silva", mode: "insensitive" } }),
          ]),
        }),
      })
    );
  });

  it("filters coaches by gymId", async () => {
    vi.mocked(prisma.coach.findMany).mockResolvedValueOnce([] as never);

    await coachesGET(makeGetRequest("http://localhost/api/coaches?gymId=gym-1"));
    expect(prisma.coach.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ gymId: "gym-1" }),
      })
    );
  });

  it("includes gym affiliation data", async () => {
    const coaches = [
      {
        id: "coach-1", gymId: "gym-1", name: "Prof. Silva",
        credentials: "3rd degree", beltRank: "black", pricePerSession: 10000,
        gym: { id: "gym-1", name: "Gracie Barra", city: "Austin", state: "TX" },
      },
    ];
    vi.mocked(prisma.coach.findMany).mockResolvedValueOnce(coaches as never);

    const res = await coachesGET(makeGetRequest("http://localhost/api/coaches"));
    const json = await res.json();
    expect(json[0].gym.id).toBe("gym-1");
    expect(json[0].gym.city).toBe("Austin");
    expect(json[0].gym.state).toBe("TX");
  });
});
