import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import VerifyIdentityForm from "./_components/verify-identity-form";
import "../become-companion/become-companion.css";
import "../bookings/bookings.css";

export const metadata = {
  title: "Verify your identity | PlusOne",
};

interface PageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function VerifyIdentityPage({ searchParams }: PageProps) {
  const { next } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=" + encodeURIComponent("/verify-identity"));

  const { data: approved } = await supabase
    .from("verification_submissions")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "approved")
    .limit(1)
    .maybeSingle();

  const { data: pending } = approved
    ? { data: null }
    : await supabase
        .from("verification_submissions")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "pending")
        .limit(1)
        .maybeSingle();

  return (
    <main className="po-shell">
      <div className="po-wrap" style={{ maxWidth: 680 }}>
        <p className="po-eyebrow">PlusOne · Trust & safety</p>
        <h1 className="po-title">Verify your identity</h1>
        {approved ? (
          <>
            <p className="po-success">
              ✓ You&apos;re verified. You can request bookings whenever
              you&apos;re ready.
            </p>
            <p>
              <Link href={next || "/companions"} className="po-btn">
                {next ? "Continue" : "Browse companions"}
              </Link>
            </p>
          </>
        ) : pending ? (
          <>
            <p className="po-hint">
              Your verification is under review. We&apos;ll notify you as soon
              as it&apos;s approved — usually within a day.
            </p>
            <p>
              <Link href="/companions" className="po-btn po-btn-secondary">
                Browse companions meanwhile
              </Link>
            </p>
          </>
        ) : (
          <>
            <p className="po-sub">
              Requesting a booking requires verified identity — a photo ID and
              a short video clip. It keeps every event safe for both sides.
              Your documents stay private and are never shown publicly.
            </p>
            <VerifyIdentityForm next={next} />
          </>
        )}
      </div>
    </main>
  );
}
