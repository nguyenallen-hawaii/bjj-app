import { store } from "@/lib/store";
import { hashPassword } from "@/lib/password";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, displayName } = body;

    const fields: Record<string, string> = {};
    if (!email || typeof email !== "string") {
      fields.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      fields.email = "Invalid email format";
    }
    if (!displayName || typeof displayName !== "string" || !displayName.trim()) {
      fields.displayName = "Display name is required";
    }
    if (!password || typeof password !== "string") {
      fields.password = "Password is required";
    } else if (password.length < 8) {
      fields.password = "Password must be at least 8 characters";
    }

    if (Object.keys(fields).length > 0) {
      return Response.json({ error: "validation_error", fields }, { status: 400 });
    }

    const existing = store.findMemberByEmail(email.toLowerCase());
    if (existing) {
      return Response.json({ error: "conflict", message: "Email is already registered" }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const member = store.createMember({
      email: email.toLowerCase(),
      passwordHash,
      displayName: displayName.trim(),
      profilePhoto: null,
      beltRank: null,
      trainingHistory: null,
    });

    return Response.json({ id: member.id, email: member.email, displayName: member.displayName, createdAt: member.createdAt }, { status: 201 });
  } catch {
    return Response.json({ error: "internal_error" }, { status: 500 });
  }
}
