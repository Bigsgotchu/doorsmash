import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(_request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("conversations")
    .select("id, match_id, user_a, user_b, created_at")
    .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get last message + unread count for each conversation
  const enriched = await Promise.all(
    (data ?? []).map(async (conv) => {
      const otherUserId =
        conv.user_a === user.id ? conv.user_b : conv.user_a;

      const { data: otherUser } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", otherUserId)
        .single();

      const { data: lastMsg } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const { count: unreadCount } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", conv.id)
        .neq("sender_id", user.id);

      return {
        id: conv.id,
        match_id: conv.match_id,
        other_user: otherUser,
        last_message: lastMsg,
        unread_count: unreadCount ?? 0,
      };
    }),
  );

  return NextResponse.json({ data: enriched });
}
