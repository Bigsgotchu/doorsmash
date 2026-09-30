import { getUser, createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AppShell from "@/components/app-shell";
import type { Profile, DateIdea } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  const supabase = await createClient();

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    redirect("/login");
  }

  // Redirect to profile setup if incomplete
  if (!profile.is_profile_complete) {
    redirect("/profile");
  }

  // Fetch initial discovery profiles (excluding self, blocked, already-swiped)
  const { data: initialProfiles } = await supabase
    .from("profiles")
    .select("*")
    .eq("is_profile_complete", true)
    .neq("id", user.id)
    .limit(10);

  // Fetch date ideas
  const { data: dateIdeas } = await supabase
    .from("date_ideas")
    .select("*")
    .order("created_at", { ascending: true });

  // Get unread notification count
  const { count: unreadNotifications } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", user.id)
    .eq("read", false);

  return (
    <AppShell
      initialUser={profile as Profile}
      initialProfiles={(initialProfiles ?? []) as Profile[]}
      initialDateIdeas={(dateIdeas ?? []) as DateIdea[]}
      initialUnreadNotifications={unreadNotifications ?? 0}
    />
  );
}
