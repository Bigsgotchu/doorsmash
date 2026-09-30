import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") ?? "50");
  const offset = parseInt(searchParams.get("offset") ?? "0");

  const { data: matches, error } = await supabase
    .from("matches")
    .select(
      `
      id,
      user_a,
      user_b,
      created_at,
      profiles!inner(*)
    `,
      { count: "exact" },
    )
    .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // For each match, fetch the other user's profile and last message
  const enriched = await Promise.all(
    (matches ?? []).map(async (match) => {
      const otherUserId =
        match.user_a === user.id ? match.user_b : match.user_a;

      const { data: otherProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", otherUserId)
        .single();

      // Find or create conversation
      const { data: conv } = await supabase
        .from("conversations")
        .select("id")
        .eq("match_id", match.id)
        .maybeSingle();

      let lastMessage = null;
      let unreadCount = 0;

      if (conv) {
        const { data: lastMsg } = await supabase
          .from("messages")
          .select("*")
          .eq("conversation_id", conv.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        lastMessage = lastMsg;

        const { count } = await supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("conversation_id", conv.id)
          .neq("sender_id", user.id);

        unreadCount = count ?? 0;
      }

      return {
        match_id: match.id,
        other_user: otherProfile,
        conversation_id: conv?.id ?? null,
        last_message: lastMessage,
        unread_count: unreadCount,
        matched_at: match.created_at,
      };
    }),
  );

  return NextResponse.json({ data: enriched });
}
