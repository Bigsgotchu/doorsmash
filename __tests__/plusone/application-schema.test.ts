import { describe, it, expect } from "vitest";
import { companionApplicationSchema } from "@/lib/plusone/application-schema";

const valid = {
  bio: "Wedding guest pro. I love a good dance floor and great conversation.",
  interests: ["Weddings", "Dancing"],
  hourly_rate: 60,
  evening_rate: null,
  days: [5, 6],
  timeframes: ["evening"] as ("daytime" | "evening")[],
  id_document_url: "user-1/id-123.jpg",
  selfie_url: "user-1/selfie-123.jpg",
  video_clip_url: "user-1/clip-123.webm",
  prompt_phrase: "blue elephant",
};

describe("companionApplicationSchema", () => {
  it("accepts a valid application", () => {
    expect(companionApplicationSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts evening-rate-only applications", () => {
    const r = companionApplicationSchema.safeParse({
      ...valid,
      hourly_rate: null,
      evening_rate: 150,
    });
    expect(r.success).toBe(true);
  });

  it("rejects when no rate is set", () => {
    const r = companionApplicationSchema.safeParse({
      ...valid,
      hourly_rate: null,
      evening_rate: null,
    });
    expect(r.success).toBe(false);
  });

  it("rejects rates below the platform floor", () => {
    const r = companionApplicationSchema.safeParse({
      ...valid,
      hourly_rate: 25,
    });
    expect(r.success).toBe(false);
  });

  it("rejects a missing verification clip", () => {
    const r = companionApplicationSchema.safeParse({
      ...valid,
      video_clip_url: "",
    });
    expect(r.success).toBe(false);
  });

  it("rejects a bio that is too short", () => {
    const r = companionApplicationSchema.safeParse({ ...valid, bio: "Hi" });
    expect(r.success).toBe(false);
  });

  it("rejects empty availability", () => {
    const r = companionApplicationSchema.safeParse({ ...valid, days: [] });
    expect(r.success).toBe(false);
  });
});
