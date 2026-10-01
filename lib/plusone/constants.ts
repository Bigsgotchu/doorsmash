// PlusOne brand + product constants. Single source of truth for the
// money model and verification flow. (No paid services involved.)

export const BRAND_NAME = "PlusOne";
export const BRAND_TAGLINE = "Never go alone again.";

// Money model (official, confirmed Sep 30 2026)
export const PLATFORM_FEE_RATE = 0.2;
export const COMPANION_SHARE_RATE = 0.8;
export const MIN_HOURLY_RATE = 50;
export const MIN_EVENING_RATE = 150;

// Availability generation
export const AVAILABILITY_WINDOW_DAYS = 30;

export const DAYS_OF_WEEK = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
] as const;

export const TIMEFRAMES = [
  { id: "daytime", label: "Daytime", start: "09:00", end: "17:00" },
  { id: "evening", label: "Evening", start: "17:00", end: "23:00" },
] as const;

export type TimeframeId = (typeof TIMEFRAMES)[number]["id"];

export const INTEREST_OPTIONS = [
  "Weddings",
  "Live music",
  "Dancing",
  "Foodie",
  "Sports",
  "Art & museums",
  "Outdoors",
  "Comedy",
  "Wine & cocktails",
  "Networking",
  "Theater",
  "Photography",
] as const;

export const MAX_INTERESTS = 8;
export const MAX_BIO_LENGTH = 500;

// Random prompt phrases for the video verification clip.
// The applicant must say the phrase on camera; it defeats pre-recorded clips.
export const PROMPT_PHRASES = [
  "blue elephant",
  "purple sunset",
  "dancing cactus",
  "silver moonlight",
  "happy penguin",
  "golden sunrise",
  "velvet thunder",
  "crimson kite",
] as const;

export const MAX_CLIP_SECONDS = 15;

export function randomPromptPhrase(): string {
  const idx = Math.floor(Math.random() * PROMPT_PHRASES.length);
  return PROMPT_PHRASES[idx];
}
