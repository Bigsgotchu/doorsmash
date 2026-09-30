import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

const swipeSchema = z.object({
  target_id: z.string().uuid(),
  direction: z.enum(["like", "pass"]),
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
  const parsed = swipeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid data", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { target_id, direction } = parsed.data;
  const swiper_id = user.id;

  // Record the swipe
  const { error: swipeError } = await supabase.from("swipes").insert({
    swiper_id,
    target_id,
    direction,
  });

  if (swipeError) {
    return NextResponse.json({ error: swipeError.message }, { status: 500 });
  }

  let matched = false;

  // If this is a 'like', check for a mutual match
  if (direction === "like") {
    const { data: mutual, error: mutualError } = await supabase
      .from("swipes")
      .select("swiper_id, target_id")
      .eq("swiper_id", target_id)
      .eq("target_id", swiper_id)
      .eq("direction", "like")
      .maybeSingle();

    if (!mutualError && mutual) {
      matched = true;

      const userA = [swiper_id, target_id].sort()[0]!;
      const userB = [swiper_id, target_id].sort()[1]!;

      // Create the match
      const { data: match, error: matchError } = await supabase
        .from("matches")
        .insert({ user_a: userA, user_b: userB })
        .select()
        .single();

      if (!matchError && match) {
        // Create a conversation for the match
        const { data: conv, error: convError } = await supabase
          .from("conversations")
          .insert({
            match_id: match.id,
            user_a: userA,
            user_b: userB,
          })
          .select()
          .single();

        if (!convError && conv) {
          // Notify the target user about the match
          const { data: targetProfile } = await supabase
            .from("profiles")
            .select("display_name")
            .eq("id", target_id)
            .single();

          await supabase.from("notifications").insert({
            recipient_id: target_id,
            type: "match",
            title: "It's a match!",
            body: `${targetProfile?.display_name || "Someone"} wants to make your acquaintance.`,
            data: {
              match_id: match.id,
              conversation_id: conv.id,
              other_user_id: swiper_id,
            },
          });

          await supabase.from("notifications").insert({
            recipient_id: swiper_id,
            type: "match",
            title: "It's a match!",
            body: `You and ${targetProfile?.display_name || "someone"} matched!`,
            data: {
              match_id: match.id,
              conversation_id: conv.id,
              other_user_id: target_id,
            },
          });
        }
      }
    }
  }

  return NextResponse.json({ matched, match_id: matched ? undefined : null });
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
  const target = searchParams.get("target");

  if (!target) {
    return NextResponse.json({ error: "target_id required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("swipes")
    .select("*")
    .eq("swiper_id", user.id)
    .eq("target_id", target)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
