import { z } from "zod";
import {
  MAX_BIO_LENGTH,
  MAX_INTERESTS,
  MIN_HOURLY_RATE,
  MIN_EVENING_RATE,
} from "./constants";

/**
 * Validation for a companion application submission.
 * Pure module (no server imports) so it can be unit tested.
 */
export const companionApplicationSchema = z
  .object({
    bio: z
      .string()
      .trim()
      .min(20, "Tell us a little more about yourself (at least 20 characters).")
      .max(
        MAX_BIO_LENGTH,
        `Keep your bio under ${MAX_BIO_LENGTH} characters.`,
      ),
    interests: z
      .array(z.string().trim().min(1))
      .min(1, "Pick at least one interest.")
      .max(MAX_INTERESTS, `Pick up to ${MAX_INTERESTS} interests.`),
    hourly_rate: z
      .number({ error: "Hourly rate must be a number." })
      .min(
        MIN_HOURLY_RATE,
        `Hourly rate must be at least $${MIN_HOURLY_RATE} (platform minimum).`,
      )
      .nullable()
      .optional(),
    evening_rate: z
      .number({ error: "Evening rate must be a number." })
      .min(
        MIN_EVENING_RATE,
        `Evening rate must be at least $${MIN_EVENING_RATE} (platform minimum).`,
      )
      .nullable()
      .optional(),
    days: z
      .array(z.number().int().min(0).max(6))
      .min(1, "Pick at least one day you're generally free."),
    timeframes: z
      .array(z.enum(["daytime", "evening"]))
      .min(1, "Pick at least one timeframe."),
    id_document_url: z.string().min(1, "Upload a photo of your ID."),
    selfie_url: z.string().min(1, "Upload a selfie."),
    video_clip_url: z.string().min(1, "Record your verification clip."),
    prompt_phrase: z.string().min(1, "A prompt phrase is required."),
  })
  .refine(
    (v) =>
      (v.hourly_rate !== undefined &&
        v.hourly_rate !== null &&
        v.hourly_rate > 0) ||
      (v.evening_rate !== undefined &&
        v.evening_rate !== null &&
        v.evening_rate > 0),
    {
      message: "Set at least one rate (hourly or per evening).",
      path: ["hourly_rate"],
    },
  );

export type CompanionApplicationInput = z.infer<
  typeof companionApplicationSchema
>;
