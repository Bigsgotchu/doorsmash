import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") ?? "10");

  // Fetch current user's profile for preferences
  const { data: myProfile } = await supabase
    .from("profiles")
    .select("distance_preference, gender_preference, blocked_users!inner(blocked_id)")
    .eq("id", user.id)
    .maybeSingle();

  const blockedIds: string[] = [];
  if (myProfile?.blocked_users && Array.isArray(myProfile.blocked_users)) {
    for (const entry of myProfile.blocked_users) {
      if (typeof entry === "string" || (entry && typeof entry === "object" && "blocked_id" in entry)) {
        blockedIds.push(typeof entry === "string" ? entry : entry.blocked_id as string);
      }
    }
  }

  // Build the query
  let query = supabase
    .from("profiles")
    .select("*")
    .neq("id", user.id)
    .not("id", "in", `(${blockedIds.join(",") || "null"})`)
    .eq("is_profile_complete", true);

  // Exclude profiles the user has already swiped on
  const { data: swipes } = await supabase
    .from("swipes")
    .select("target_id")
    .eq("swiper_id", user.id);

  const swipedIds = swipes?.map((s) => s.target_id) ?? [];
  if (swipedIds.length > 0) {
    query = query.not("id", "in", `(${swipedIds.join(",")})`);
  }

  const { data: candidates, error } = await query.limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: candidates });
}

const updateSchema = z.object({
  display_name: z.string().min(1).max(50).optional(),
  age: z.number().min(18).max(100).optional(),
  bio: z.string().max(500).optional(),
  neighborhood: z.string().max(100).optional(),
  location: z.string().max(100).optional(),
  distance_preference: z.number().min(1).max(100).optional(),
  gender: z.string().optional(),
  gender_preference: z.string().optional(),
  primary_photo_url: z.string().url().nullable().optional(),
  is_profile_complete: z.boolean().optional(),
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
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid data", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
