import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import "@/app/admin/admin.css";

export const metadata = {
  title: "Admin Dashboard | DoorSmash",
};

interface Report {
  id: number;
  reporter_id: string;
  reported_id: string;
  reason: string;
  details?: string;
  status: "pending" | "reviewed" | "resolved";
  created_at: string;
  reporter_name?: string;
  reporter_email: string;
  reported_name?: string;
  reported_email: string;
}

async function checkAdmin(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data, error } = await supabase.rpc("is_admin", {
    user_id: userId,
  });
  return !error && data === true;
}

async function markReportResolved(reportId: number) {
  "use server";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const admin = await checkAdmin(supabase, user.id);
  if (!admin) {
    redirect("/");
  }

  await supabase.from("reports").update({ status: "resolved" }).eq("id", reportId);
  revalidatePath("/admin");
}

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const admin = await checkAdmin(supabase, user.id);
  if (!admin) {
    redirect("/");
  }

  const { data: reports, error: reportsError } = await supabase
    .from("reports")
    .select("*")
    .order("created_at", { ascending: false });

  const enrichedReports: Report[] = [];

  for (const report of reports ?? []) {
    const [{ data: reporter }, { data: reported }] = await Promise.all([
      supabase
        .from("profiles")
        .select("display_name, email")
        .eq("id", report.reporter_id)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("display_name, email")
        .eq("id", report.reported_id)
        .maybeSingle(),
    ]);

    enrichedReports.push({
      ...report,
      reporter_name: reporter?.display_name,
      reporter_email: reporter?.email ?? "",
      reported_name: reported?.display_name,
      reported_email: reported?.email ?? "",
    });
  }

  return (
    <main className="admin-shell">
      <div className="admin-header">
        <h1>Admin Dashboard</h1>
        <p className="admin-sub">Reports and moderation tools</p>
      </div>

      {reportsError && (
        <p className="admin-error">Error: {reportsError.message}</p>
      )}

      {enrichedReports.length === 0 ? (
        <div className="admin-empty">
          <span aria-hidden="true">📋</span>
          <p>No reports to review.</p>
        </div>
      ) : (
        <div className="admin-reports">
          {enrichedReports.map((report) => (
            <div key={report.id} className="report-card">
              <div className="report-header">
                <span className={`report-status ${report.status}`}>
                  {report.status}
                </span>
                <span className="report-id">#{report.id}</span>
              </div>

              <div className="report-details">
                <div className="report-row">
                  <span className="report-label">Reporter</span>
                  <span>
                    {report.reporter_name || report.reporter_email || "Unknown"}
                  </span>
                </div>
                <div className="report-row">
                  <span className="report-label">Reported</span>
                  <span>
                    {report.reported_name || report.reported_email || "Unknown"}
                  </span>
                </div>
                <div className="report-row">
                  <span className="report-label">Reason</span>
                  <span>{report.reason}</span>
                </div>
                {report.details && (
                  <div className="report-row">
                    <span className="report-label">Details</span>
                    <span className="report-details-text">{report.details}</span>
                  </div>
                )}
                <div className="report-row">
                  <span className="report-label">Date</span>
                  <span>{new Date(report.created_at).toLocaleString()}</span>
                </div>
              </div>

              <form action={markReportResolved.bind(null, report.id)}>
                <button
                  type="submit"
                  className="admin-button resolve"
                >
                  Mark resolved
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
