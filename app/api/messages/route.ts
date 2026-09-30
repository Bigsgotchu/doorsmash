import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

const messageSchema = z.object({
  conversation_id: z.string().uuid(),
  content: z.string().min(1, "Message cannot be empty").max(5000),
  date_idea_id: z.number().optional(),
  custom_title: z.string().optional(),
  location_name: z.string().optional(),
  proposed_time: z.string().datetime().optional(),
  note: z.string().optional(),
  is_date_proposal: z.boolean().optional(),
});

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const conversationId = searchParams.get("conversation_id");

  if (!conversationId) {
    return NextResponse.json(
      { error: "conversation_id query parameter is required" },
      { status: 400 },
    );
  }

  // Verify user is a participant
  const { data: conv, error: convCheck } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
    .maybeSingle();

  if (convCheck || !conv) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = messageSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid data", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { conversation_id, content, is_date_proposal } = parsed.data;

  // Verify user is a participant
  const { data: conv, error: convCheck } = await supabase
    .from("conversations")
    .select("user_a, user_b")
    .eq("id", conversation_id)
    .maybeSingle();

  if (convCheck || !conv) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  if (conv.user_a !== user.id && conv.user_b !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: message, error: msgError } = await supabase
    .from("messages")
    .insert({
      conversation_id,
      sender_id: user.id,
      content: content.trim(),
    })
    .select()
    .single();

  if (msgError) {
    return NextResponse.json({ error: msgError.message }, { status: 500 });
  }

  // Create notification for recipient
  const recipientId = conv.user_a === user.id ? conv.user_b : conv.user_a;
  await supabase.from("notifications").insert({
    recipient_id: recipientId,
    type: "message",
    title: "New message",
    body: content.trim().slice(0, 100),
    data: { conversation_id, message_id: message.id },
  });

  // If it's a date proposal, create a date_proposal record
  if (is_date_proposal && parsed.data.date_idea_id && parsed.data.proposed_time) {
    const { data: convMatch } = await supabase
      .from("conversations")
      .select("match_id")
      .eq("id", conversation_id)
      .single();

    if (convMatch?.match_id) {
      await supabase.from("date_proposals").insert({
        match_id: convMatch.match_id,
        conversation_id,
        proposer_id: user.id,
        date_idea_id: parsed.data.date_idea_id,
        location_name: parsed.data.location_name,
        proposed_time: parsed.data.proposed_time,
        note: parsed.data.note,
      });
    }
  }

  return NextResponse.json({ data: message });
}
