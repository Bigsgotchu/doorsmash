"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const renterVerificationSchema = z.object({
  id_document_url: z.string().min(1).max(500),
  video_clip_url: z.string().min(1).max(500),
  prompt_phrase: z.string().min(1).max(60),
});

export interface SubmitResult {
  ok: boolean;
  errors?: Record<string, string[]>;
}

/**
 * Submit renter identity verification (ID + video clip).
 * Creates a verification_submissions row with kind='renter' for the
 * admin review queue. Requesting a booking requires an approved row.
 */
export async function submitRenterVerification(
  raw: unknown,
): Promise<SubmitResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const parsed = renterVerificationSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.flatten().fieldErrors };
  }
  const input = parsed.data;

  // Already verified — nothing to do.
  const { data: approved } = await supabase
    .from("verification_submissions")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "approved")
    .limit(1)
    .maybeSingle();
  if (approved) {
    return { ok: true };
  }

  // RLS ("Users create own verification submissions") permits this insert.
  const { error } = await supabase.from("verification_submissions").insert({
    user_id: user.id,
    kind: "renter",
    id_document_url: input.id_document_url,
    selfie_url: null,
    video_clip_url: input.video_clip_url,
    prompt_phrase: input.prompt_phrase,
    status: "pending",
  });

  if (error) {
    // One pending submission per user (partial unique index).
    if (error.code === "23505") {
      return {
        ok: false,
        errors: { _form: ["You already have a verification under review."] },
      };
    }
    return {
      ok: false,
      errors: { _form: ["Could not save your verification. Please try again."] },
    };
  }

  return { ok: true };
}
