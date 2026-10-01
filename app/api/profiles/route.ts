import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

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
