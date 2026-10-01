// Server-side helpers for the PlusOne booking flow.
// All functions take an already-authenticated Supabase server client.

import type { SupabaseClient } from "@supabase/supabase-js";

export interface BookingPartyInfo {
  booking: Record<string, unknown> & {
    id: string;
    renter_id: string;
    companion_id: string;
    status: string;
    event_date: string;
    start_time: string;
    end_time: string | null;
    total_cents: number;
  };
  companionUserId: string;
  isRenter: boolean;
  isCompanion: boolean;
}

/**
 * Load a booking if (and only if) the given user is a party to it.
 * RLS already restricts SELECT to parties; this also resolves roles.
 * Returns null when the booking doesn't exist or the user isn't a party.
 */
export async function getBookingAsParty(
  supabase: SupabaseClient,
  bookingId: string,
  userId: string,
): Promise<BookingPartyInfo | null> {
  const { data, error } = await supabase
    .from("bookings")
    .select("*, companion_profiles!inner(user_id)")
    .eq("id", bookingId)
    .maybeSingle();
  if (error || !data) return null;
  const companionUserId = (
    data as { companion_profiles: { user_id: string } }
  ).companion_profiles.user_id;
  return {
    booking: data as BookingPartyInfo["booking"],
    companionUserId,
    isRenter: data.renter_id === userId,
    isCompanion: companionUserId === userId,
  };
}

export interface NotifyInput {
  recipientId: string;
  type:
    | "booking_requested"
    | "booking_confirmed"
    | "booking_denied"
    | "booking_cancelled"
    | "booking_message";
  title: string;
  body?: string;
  data?: Record<string, unknown>;
}

/**
 * Insert a notification for a booking party. RLS ("Users can notify their
 * booking parties") permits the actor to notify the other party.
 */
export async function notifyBookingParty(
  supabase: SupabaseClient,
  input: NotifyInput,
): Promise<void> {
  const { error } = await supabase.from("notifications").insert({
    recipient_id: input.recipientId,
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    data: input.data ?? {},
  });
  // Notifications are best-effort: never fail the booking action over them.
  if (error) console.error("[bookings] notification insert failed:", error.message);
}
