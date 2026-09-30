import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { POST } from "@/app/api/profiles/route";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

describe("POST /api/profiles", () => {
  const mockSupabase = {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (createClient as unknown as Mock).mockResolvedValue(mockSupabase);
  });

  it("returns 401 if not authenticated", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } });

    const request = new Request("http://localhost/api/profiles", {
      method: "POST",
      body: JSON.stringify({ display_name: "Alice" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("returns 400 for invalid data (age below minimum)", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });

    const request = new Request("http://localhost/api/profiles", {
      method: "POST",
      body: JSON.stringify({ age: 15 }), // age below minimum of 18
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("updates profile successfully", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });

    const profileData = {
      id: "user-1",
      email: "alice@example.com",
      display_name: "Alice",
      age: 25,
      bio: "Hello!",
      is_profile_complete: true,
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const profilesChain: Record<string, any> = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: profileData }),
    };

    mockSupabase.from.mockReturnValue(profilesChain);

    const request = new Request("http://localhost/api/profiles", {
      method: "POST",
      body: JSON.stringify({
        display_name: "Alice",
        age: 25,
        bio: "Hello!",
        is_profile_complete: true,
      }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.display_name).toBe("Alice");
    expect(body.data.is_profile_complete).toBe(true);
  });
});
