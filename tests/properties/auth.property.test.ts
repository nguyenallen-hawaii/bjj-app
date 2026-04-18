import { describe, expect, vi, beforeEach } from "vitest";
import { test } from "@fast-check/vitest";
import fc from "fast-check";
import {
  validEmailArb,
  displayNameArb,
  validPasswordArb,
  invalidPasswordArb,
  beltRankArb,
} from "../helpers/arbitraries";

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
import { GET as memberGET } from "@/app/api/members/[id]/route";
import { POST as achievementPOST } from "@/app/api/members/[id]/achievements/route";

function makeRegisterRequest(body: unknown): Request {
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

const ACHIEVEMENT_TYPES = ["belt_rank", "competition", "seminar", "other"] as const;

const achievementTypeArb = fc.constantFrom(...ACHIEVEMENT_TYPES);

const achievementTitleArb = fc
  .stringMatching(/^[A-Za-z][A-Za-z0-9 ]{0,29}$/)
  .filter((s) => s.trim().length > 0);

describe("Auth property tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Feature: bjj-gym-booking-platform, Property 1: Registration creates retrievable member
  // **Validates: Requirements 1.1**
  test.prop([validEmailArb, validPasswordArb, displayNameArb])(
    "Property 1: Registration creates retrievable member",
    async (email, password, displayName) => {
      const memberId = "generated-id-" + email;
      const createdAt = new Date("2024-01-01");

      // Mock: no existing member with this email
      vi.mocked(prisma.member.findUnique).mockResolvedValueOnce(null);

      // Mock: member creation returns the new member
      vi.mocked(prisma.member.create).mockResolvedValueOnce({
        id: memberId,
        email: email.toLowerCase(),
        displayName: displayName.trim(),
        createdAt,
      } as never);

      // Register the member
      const registerRes = await registerPOST(
        makeRegisterRequest({ email, password, displayName })
      );
      expect(registerRes.status).toBe(201);
      const registered = await registerRes.json();

      // Mock: querying by id returns the member with achievements
      vi.mocked(prisma.member.findUnique).mockResolvedValueOnce({
        id: memberId,
        email: email.toLowerCase(),
        displayName: displayName.trim(),
        profilePhoto: null,
        beltRank: null,
        trainingHistory: null,
        averageRating: 0,
        createdAt,
        achievements: [],
      } as never);

      // Retrieve the member
      const getReq = new Request(`http://localhost/api/members/${memberId}`) as never;
      const getRes = await memberGET(getReq, makeCtx(memberId));
      expect(getRes.status).toBe(200);
      const retrieved = await getRes.json();

      // The retrieved member should match the registered data
      expect(retrieved.email).toBe(registered.email);
      expect(retrieved.displayName).toBe(registered.displayName);
      expect(retrieved.id).toBe(memberId);
    }
  );

  // Feature: bjj-gym-booking-platform, Property 2: Achievement storage round-trip
  // **Validates: Requirements 1.2**
  test.prop([achievementTypeArb, achievementTitleArb])(
    "Property 2: Achievement storage round-trip",
    async (achType, achTitle) => {
      const memberId = "member-prop2";
      const achId = "ach-" + achTitle.slice(0, 5);

      // Mock: member exists
      vi.mocked(prisma.member.findUnique).mockResolvedValueOnce({
        id: memberId,
      } as never);

      // Mock: achievement creation
      vi.mocked(prisma.achievement.create).mockResolvedValueOnce({
        id: achId,
        type: achType,
        title: achTitle.trim(),
        description: null,
        date: null,
      } as never);

      // Create the achievement
      const createReq = new Request(
        `http://localhost/api/members/${memberId}/achievements`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: achType, title: achTitle }),
        }
      ) as never;
      const createRes = await achievementPOST(createReq, makeCtx(memberId));
      expect(createRes.status).toBe(201);
      const created = await createRes.json();

      // Mock: retrieving member returns the achievement
      vi.mocked(prisma.member.findUnique).mockResolvedValueOnce({
        id: memberId,
        email: "test@example.com",
        displayName: "Test",
        profilePhoto: null,
        beltRank: null,
        trainingHistory: null,
        averageRating: 0,
        createdAt: new Date(),
        achievements: [
          {
            id: achId,
            type: achType,
            title: achTitle.trim(),
            description: null,
            date: null,
          },
        ],
      } as never);

      // Retrieve the member profile
      const getReq = new Request(`http://localhost/api/members/${memberId}`) as never;
      const getRes = await memberGET(getReq, makeCtx(memberId));
      expect(getRes.status).toBe(200);
      const profile = await getRes.json();

      // The achievement should round-trip correctly
      expect(profile.achievements).toHaveLength(1);
      expect(profile.achievements[0].type).toBe(created.type);
      expect(profile.achievements[0].title).toBe(created.title);
    }
  );

  // Feature: bjj-gym-booking-platform, Property 3: Short passwords are rejected
  // **Validates: Requirements 1.4**
  test.prop([validEmailArb, invalidPasswordArb, displayNameArb])(
    "Property 3: Short passwords are rejected",
    async (email, shortPassword, displayName) => {
      const res = await registerPOST(
        makeRegisterRequest({ email, password: shortPassword, displayName })
      );
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("validation_error");
      expect(json.fields.password).toBeDefined();
    }
  );

  // Feature: bjj-gym-booking-platform, Property 4: Member profile contains all required fields
  // **Validates: Requirements 1.5**
  test.prop([displayNameArb, beltRankArb, achievementTypeArb, achievementTitleArb])(
    "Property 4: Member profile contains all required fields",
    async (displayName, beltRank, achType, achTitle) => {
      const memberId = "member-prop4";
      const profilePhoto = "https://example.com/photo.jpg";
      const trainingHistory = "5 years of training";

      // Mock: member with all profile fields populated
      vi.mocked(prisma.member.findUnique).mockResolvedValueOnce({
        id: memberId,
        email: "test@example.com",
        displayName,
        profilePhoto,
        beltRank,
        trainingHistory,
        averageRating: 4.0,
        createdAt: new Date("2024-01-01"),
        achievements: [
          {
            id: "ach-1",
            type: achType,
            title: achTitle,
            description: "A description",
            date: new Date("2024-06-01"),
          },
        ],
      } as never);

      const getReq = new Request(`http://localhost/api/members/${memberId}`) as never;
      const getRes = await memberGET(getReq, makeCtx(memberId));
      expect(getRes.status).toBe(200);
      const profile = await getRes.json();

      // All required fields from Requirement 1.5 must be present
      expect(profile.displayName).toBe(displayName);
      expect(profile.profilePhoto).toBe(profilePhoto);
      expect(profile.beltRank).toBe(beltRank);
      expect(profile.trainingHistory).toBe(trainingHistory);
      expect(profile.achievements).toBeDefined();
      expect(profile.achievements.length).toBeGreaterThan(0);
      expect(profile.achievements[0].type).toBe(achType);
      expect(profile.achievements[0].title).toBe(achTitle);
    }
  );
});
