import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

const proposalSchema = z.object({
  match_id: z.string().uuid(),
  conversation_id: z.string().uuid(),
  date_idea_id: z.number().optional(),
  custom_title: z.string().optional(),
  proposed_time: z.string().min(1),
  note: z.string().optional(),
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
  const parsed = proposalSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid data", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { match_id, conversation_id } = parsed.data;

  // Verify user is part of this match
  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("user_a, user_b")
    .eq("id", match_id)
    .maybeSingle();

  if (matchError || !match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  if (match.user_a !== user.id && match.user_b !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("date_proposals")
    .insert({
      ...parsed.data,
      proposer_id: user.id,
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Notify the other person
  const recipientId = match.user_a === user.id ? match.user_b : match.user_a;
  await supabase.from("notifications").insert({
    recipient_id: recipientId,
    type: "date_proposal",
    title: "A date idea was sent",
    data: { match_id, conversation_id, proposal_id: data.id },
  });

  return NextResponse.json({ data });
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const matchId = searchParams.get("match_id");

  if (!matchId) {
    return NextResponse.json(
      { error: "match_id query parameter is required" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("date_proposals")
    .select("*")
    .eq("match_id", matchId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
