import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { POST, GET } from "@/app/api/messages/route";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

describe("GET /api/messages", () => {
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

    const request = new Request("http://localhost/api/messages?conversation_id=conv-1");
    const response = await GET(request);
    expect(response.status).toBe(401);
  });

  it("returns 400 if conversation_id is missing", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });

    const request = new Request("http://localhost/api/messages");
    const response = await GET(request);
    expect(response.status).toBe(400);
  });
});

describe("POST /api/messages", () => {
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

    const request = new Request("http://localhost/api/messages", {
      method: "POST",
      body: JSON.stringify({ conversation_id: "conv-1", content: "Hello" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("returns 400 for invalid payload (empty content)", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });

    const request = new Request("http://localhost/api/messages", {
      method: "POST",
      body: JSON.stringify({ conversation_id: "conv-1", content: "" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("creates a message and notification", async () => {
    const USER_1 = "11111111-1111-4111-8111-111111111111";
    const CONV_ID = "33333333-3333-4333-8333-333333333333";
    const MSG_ID = 123;

    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: USER_1 } },
    });

    const convSelect = vi.fn().mockReturnThis();
    const convEq = vi.fn().mockReturnThis();
    const convMaybeSingle = vi.fn().mockResolvedValue({
      data: { id: CONV_ID, user_a: USER_1, user_b: "22222222-2222-2222-2222-222222222222", match_id: "match-1" },
    });

    const msgInsert = vi.fn().mockReturnThis();
    const msgSelect = vi.fn().mockReturnThis();
    const msgSingle = vi.fn().mockResolvedValue({
      data: { id: MSG_ID, conversation_id: CONV_ID, sender_id: USER_1, content: "Hello!", created_at: new Date().toISOString() },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const msgChain: Record<string, any> = {
      select: msgSelect,
      insert: msgInsert,
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: msgSingle,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const convChain: Record<string, any> = {
      select: convSelect,
      eq: convEq,
      maybeSingle: convMaybeSingle,
    };

    const notifInsert = vi.fn().mockResolvedValue({ data: null });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "conversations") return convChain;
      if (table === "messages") return msgChain;
      if (table === "notifications") return { insert: notifInsert };
      return {};
    });

    const request = new Request("http://localhost/api/messages", {
      method: "POST",
      body: JSON.stringify({
        conversation_id: CONV_ID,
        content: "Hello!",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.id).toBe(MSG_ID);
    expect(msgInsert).toHaveBeenCalledWith({
      conversation_id: CONV_ID,
      sender_id: USER_1,
      content: "Hello!",
    });
    expect(notifInsert).toHaveBeenCalled();
  });
});
