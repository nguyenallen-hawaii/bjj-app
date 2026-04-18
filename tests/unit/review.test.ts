import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ─────────────────────────────────────────────────────────────────────

const mockReviewCreate = vi.fn();
const mockReviewFindUnique = vi.fn();
const mockReviewFindMany = vi.fn();
const mockReviewAggregate = vi.fn();
const mockGymFindUnique = vi.fn();
const mockGymUpdate = vi.fn();
const mockGymFindFirst = vi.fn();
const mockMemberFindUnique = vi.fn();
const mockMemberUpdate = vi.fn();
const mockGymClassFindMany = vi.fn();
const mockOpenMatFindMany = vi.fn();
const mockBookingFindFirst = vi.fn();
const mockTransaction = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    review: {
      create: (...args: unknown[]) => mockReviewCreate(...args),
      findUnique: (...args: unknown[]) => mockReviewFindUnique(...args),
      findMany: (...args: unknown[]) => mockReviewFindMany(...args),
      aggregate: (...args: unknown[]) => mockReviewAggregate(...args),
    },
    gym: {
      findUnique: (...args: unknown[]) => mockGymFindUnique(...args),
      update: (...args: unknown[]) => mockGymUpdate(...args),
      findFirst: (...args: unknown[]) => mockGymFindFirst(...args),
    },
    member: {
      findUnique: (...args: unknown[]) => mockMemberFindUnique(...args),
      update: (...args: unknown[]) => mockMemberUpdate(...args),
    },
    gymClass: {
      findMany: (...args: unknown[]) => mockGymClassFindMany(...args),
    },
    openMat: {
      findMany: (...args: unknown[]) => mockOpenMatFindMany(...args),
    },
    booking: {
      findFirst: (...args: unknown[]) => mockBookingFindFirst(...args),
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
import {
  POST as postGymReview,
  GET as getGymReviews,
} from "@/app/api/gyms/[id]/reviews/route";
import {
  POST as postMemberReview,
  GET as getMemberReviews,
} from "@/app/api/members/[id]/reviews/route";
import type { NextRequest } from "next/server";

function makeRequest(url: string, body?: unknown, method = "POST"): NextRequest {
  const init: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body !== undefined) init.body = JSON.stringify(body);
  return new Request(url, init) as unknown as NextRequest;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeCtx(id: string): any {
  return { params: Promise.resolve({ id }) };
}

const memberSession = {
  user: { id: "member-1", email: "member@test.com", name: "Member" },
};

const ownerSession = {
  user: { id: "owner-1", email: "owner@test.com", name: "Owner" },
};

// ─── POST /api/gyms/[id]/reviews — Create Gym Review ──────────────────────────

describe("POST /api/gyms/[id]/reviews", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireSession).mockResolvedValue(memberSession as never);
  });

  it("returns 401 when not authenticated", async () => {
    const { AuthError } = await import("@/lib/auth-helpers");
    vi.mocked(requireSession).mockRejectedValueOnce(
      new AuthError("unauthorized")
    );

    const res = await postGymReview(
      makeRequest("http://localhost/api/gyms/gym-1/reviews", { rating: 5 }),
      makeCtx("gym-1")
    );
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("unauthorized");
  });

  it("returns 400 when rating is missing", async () => {
    const res = await postGymReview(
      makeRequest("http://localhost/api/gyms/gym-1/reviews", {}),
      makeCtx("gym-1")
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("validation_error");
    expect(json.fields.rating).toBeDefined();
  });

  it("returns 400 when rating is below 1", async () => {
    const res = await postGymReview(
      makeRequest("http://localhost/api/gyms/gym-1/reviews", { rating: 0 }),
      makeCtx("gym-1")
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.fields.rating).toBeDefined();
  });

  it("returns 400 when rating is above 5", async () => {
    const res = await postGymReview(
      makeRequest("http://localhost/api/gyms/gym-1/reviews", { rating: 6 }),
      makeCtx("gym-1")
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.fields.rating).toBeDefined();
  });

  it("returns 400 when rating is not an integer", async () => {
    const res = await postGymReview(
      makeRequest("http://localhost/api/gyms/gym-1/reviews", { rating: 3.5 }),
      makeCtx("gym-1")
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.fields.rating).toBeDefined();
  });

  it("returns 404 when gym does not exist", async () => {
    mockGymFindUnique.mockResolvedValueOnce(null);

    const res = await postGymReview(
      makeRequest("http://localhost/api/gyms/nonexistent/reviews", {
        rating: 4,
      }),
      makeCtx("nonexistent")
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 when member has no completed booking at gym", async () => {
    mockGymFindUnique.mockResolvedValueOnce({ id: "gym-1" });

    mockTransaction.mockImplementationOnce(async (fn: Function) => {
      const tx = {
        gymClass: {
          findMany: vi.fn().mockResolvedValueOnce([{ id: "class-1" }]),
        },
        openMat: { findMany: vi.fn().mockResolvedValueOnce([]) },
        booking: { findFirst: vi.fn().mockResolvedValueOnce(null) },
        review: { findUnique: vi.fn(), create: vi.fn(), aggregate: vi.fn() },
        gym: { update: vi.fn() },
      };
      return fn(tx);
    });

    const res = await postGymReview(
      makeRequest("http://localhost/api/gyms/gym-1/reviews", { rating: 4 }),
      makeCtx("gym-1")
    );
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe("forbidden");
  });

  it("returns 409 when member already reviewed this gym", async () => {
    mockGymFindUnique.mockResolvedValueOnce({ id: "gym-1" });

    mockTransaction.mockImplementationOnce(async (fn: Function) => {
      const tx = {
        gymClass: {
          findMany: vi.fn().mockResolvedValueOnce([{ id: "class-1" }]),
        },
        openMat: { findMany: vi.fn().mockResolvedValueOnce([]) },
        booking: {
          findFirst: vi
            .fn()
            .mockResolvedValueOnce({ id: "booking-1", status: "confirmed" }),
        },
        review: {
          findUnique: vi
            .fn()
            .mockResolvedValueOnce({ id: "existing-review" }),
          create: vi.fn(),
          aggregate: vi.fn(),
        },
        gym: { update: vi.fn() },
      };
      return fn(tx);
    });

    const res = await postGymReview(
      makeRequest("http://localhost/api/gyms/gym-1/reviews", { rating: 5 }),
      makeCtx("gym-1")
    );
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toBe("conflict");
  });

  it("creates gym review with valid data and updates average rating", async () => {
    mockGymFindUnique.mockResolvedValueOnce({ id: "gym-1" });

    const createdReview = {
      id: "review-1",
      authorId: "member-1",
      authorType: "member",
      targetId: "gym-1",
      targetType: "gym",
      rating: 4,
      text: "Great gym!",
      createdAt: new Date(),
    };

    mockTransaction.mockImplementationOnce(async (fn: Function) => {
      const tx = {
        gymClass: {
          findMany: vi.fn().mockResolvedValueOnce([{ id: "class-1" }]),
        },
        openMat: { findMany: vi.fn().mockResolvedValueOnce([]) },
        booking: {
          findFirst: vi
            .fn()
            .mockResolvedValueOnce({ id: "booking-1", status: "confirmed" }),
        },
        review: {
          findUnique: vi.fn().mockResolvedValueOnce(null),
          create: vi.fn().mockResolvedValueOnce(createdReview),
          aggregate: vi
            .fn()
            .mockResolvedValueOnce({ _avg: { rating: 4.0 } }),
        },
        gym: { update: vi.fn().mockResolvedValueOnce({}) },
      };
      return fn(tx);
    });

    const res = await postGymReview(
      makeRequest("http://localhost/api/gyms/gym-1/reviews", {
        rating: 4,
        text: "Great gym!",
      }),
      makeCtx("gym-1")
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.rating).toBe(4);
    expect(json.text).toBe("Great gym!");
    expect(json.authorType).toBe("member");
    expect(json.targetType).toBe("gym");
  });

  it("creates gym review with rating only (no text)", async () => {
    mockGymFindUnique.mockResolvedValueOnce({ id: "gym-1" });

    const createdReview = {
      id: "review-2",
      authorId: "member-1",
      authorType: "member",
      targetId: "gym-1",
      targetType: "gym",
      rating: 3,
      text: null,
      createdAt: new Date(),
    };

    mockTransaction.mockImplementationOnce(async (fn: Function) => {
      const tx = {
        gymClass: {
          findMany: vi.fn().mockResolvedValueOnce([{ id: "class-1" }]),
        },
        openMat: { findMany: vi.fn().mockResolvedValueOnce([]) },
        booking: {
          findFirst: vi
            .fn()
            .mockResolvedValueOnce({ id: "booking-1", status: "confirmed" }),
        },
        review: {
          findUnique: vi.fn().mockResolvedValueOnce(null),
          create: vi.fn().mockResolvedValueOnce(createdReview),
          aggregate: vi
            .fn()
            .mockResolvedValueOnce({ _avg: { rating: 3.0 } }),
        },
        gym: { update: vi.fn().mockResolvedValueOnce({}) },
      };
      return fn(tx);
    });

    const res = await postGymReview(
      makeRequest("http://localhost/api/gyms/gym-1/reviews", { rating: 3 }),
      makeCtx("gym-1")
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.rating).toBe(3);
    expect(json.text).toBeNull();
  });
});

// ─── GET /api/gyms/[id]/reviews — List Gym Reviews ────────────────────────────

describe("GET /api/gyms/[id]/reviews", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when gym does not exist", async () => {
    mockGymFindUnique.mockResolvedValueOnce(null);

    const res = await getGymReviews(
      makeRequest("http://localhost/api/gyms/nonexistent/reviews", undefined, "GET"),
      makeCtx("nonexistent")
    );
    expect(res.status).toBe(404);
  });

  it("returns reviews for a gym", async () => {
    mockGymFindUnique.mockResolvedValueOnce({ id: "gym-1" });
    mockReviewFindMany.mockResolvedValueOnce([
      {
        id: "r1",
        authorId: "member-1",
        rating: 5,
        text: "Awesome!",
        createdAt: new Date(),
        author: { id: "member-1", displayName: "John", profilePhoto: null },
      },
      {
        id: "r2",
        authorId: "member-2",
        rating: 3,
        text: null,
        createdAt: new Date(),
        author: { id: "member-2", displayName: "Jane", profilePhoto: null },
      },
    ]);

    const res = await getGymReviews(
      makeRequest("http://localhost/api/gyms/gym-1/reviews", undefined, "GET"),
      makeCtx("gym-1")
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveLength(2);
    expect(json[0].rating).toBe(5);
    expect(json[1].rating).toBe(3);
  });

  it("returns empty array when gym has no reviews", async () => {
    mockGymFindUnique.mockResolvedValueOnce({ id: "gym-1" });
    mockReviewFindMany.mockResolvedValueOnce([]);

    const res = await getGymReviews(
      makeRequest("http://localhost/api/gyms/gym-1/reviews", undefined, "GET"),
      makeCtx("gym-1")
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveLength(0);
  });
});

// ─── POST /api/members/[id]/reviews — Create Member Review ────────────────────

describe("POST /api/members/[id]/reviews", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireSession).mockResolvedValue(ownerSession as never);
  });

  it("returns 401 when not authenticated", async () => {
    const { AuthError } = await import("@/lib/auth-helpers");
    vi.mocked(requireSession).mockRejectedValueOnce(
      new AuthError("unauthorized")
    );

    const res = await postMemberReview(
      makeRequest("http://localhost/api/members/member-1/reviews", {
        rating: 4,
      }),
      makeCtx("member-1")
    );
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("unauthorized");
  });

  it("returns 400 when rating is missing", async () => {
    const res = await postMemberReview(
      makeRequest("http://localhost/api/members/member-1/reviews", {}),
      makeCtx("member-1")
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.fields.rating).toBeDefined();
  });

  it("returns 400 when rating is not an integer between 1-5", async () => {
    const res = await postMemberReview(
      makeRequest("http://localhost/api/members/member-1/reviews", {
        rating: 7,
      }),
      makeCtx("member-1")
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.fields.rating).toBeDefined();
  });

  it("returns 404 when target member does not exist", async () => {
    mockMemberFindUnique.mockResolvedValueOnce(null);

    const res = await postMemberReview(
      makeRequest("http://localhost/api/members/nonexistent/reviews", {
        rating: 4,
      }),
      makeCtx("nonexistent")
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 when author is not a gym owner", async () => {
    mockMemberFindUnique.mockResolvedValueOnce({ id: "member-1" });
    mockGymFindFirst.mockResolvedValueOnce(null);

    const res = await postMemberReview(
      makeRequest("http://localhost/api/members/member-1/reviews", {
        rating: 4,
      }),
      makeCtx("member-1")
    );
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe("forbidden");
  });

  it("returns 409 when gym owner already reviewed this member", async () => {
    mockMemberFindUnique.mockResolvedValueOnce({ id: "member-1" });
    mockGymFindFirst.mockResolvedValueOnce({ id: "gym-1", ownerId: "owner-1" });

    mockTransaction.mockImplementationOnce(async (fn: Function) => {
      const tx = {
        review: {
          findUnique: vi
            .fn()
            .mockResolvedValueOnce({ id: "existing-review" }),
          create: vi.fn(),
          aggregate: vi.fn(),
        },
        member: { update: vi.fn() },
      };
      return fn(tx);
    });

    const res = await postMemberReview(
      makeRequest("http://localhost/api/members/member-1/reviews", {
        rating: 5,
      }),
      makeCtx("member-1")
    );
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toBe("conflict");
  });

  it("creates member review and updates average rating", async () => {
    mockMemberFindUnique.mockResolvedValueOnce({ id: "member-1" });
    mockGymFindFirst.mockResolvedValueOnce({ id: "gym-1", ownerId: "owner-1" });

    const createdReview = {
      id: "review-3",
      authorId: "owner-1",
      authorType: "gym_owner",
      targetId: "member-1",
      targetType: "member",
      rating: 5,
      text: "Great training partner",
      createdAt: new Date(),
    };

    mockTransaction.mockImplementationOnce(async (fn: Function) => {
      const tx = {
        review: {
          findUnique: vi.fn().mockResolvedValueOnce(null),
          create: vi.fn().mockResolvedValueOnce(createdReview),
          aggregate: vi
            .fn()
            .mockResolvedValueOnce({ _avg: { rating: 5.0 } }),
        },
        member: { update: vi.fn().mockResolvedValueOnce({}) },
      };
      return fn(tx);
    });

    const res = await postMemberReview(
      makeRequest("http://localhost/api/members/member-1/reviews", {
        rating: 5,
        text: "Great training partner",
      }),
      makeCtx("member-1")
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.rating).toBe(5);
    expect(json.authorType).toBe("gym_owner");
    expect(json.targetType).toBe("member");
  });
});

// ─── GET /api/members/[id]/reviews — List Member Reviews ──────────────────────

describe("GET /api/members/[id]/reviews", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when member does not exist", async () => {
    mockMemberFindUnique.mockResolvedValueOnce(null);

    const res = await getMemberReviews(
      makeRequest(
        "http://localhost/api/members/nonexistent/reviews",
        undefined,
        "GET"
      ),
      makeCtx("nonexistent")
    );
    expect(res.status).toBe(404);
  });

  it("returns reviews for a member", async () => {
    mockMemberFindUnique.mockResolvedValueOnce({ id: "member-1" });
    mockReviewFindMany.mockResolvedValueOnce([
      {
        id: "r1",
        authorId: "owner-1",
        rating: 4,
        text: "Good student",
        createdAt: new Date(),
        author: { id: "owner-1", displayName: "Coach", profilePhoto: null },
      },
    ]);

    const res = await getMemberReviews(
      makeRequest(
        "http://localhost/api/members/member-1/reviews",
        undefined,
        "GET"
      ),
      makeCtx("member-1")
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveLength(1);
    expect(json[0].rating).toBe(4);
  });

  it("returns empty array when member has no reviews", async () => {
    mockMemberFindUnique.mockResolvedValueOnce({ id: "member-1" });
    mockReviewFindMany.mockResolvedValueOnce([]);

    const res = await getMemberReviews(
      makeRequest(
        "http://localhost/api/members/member-1/reviews",
        undefined,
        "GET"
      ),
      makeCtx("member-1")
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveLength(0);
  });
});
