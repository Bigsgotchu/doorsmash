import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ProfileForm from "@/app/profile/_components/profile-form";
import "@/app/profile/profile.css";

export const metadata = {
  title: "Set up your profile | DoorSmash",
};

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return (
    <main className="profile-setup-shell">
      <div className="profile-setup-card">
        <div className="profile-setup-brand">
          <span className="brand-symbol" aria-hidden="true">d</span>
          <span>door<span>smash</span></span>
        </div>
        <h1>{profile?.is_profile_complete ? "Edit profile" : "Make it you."}</h1>
        <p className="profile-setup-sub">
          {profile?.is_profile_complete
            ? "Update your details, photos, and preferences."
            : "Add a few photos and the little details that make a first date feel easy."}
        </p>

        <ProfileForm profile={profile} />
      </div>
    </main>
  );
}
