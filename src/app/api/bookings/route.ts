import { store } from "@/lib/store";
import { requireSession, AuthError } from "@/lib/auth-helpers";
import type { NextRequest } from "next/server";

const VALID_BOOKING_TYPES = ["class", "open_mat", "private_session", "event"];

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const memberId = session.user.id;
    const body = await req.json();
    const { type, referenceId } = body;

    // Validate input
    const fields: Record<string, string> = {};
    if (!type || !VALID_BOOKING_TYPES.includes(type)) {
      fields.type = "Type must be one of: class, open_mat, private_session, event";
    }
    if (!referenceId || typeof referenceId !== "string" || !referenceId.trim()) {
      fields.referenceId = "Reference ID is required";
    }
    if (Object.keys(fields).length > 0) {
      return Response.json({ error: "validation_error", fields }, { status: 400 });
    }

    // Look up the referenced session to get date/time and check capacity
    const sessionInfo = getSessionInfo(type, referenceId);
    if (!sessionInfo) {
      return Response.json({ error: "not_found", message: "Referenced session not found" }, { status: 404 });
    }

    // Check scheduling conflict
    const conflict = store.bookings.find(
      (b) =>
        b.memberId === memberId &&
        b.status === "confirmed" &&
        b.sessionDate.getTime() === sessionInfo.sessionDate.getTime() &&
        b.sessionStartTime === sessionInfo.sessionStartTime
    );

    if (conflict) {
      return Response.json(
        { error: "scheduling_conflict", message: "You already have a booking at this date and time" },
        { status: 409 }
      );
    }

    // Handle capacity-based booking types
    if (type === "class") {
      const gymClass = store.findGymClassById(referenceId);
      if (!gymClass || gymClass.bookedCount >= gymClass.capacity) {
        return Response.json({ error: "capacity_full", message: "This session is fully booked" }, { status: 409 });
      }
      store.updateGymClass(referenceId, { bookedCount: gymClass.bookedCount + 1 });
      const booking = store.createBooking({
        memberId,
        type,
        referenceId,
        status: "confirmed",
        sessionDate: sessionInfo.sessionDate,
        sessionStartTime: sessionInfo.sessionStartTime,
      });
      return Response.json(booking, { status: 201 });
    }

    if (type === "open_mat") {
      const openMat = store.findOpenMatById(referenceId);
      if (!openMat || openMat.bookedCount >= openMat.capacity) {
        return Response.json({ error: "capacity_full", message: "This session is fully booked" }, { status: 409 });
      }
      store.updateOpenMat(referenceId, { bookedCount: openMat.bookedCount + 1 });
      const booking = store.createBooking({
        memberId,
        type,
        referenceId,
        status: "confirmed",
        sessionDate: sessionInfo.sessionDate,
        sessionStartTime: sessionInfo.sessionStartTime,
      });
      return Response.json(booking, { status: 201 });
    }

    if (type === "event") {
      const event = store.findEventById(referenceId);
      if (!event || event.bookedCount >= event.capacity) {
        return Response.json({ error: "capacity_full", message: "This session is fully booked" }, { status: 409 });
      }
      store.updateEvent(referenceId, { bookedCount: event.bookedCount + 1 });
      const booking = store.createBooking({
        memberId,
        type,
        referenceId,
        status: "confirmed",
        sessionDate: sessionInfo.sessionDate,
        sessionStartTime: sessionInfo.sessionStartTime,
      });
      return Response.json(booking, { status: 201 });
    }

    // private_session — mark time slot as booked
    const timeSlot = store.timeSlots.find((t) => t.id === referenceId);
    if (!timeSlot) {
      return Response.json({ error: "not_found", message: "Time slot not found" }, { status: 404 });
    }
    if (timeSlot.isBooked) {
      return Response.json({ error: "capacity_full", message: "This time slot is already booked" }, { status: 409 });
    }
    store.updateTimeSlot(referenceId, { isBooked: true });
    const booking = store.createBooking({
      memberId,
      type,
      referenceId,
      status: "confirmed",
      sessionDate: sessionInfo.sessionDate,
      sessionStartTime: sessionInfo.sessionStartTime,
    });
    return Response.json(booking, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return Response.json({ error: err.code }, { status: 401 });
    }
    return Response.json({ error: "internal_error" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const session = await requireSession();
    const memberId = session.user.id;

    const bookings = store.findBookingsByMember(memberId)
      .filter((b) => b.status === "confirmed")
      .sort((a, b) => a.sessionDate.getTime() - b.sessionDate.getTime());

    return Response.json(bookings);
  } catch (err) {
    if (err instanceof AuthError) {
      return Response.json({ error: err.code }, { status: 401 });
    }
    return Response.json({ error: "internal_error" }, { status: 500 });
  }
}

function getSessionInfo(
  type: string,
  referenceId: string
): { sessionDate: Date; sessionStartTime: string } | null {
  if (type === "class") {
    const gymClass = store.findGymClassById(referenceId);
    if (!gymClass) return null;
    return { sessionDate: gymClass.date, sessionStartTime: gymClass.startTime };
  }

  if (type === "open_mat") {
    const openMat = store.findOpenMatById(referenceId);
    if (!openMat) return null;
    return { sessionDate: openMat.date, sessionStartTime: openMat.startTime };
  }

  if (type === "event") {
    const event = store.findEventById(referenceId);
    if (!event) return null;
    return { sessionDate: event.date, sessionStartTime: event.startTime };
  }

  if (type === "private_session") {
    const timeSlot = store.timeSlots.find((t) => t.id === referenceId);
    if (!timeSlot) return null;
    return { sessionDate: timeSlot.date, sessionStartTime: timeSlot.startTime };
  }

  return null;
}
