import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { POST } from "@/app/api/swipes/route";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

describe("POST /api/swipes", () => {
  const mockSupabase = {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (createClient as unknown as Mock).mockResolvedValue(mockSupabase);
  });

  const USER_1 = "11111111-1111-4111-8111-111111111111";
  const USER_2 = "22222222-2222-4222-8222-222222222222";
  const CONV_ID = "33333333-3333-4333-8333-333333333333";

  it("returns 401 if user is not authenticated", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } });

    const request = new Request("http://localhost/api/swipes", {
      method: "POST",
      body: JSON.stringify({ target_id: USER_2, direction: "like" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("records a one-way like (no match)", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: USER_1 } },
    });

    const swipeInsert = vi.fn().mockResolvedValue({ data: null, error: null });

    const mutualSelect = vi.fn().mockReturnThis();
    const mutualEq = vi.fn().mockReturnThis();
    const mutualMaybeSingle = vi.fn().mockResolvedValue({ data: null });

    const swipesChain = {
      insert: swipeInsert,
      select: mutualSelect,
      eq: mutualEq,
      maybeSingle: mutualMaybeSingle,
    };

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "swipes") return swipesChain;
      return { insert: vi.fn().mockResolvedValue({ data: null }) };
    });

    const request = new Request("http://localhost/api/swipes", {
      method: "POST",
      body: JSON.stringify({ target_id: USER_2, direction: "like" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(body.matched).toBe(false);
    expect(swipeInsert).toHaveBeenCalledWith({
      swiper_id: USER_1,
      target_id: USER_2,
      direction: "like",
    });
  });

  it("creates a match and conversation when both users swipe right", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: USER_1 } },
    });

    const swipeInsert = vi.fn().mockResolvedValue({ data: null, error: null });

    const mutualMaybeSingle = vi.fn().mockResolvedValue({
      data: { swiper_id: USER_2, target_id: USER_1 },
    });

    const matchInsert = vi.fn().mockReturnThis();
    const matchSelect = vi.fn().mockReturnThis();
    const matchSingle = vi.fn().mockResolvedValue({
      data: { id: CONV_ID, user_a: USER_1, user_b: USER_2, created_at: "2025-01-01T00:00:00Z" },
    });

    const convInsert = vi.fn().mockReturnThis();
    const convSelect = vi.fn().mockReturnThis();
    const convSingle = vi.fn().mockResolvedValue({
      data: { id: CONV_ID, match_id: CONV_ID, user_a: USER_1, user_b: USER_2, created_at: "2025-01-01T00:00:00Z" },
    });

    const profileSelect = vi.fn().mockReturnThis();
    const profileEq = vi.fn().mockReturnThis();
    const profileSingle = vi.fn().mockResolvedValue({
      data: { display_name: "Bob" },
    });

    const notifInsert = vi.fn().mockResolvedValue({ data: null });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "swipes") {
        return {
          insert: swipeInsert,
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: mutualMaybeSingle,
        };
      }
      if (table === "matches") {
        return {
          insert: matchInsert,
          select: matchSelect,
          single: matchSingle,
        };
      }
      if (table === "conversations") {
        return {
          insert: convInsert,
          select: convSelect,
          single: convSingle,
        };
      }
      if (table === "notifications") return { insert: notifInsert };
      if (table === "profiles") {
        return {
          select: profileSelect,
          eq: profileEq,
          single: profileSingle,
        };
      }
      return {};
    });

    const request = new Request("http://localhost/api/swipes", {
      method: "POST",
      body: JSON.stringify({ target_id: USER_2, direction: "like" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(body.matched).toBe(true);
    expect(matchInsert).toHaveBeenCalled();
    expect(convInsert).toHaveBeenCalled();
    expect(notifInsert).toHaveBeenCalledTimes(2);
  });

  it("returns 400 for invalid payload (missing target_id)", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: USER_1 } },
    });

    const request = new Request("http://localhost/api/swipes", {
      method: "POST",
      body: JSON.stringify({ direction: "like" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
