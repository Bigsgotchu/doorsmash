import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import "@/app/admin/admin.css";
import "./verifications.css";

export const metadata = {
  title: "Verification Queue | PlusOne Admin",
};

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function checkAdmin(supabase: Supabase, userId: string) {
  const { data, error } = await supabase.rpc("is_admin", {
    user_id: userId,
  });
  return !error && data === true;
}

async function signedUrl(
  supabase: Supabase,
  bucket: string,
  path: string | null | undefined,
): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 3600);
  if (error || !data) return null;
  return data.signedUrl;
}

async function approveSubmission(submissionId: string, formData: FormData) {
  "use server";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await checkAdmin(supabase, user.id))) {
    redirect("/");
  }

  const notes = (formData.get("notes") as string | null)?.trim() || null;

  const { data: submission } = await supabase
    .from("verification_submissions")
    .select("user_id")
    .eq("id", submissionId)
    .single();

  if (!submission) {
    redirect("/admin/verifications");
  }

  await supabase
    .from("verification_submissions")
    .update({
      status: "approved",
      reviewer_notes: notes,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", submissionId);

  await supabase
    .from("companion_profiles")
    .update({
      verification_status: "approved",
      verified_at: new Date().toISOString(),
    })
    .eq("user_id", submission.user_id);

  revalidatePath("/admin/verifications");
}

async function rejectSubmission(submissionId: string, formData: FormData) {
  "use server";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await checkAdmin(supabase, user.id))) {
    redirect("/");
  }

  const notes = (formData.get("notes") as string | null)?.trim() || null;

  const { data: submission } = await supabase
    .from("verification_submissions")
    .select("user_id")
    .eq("id", submissionId)
    .single();

  if (!submission) {
    redirect("/admin/verifications");
  }

  await supabase
    .from("verification_submissions")
    .update({
      status: "rejected",
      reviewer_notes: notes,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", submissionId);

  await supabase
    .from("companion_profiles")
    .update({ verification_status: "rejected", verified_at: null })
    .eq("user_id", submission.user_id);

  revalidatePath("/admin/verifications");
}

interface QueueItem {
  id: string;
  user_id: string;
  prompt_phrase?: string | null;
  created_at: string;
  display_name?: string;
  email: string;
  bio?: string;
  interests: string[];
  hourly_rate?: number | null;
  evening_rate?: number | null;
  idDocUrl: string | null;
  selfieUrl: string | null;
  clipUrl: string | null;
}

export default async function VerificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }
  if (!(await checkAdmin(supabase, user.id))) {
    redirect("/");
  }

  const { data: submissions } = await supabase
    .from("verification_submissions")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  const queue: QueueItem[] = [];
  for (const s of submissions ?? []) {
    const [{ data: profile }, { data: companion }] = await Promise.all([
      supabase
        .from("profiles")
        .select("display_name, email")
        .eq("id", s.user_id)
        .maybeSingle(),
      supabase
        .from("companion_profiles")
        .select("bio, interests, hourly_rate, evening_rate")
        .eq("user_id", s.user_id)
        .maybeSingle(),
    ]);
    const [idDocUrl, selfieUrl, clipUrl] = await Promise.all([
      signedUrl(supabase, "verification-docs", s.id_document_url),
      signedUrl(supabase, "verification-docs", s.selfie_url),
      signedUrl(supabase, "verification-clips", s.video_clip_url),
    ]);
    queue.push({
      id: s.id,
      user_id: s.user_id,
      prompt_phrase: s.prompt_phrase,
      created_at: s.created_at,
      display_name: profile?.display_name,
      email: profile?.email ?? "",
      bio: companion?.bio,
      interests: companion?.interests ?? [],
      hourly_rate: companion?.hourly_rate,
      evening_rate: companion?.evening_rate,
      idDocUrl,
      selfieUrl,
      clipUrl,
    });
  }

  return (
    <main className="admin-shell">
      <div className="admin-header">
        <h1>Verification Queue</h1>
        <p className="admin-sub">
          Review companion ID, selfie, and video clip submissions
        </p>
      </div>

      {queue.length === 0 ? (
        <div className="admin-empty">
          <span aria-hidden="true">✅</span>
          <p>No pending verifications. Queue is clear.</p>
        </div>
      ) : (
        <div className="admin-reports">
          {queue.map((item) => (
            <div key={item.id} className="report-card verify-card">
              <div className="report-header">
                <span className="report-status pending">pending</span>
                <span className="report-id">
                  {new Date(item.created_at).toLocaleString()}
                </span>
              </div>

              <div className="report-details">
                <div className="report-row">
                  <span className="report-label">Applicant</span>
                  <span>
                    {item.display_name || item.email || "Unknown"}
                  </span>
                </div>
                {item.bio && (
                  <div className="report-row">
                    <span className="report-label">Bio</span>
                    <span className="report-details-text">{item.bio}</span>
                  </div>
                )}
                <div className="report-row">
                  <span className="report-label">Rates</span>
                  <span>
                    {item.hourly_rate ? `$${item.hourly_rate}/hr` : ""}
                    {item.hourly_rate && item.evening_rate ? " · " : ""}
                    {item.evening_rate
                      ? `$${item.evening_rate}/evening`
                      : ""}
                  </span>
                </div>
                {item.interests.length > 0 && (
                  <div className="report-row">
                    <span className="report-label">Interests</span>
                    <span>{item.interests.join(", ")}</span>
                  </div>
                )}
                {item.prompt_phrase && (
                  <div className="report-row">
                    <span className="report-label">Phrase</span>
                    <span className="verify-phrase">
                      “{item.prompt_phrase}”
                    </span>
                  </div>
                )}
              </div>

              <div className="verify-media">
                <div className="verify-media-item">
                  <span className="report-label">ID document</span>
                  {item.idDocUrl ? (
                    <a
                      href={item.idDocUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="verify-doc-link"
                    >
                      Open ID document ↗
                    </a>
                  ) : (
                    <span className="verify-missing">Missing</span>
                  )}
                </div>
                <div className="verify-media-item">
                  <span className="report-label">Selfie</span>
                  {item.selfieUrl ? (
                    <img
                      src={item.selfieUrl}
                      alt="Applicant selfie"
                      className="verify-thumb"
                    />
                  ) : (
                    <span className="verify-missing">Missing</span>
                  )}
                </div>
                <div className="verify-media-item verify-clip">
                  <span className="report-label">Video clip</span>
                  {item.clipUrl ? (
                    <video
                      src={item.clipUrl}
                      controls
                      playsInline
                      preload="metadata"
                      className="verify-video"
                    />
                  ) : (
                    <span className="verify-missing">Missing</span>
                  )}
                </div>
              </div>

              <form className="verify-form">
                <input
                  type="text"
                  name="notes"
                  placeholder="Reviewer notes (optional)"
                  className="verify-notes"
                />
                <div className="verify-actions">
                  <button
                    type="submit"
                    className="admin-button verify-approve"
                    formAction={approveSubmission.bind(null, item.id)}
                  >
                    Approve
                  </button>
                  <button
                    type="submit"
                    className="admin-button verify-reject"
                    formAction={rejectSubmission.bind(null, item.id)}
                  >
                    Reject
                  </button>
                </div>
              </form>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
