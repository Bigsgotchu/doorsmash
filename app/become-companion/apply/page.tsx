import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CompanionApplicationForm from "./_components/companion-application-form";
import "../become-companion.css";
import "./apply.css";

export const metadata = {
  title: "Apply as a Companion | PlusOne",
  description: "Apply to become a verified PlusOne event companion.",
};

export default async function ApplyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: existing } = await supabase
    .from("companion_profiles")
    .select("id, verification_status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing?.verification_status === "approved") {
    redirect(`/companions/${existing.id}`);
  }
  if (existing?.verification_status === "pending") {
    redirect("/become-companion/pending");
  }

  return (
    <main className="po-shell">
      <div className="po-apply-wrap">
        <p className="po-eyebrow">✨ Companion application</p>
        <h1 className="po-apply-title">Let&apos;s get you verified.</h1>
        <CompanionApplicationForm />
      </div>
    </main>
  );
}
