"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { companionApplicationSchema } from "@/lib/plusone/application-schema";
import { generateSlots } from "@/lib/plusone/availability";

export interface SubmitResult {
  ok: boolean;
  errors?: Record<string, string[]>;
}

/**
 * Submit (or re-submit) a companion application.
 * Creates/refreshes the pending companion_profiles row, opens a
 * verification_submissions row, and regenerates open availability slots
 * for the next 30 days from the applicant's weekly selection.
 */
export async function submitCompanionApplication(
  raw: unknown,
): Promise<SubmitResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const parsed = companionApplicationSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.flatten().fieldErrors };
  }
  const input = parsed.data;

  // Already-approved companions should not re-apply through this flow.
  const { data: existing } = await supabase
    .from("companion_profiles")
    .select("id, verification_status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing?.verification_status === "approved") {
    return {
      ok: false,
      errors: {
        _form: ["You're already an approved companion."],
      },
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("companion_profiles")
    .upsert(
      {
        user_id: user.id,
        bio: input.bio,
        interests: input.interests,
        hourly_rate: input.hourly_rate ?? null,
        evening_rate: input.evening_rate ?? null,
        verification_status: "pending",
        verified_at: null,
      },
      { onConflict: "user_id" },
    )
    .select("id")
    .single();

  if (profileError || !profile) {
    return {
      ok: false,
      errors: {
        _form: ["Could not save your application. Please try again."],
      },
    };
  }

  const { error: submissionError } = await supabase
    .from("verification_submissions")
    .insert({
      user_id: user.id,
      id_document_url: input.id_document_url,
      selfie_url: input.selfie_url,
      video_clip_url: input.video_clip_url,
      prompt_phrase: input.prompt_phrase,
      status: "pending",
    });

  if (submissionError) {
    return {
      ok: false,
      errors: {
        _form: ["Could not save your verification. Please try again."],
      },
    };
  }

  // Regenerate open availability from the weekly selection.
  await supabase
    .from("availability_slots")
    .delete()
    .eq("companion_id", profile.id)
    .eq("status", "open");

  const slots = generateSlots({
    days: input.days,
    timeframes: input.timeframes,
  });

  if (slots.length > 0) {
    const { error: slotsError } = await supabase
      .from("availability_slots")
      .insert(
        slots.map((s) => ({
          companion_id: profile.id,
          date: s.date,
          start_time: s.start_time,
          end_time: s.end_time,
          status: "open",
        })),
      );
    if (slotsError) {
      return {
        ok: false,
        errors: {
          _form: ["Could not save your availability. Please try again."],
        },
      };
    }
  }

  redirect("/become-companion/pending");
}
