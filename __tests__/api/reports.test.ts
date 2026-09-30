import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { POST } from "@/app/api/reports/route";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

describe("POST /api/reports", () => {
  const mockSupabase = {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (createClient as unknown as Mock).mockResolvedValue(mockSupabase);
  });

  const USER_1 = "11111111-1111-4111-8111-111111111111";
  const USER_2 = "22222222-2222-4222-8222-222222222222";

  it("returns 401 if not authenticated", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } });

    const request = new Request("http://localhost/api/reports", {
      method: "POST",
      body: JSON.stringify({ reported_id: USER_2, reason: "spam" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("returns 400 for missing reported_id", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: USER_1 } },
    });

    const request = new Request("http://localhost/api/reports", {
      method: "POST",
      body: JSON.stringify({ reason: "spam" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("creates a report and auto-blocks user", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: USER_1 } },
    });

    const reportInsert = vi.fn().mockReturnThis();
    const reportSelect = vi.fn().mockReturnThis();
    const reportSingle = vi.fn().mockResolvedValue({
      data: { id: 1, reporter_id: USER_1, reported_id: USER_2, reason: "spam", status: "pending" },
    });

    const blockedInsert = vi.fn().mockResolvedValue({ data: null });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "reports") return {
        insert: reportInsert,
        select: reportSelect,
        single: reportSingle,
      };
      if (table === "blocked_users") return { insert: blockedInsert };
      return {};
    });

    const request = new Request("http://localhost/api/reports", {
      method: "POST",
      body: JSON.stringify({
        reported_id: USER_2,
        reason: "spam",
        details: "Spammy behavior",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.id).toBe(1);
    expect(reportInsert).toHaveBeenCalledWith({
      reporter_id: USER_1,
      reported_id: USER_2,
      reason: "spam",
      details: "Spammy behavior",
    });
    expect(blockedInsert).toHaveBeenCalledWith({
      blocker_id: USER_1,
      blocked_id: USER_2,
    });
  });
});
