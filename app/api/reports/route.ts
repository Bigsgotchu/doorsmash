import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

const reportSchema = z.object({
  reported_id: z.string().uuid(),
  reason: z.enum(["inappropriate", "spam", "harassment", "other"]),
  details: z.string().max(1000).optional(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = reportSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid data", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  // Create the report
  const { data: report, error: reportError } = await supabase
    .from("reports")
    .insert({
      reporter_id: user.id,
      reported_id: parsed.data.reported_id,
      reason: parsed.data.reason,
      details: parsed.data.details,
    })
    .select()
    .single();

  if (reportError) {
    return NextResponse.json({ error: reportError.message }, { status: 500 });
  }

  // Block the user (so they no longer appear in discovery)
  const { error: blockError } = await supabase.from("blocked_users").insert({
    blocker_id: user.id,
    blocked_id: parsed.data.reported_id,
  });

  if (blockError && blockError.code !== "23505") {
    // Ignore duplicate key violation — already blocked
    return NextResponse.json({ error: blockError.message }, { status: 500 });
  }

  return NextResponse.json({ data: report });
}
