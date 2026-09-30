import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function fetchInitialData(userId: string) {
  const supabase = await createClient();

  const [profilesRes, matchesRes, dateIdeasRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .neq("id", userId)
      .eq("is_profile_complete", true)
      .not("id", "in", `(${userId})`)
      .limit(20),

    supabase
      .from("matches")
      .select("*")
      .or(`user_a.eq.${userId},user_b.eq.${userId}`)
      .order("created_at", { ascending: false }),

    supabase.from("date_ideas").select("*").order("created_at", { ascending: true }),
  ]);

  return {
    initialProfiles: profilesRes.data ?? [],
    initialDateIdeas: dateIdeasRes.data ?? [],
    initialMatches: matchesRes.data ?? [],
  };
}

export async function fetchMatchesWithDetails(userId: string) {
  const supabase = await createClient();

  const { data: matches } = await supabase
    .from("matches")
    .select("*")
    .or(`user_a.eq.${userId},user_b.eq.${userId}`)
    .order("created_at", { ascending: false });

  if (!matches) return [];

  const enriched = await Promise.all(
    matches.map(async (match) => {
      const otherUserId =
        match.user_a === userId ? match.user_b : match.user_a;

      const { data: otherProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", otherUserId)
        .single();

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

        lastMessage = lastMsg ?? null;

        const { count } = await supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("conversation_id", conv.id)
          .neq("sender_id", userId);

        unreadCount = count ?? 0;
      }

      return {
        match,
        other_user: otherProfile,
        conversation_id: conv?.id ?? null,
        last_message: lastMessage,
        unread_count: unreadCount,
      };
    }),
  );

  return enriched;
}
