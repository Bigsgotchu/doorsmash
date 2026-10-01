export interface Profile {
  id: string;
  email: string;
  full_name?: string;
  display_name?: string;
  age?: number;
  bio?: string;
  neighborhood?: string;
  location?: string;
  distance_preference: number;
  gender?: string;
  gender_preference?: string;
  primary_photo_url?: string;
  is_verified: boolean;
  is_profile_complete: boolean;
  created_at: string;
  updated_at: string;
}

export interface Swipe {
  id: number;
  swiper_id: string;
  target_id: string;
  direction: "like" | "pass";
  created_at: string;
}

export interface Match {
  id: string;
  user_a: string;
  user_b: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  match_id?: string;
  user_a: string;
  user_b: string;
  created_at: string;
}

export interface Message {
  id: number;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export interface DateIdea {
  id: number;
  title: string;
  category: string;
  description?: string;
  image_url?: string;
  created_at: string;
}

export interface DateProposal {
  id: string;
  match_id: string;
  conversation_id: string;
  proposer_id: string;
  date_idea_id?: number;
  custom_title?: string;
  location_name?: string;
  proposed_at: string | null;
  proposed_time: string;
  note?: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
}

export interface Notification {
  id: number;
  recipient_id: string;
  type: "match" | "message" | "date_proposal";
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  read: boolean;
  created_at: string;
}

export interface Report {
  id: number;
  reporter_id: string;
  reported_id: string;
  reason: "inappropriate" | "spam" | "harassment" | "other";
  details?: string;
  status: "pending" | "reviewed" | "resolved";
  created_at: string;
}

export interface BlockedUser {
  id: number;
  blocker_id: string;
  blocked_id: string;
  created_at: string;
}

export const GENDER_OPTIONS = ["man", "woman", "non-binary", "other"] as const;
export type Gender = (typeof GENDER_OPTIONS)[number];

export const DATE_CATEGORIES = [
  "DINNER",
  "WALK",
  "DRINKS",
  "COFFEE",
  "ACTIVITY",
  "OTHER",
] as const;
export type DateCategory = (typeof DATE_CATEGORIES)[number];

export const REPORT_REASONS = [
  "inappropriate",
  "spam",
  "harassment",
  "other",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

// ---------------------------------------------------------------
// PlusOne marketplace
// ---------------------------------------------------------------

export type CompanionVerificationStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "suspended";

export interface CompanionProfile {
  id: string;
  user_id: string;
  bio?: string;
  interests: string[];
  hourly_rate?: number | null;
  evening_rate?: number | null;
  verification_status: CompanionVerificationStatus;
  verified_at?: string | null;
  rating_avg: number;
  total_bookings: number;
  created_at: string;
}

export type AvailabilityStatus = "open" | "booked" | "blocked";

export interface AvailabilitySlot {
  id: string;
  companion_id: string;
  date: string;
  start_time?: string | null;
  end_time?: string | null;
  status: AvailabilityStatus;
  created_at: string;
}

export type VerificationSubmissionStatus = "pending" | "approved" | "rejected";

export interface VerificationSubmission {
  id: string;
  user_id: string;
  id_document_url?: string | null;
  selfie_url?: string | null;
  video_clip_url?: string | null;
  prompt_phrase?: string | null;
  status: VerificationSubmissionStatus;
  reviewer_notes?: string | null;
  reviewed_at?: string | null;
  created_at: string;
}
