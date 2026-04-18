import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    member: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    achievement: {
      create: vi.fn(),
    },
  },
}));

// Mock password utils
vi.mock("@/lib/password", () => ({
  hashPassword: vi.fn().mockResolvedValue("hashed_password_123"),
}));

import { prisma } from "@/lib/prisma";
import { POST as registerPOST } from "@/app/api/auth/register/route";
import { GET as memberGET, PUT as memberPUT } from "@/app/api/members/[id]/route";
import { POST as achievementPOST } from "@/app/api/members/[id]/achievements/route";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeCtx(id: string): any {
  return { params: Promise.resolve({ id }) };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeAchievementCtx(id: string): any {
  return { params: Promise.resolve({ id }) };
}

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when email is missing", async () => {
    const res = await registerPOST(
      makeRequest({ password: "12345678", displayName: "Test" })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("validation_error");
    expect(json.fields.email).toBeDefined();
  });

  it("returns 400 when password is too short", async () => {
    const res = await registerPOST(
      makeRequest({ email: "test@example.com", password: "short", displayName: "Test" })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("validation_error");
    expect(json.fields.password).toContain("at least 8 characters");
  });

  it("returns 400 when displayName is missing", async () => {
    const res = await registerPOST(
      makeRequest({ email: "test@example.com", password: "12345678" })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.fields.displayName).toBeDefined();
  });

  it("returns 400 for invalid email format", async () => {
    const res = await registerPOST(
      makeRequest({ email: "notanemail", password: "12345678", displayName: "Test" })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.fields.email).toContain("Invalid email");
  });

  it("returns 409 when email already exists", async () => {
    vi.mocked(prisma.member.findUnique).mockResolvedValueOnce({
      id: "existing-id",
      email: "test@example.com",
    } as never);

    const res = await registerPOST(
      makeRequest({ email: "test@example.com", password: "12345678", displayName: "Test" })
    );
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toBe("conflict");
  });

  it("returns 201 on successful registration", async () => {
    vi.mocked(prisma.member.findUnique).mockResolvedValueOnce(null);
    vi.mocked(prisma.member.create).mockResolvedValueOnce({
      id: "new-id",
      email: "test@example.com",
      displayName: "Test User",
      createdAt: new Date("2024-01-01"),
    } as never);

    const res = await registerPOST(
      makeRequest({ email: "test@example.com", password: "12345678", displayName: "Test User" })
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.id).toBe("new-id");
    expect(json.email).toBe("test@example.com");
    expect(json.displayName).toBe("Test User");
  });

  it("lowercases email before storing", async () => {
    vi.mocked(prisma.member.findUnique).mockResolvedValueOnce(null);
    vi.mocked(prisma.member.create).mockResolvedValueOnce({
      id: "new-id",
      email: "test@example.com",
      displayName: "Test",
      createdAt: new Date(),
    } as never);

    await registerPOST(
      makeRequest({ email: "Test@Example.COM", password: "12345678", displayName: "Test" })
    );

    expect(prisma.member.findUnique).toHaveBeenCalledWith({
      where: { email: "test@example.com" },
    });
  });
});

describe("GET /api/members/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when member not found", async () => {
    vi.mocked(prisma.member.findUnique).mockResolvedValueOnce(null);
    const req = new Request("http://localhost/api/members/nonexistent") as never;
    const res = await memberGET(req, makeCtx("nonexistent"));
    expect(res.status).toBe(404);
  });

  it("returns member profile with achievements", async () => {
    vi.mocked(prisma.member.findUnique).mockResolvedValueOnce({
      id: "member-1",
      email: "test@example.com",
      displayName: "Test User",
      profilePhoto: null,
      beltRank: "blue",
      trainingHistory: "5 years",
      averageRating: 4.5,
      createdAt: new Date("2024-01-01"),
      achievements: [
        { id: "ach-1", type: "belt_rank", title: "Blue Belt", description: null, date: null },
      ],
    } as never);

    const req = new Request("http://localhost/api/members/member-1") as never;
    const res = await memberGET(req, makeCtx("member-1"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.displayName).toBe("Test User");
    expect(json.achievements).toHaveLength(1);
    expect(json.achievements[0].title).toBe("Blue Belt");
  });
});

describe("PUT /api/members/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when member not found", async () => {
    vi.mocked(prisma.member.findUnique).mockResolvedValueOnce(null);
    const req = new Request("http://localhost/api/members/nonexistent", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ beltRank: "purple" }),
    }) as never;
    const res = await memberPUT(req, makeCtx("nonexistent"));
    expect(res.status).toBe(404);
  });

  it("returns 400 for empty displayName", async () => {
    vi.mocked(prisma.member.findUnique).mockResolvedValueOnce({ id: "m1" } as never);
    const req = new Request("http://localhost/api/members/m1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "   " }),
    }) as never;
    const res = await memberPUT(req, makeCtx("m1"));
    expect(res.status).toBe(400);
  });

  it("updates profile fields successfully", async () => {
    vi.mocked(prisma.member.findUnique).mockResolvedValueOnce({ id: "m1" } as never);
    vi.mocked(prisma.member.update).mockResolvedValueOnce({
      id: "m1",
      email: "test@example.com",
      displayName: "Updated",
      profilePhoto: null,
      beltRank: "purple",
      trainingHistory: "10 years",
      averageRating: 0,
      createdAt: new Date(),
    } as never);

    const req = new Request("http://localhost/api/members/m1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ beltRank: "purple", trainingHistory: "10 years" }),
    }) as never;
    const res = await memberPUT(req, makeCtx("m1"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.beltRank).toBe("purple");
  });
});

describe("POST /api/members/[id]/achievements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when member not found", async () => {
    vi.mocked(prisma.member.findUnique).mockResolvedValueOnce(null);
    const req = new Request("http://localhost/api/members/nonexistent/achievements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "belt_rank", title: "Blue Belt" }),
    }) as never;
    const res = await achievementPOST(req, makeAchievementCtx("nonexistent"));
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid achievement type", async () => {
    vi.mocked(prisma.member.findUnique).mockResolvedValueOnce({ id: "m1" } as never);
    const req = new Request("http://localhost/api/members/m1/achievements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "invalid_type", title: "Test" }),
    }) as never;
    const res = await achievementPOST(req, makeAchievementCtx("m1"));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.fields.type).toBeDefined();
  });

  it("returns 400 when title is missing", async () => {
    vi.mocked(prisma.member.findUnique).mockResolvedValueOnce({ id: "m1" } as never);
    const req = new Request("http://localhost/api/members/m1/achievements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "competition" }),
    }) as never;
    const res = await achievementPOST(req, makeAchievementCtx("m1"));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.fields.title).toBeDefined();
  });

  it("creates achievement successfully", async () => {
    vi.mocked(prisma.member.findUnique).mockResolvedValueOnce({ id: "m1" } as never);
    vi.mocked(prisma.achievement.create).mockResolvedValueOnce({
      id: "ach-1",
      type: "competition",
      title: "Gold Medal",
      description: "Won first place",
      date: new Date("2024-06-01"),
    } as never);

    const req = new Request("http://localhost/api/members/m1/achievements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "competition",
        title: "Gold Medal",
        description: "Won first place",
        date: "2024-06-01",
      }),
    }) as never;
    const res = await achievementPOST(req, makeAchievementCtx("m1"));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.title).toBe("Gold Medal");
    expect(json.type).toBe("competition");
  });
});
