import { store } from "@/lib/store";
import { requireSession, AuthError } from "@/lib/auth-helpers";
import type { NextRequest } from "next/server";

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const memberId = session.user.id;
    const { id } = await ctx.params;

    const booking = store.findBookingById(id);

    if (!booking || booking.memberId !== memberId) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }

    if (booking.status === "cancelled") {
      return Response.json(
        { error: "not_found", message: "Booking is already cancelled" },
        { status: 404 }
      );
    }

    // Check 24-hour cancellation window
    const sessionDateTime = new Date(booking.sessionDate);
    const [hours, minutes] = booking.sessionStartTime.split(":").map(Number);
    sessionDateTime.setHours(hours, minutes, 0, 0);

    const now = new Date();
    const hoursUntilSession =
      (sessionDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilSession < 24) {
      return Response.json(
        {
          error: "cancellation_window_passed",
          message:
            "Bookings cannot be cancelled less than 24 hours before the session",
        },
        { status: 422 }
      );
    }

    // Cancel booking and restore capacity
    store.updateBooking(id, { status: "cancelled" });

    if (booking.type === "class") {
      const gymClass = store.findGymClassById(booking.referenceId);
      if (gymClass) {
        store.updateGymClass(booking.referenceId, { bookedCount: gymClass.bookedCount - 1 });
      }
    } else if (booking.type === "open_mat") {
      const openMat = store.findOpenMatById(booking.referenceId);
      if (openMat) {
        store.updateOpenMat(booking.referenceId, { bookedCount: openMat.bookedCount - 1 });
      }
    } else if (booking.type === "event") {
      const event = store.findEventById(booking.referenceId);
      if (event) {
        store.updateEvent(booking.referenceId, { bookedCount: event.bookedCount - 1 });
      }
    }
    // private_session — no capacity to restore

    const updated = store.findBookingById(id);
    return Response.json(updated);
  } catch (err) {
    if (err instanceof AuthError) {
      return Response.json({ error: err.code }, { status: 401 });
    }
    return Response.json({ error: "internal_error" }, { status: 500 });
  }
}
