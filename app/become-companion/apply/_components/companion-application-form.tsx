"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  DAYS_OF_WEEK,
  TIMEFRAMES,
  INTEREST_OPTIONS,
  MAX_INTERESTS,
  MAX_BIO_LENGTH,
  MAX_CLIP_SECONDS,
  AVAILABILITY_WINDOW_DAYS,
  PROMPT_PHRASES,
  randomPromptPhrase,
} from "@/lib/plusone/constants";
import {
  companionReceives,
  formatUSD,
  validateRates,
} from "@/lib/plusone/rates";
import { submitCompanionApplication } from "../actions";

const STEPS = ["Profile", "Availability", "Verification", "Review"];

interface UploadedFile {
  path: string;
  previewUrl: string;
}

async function uploadToBucket(
  bucket: string,
  file: Blob,
  ext: string,
): Promise<string> {
  const supabase = createBrowserSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You're not signed in. Please log in again.");
  const path = `${user.id}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: false });
  if (error) throw new Error(error.message);
  return path;
}

function extOf(name: string, fallback: string): string {
  const parts = name.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : fallback;
}

export default function CompanionApplicationForm() {
  const [step, setStep] = useState(0);

  // Step 1: profile
  const [bio, setBio] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [hourlyRate, setHourlyRate] = useState("");
  const [eveningRate, setEveningRate] = useState("");

  // Step 2: availability
  const [days, setDays] = useState<number[]>([5, 6]);
  const [timeframes, setTimeframes] = useState<string[]>(["evening"]);

  // Step 3: verification
  // Deterministic initial phrase (avoids SSR/client hydration mismatch);
  // the applicant can shuffle it, and every clip is human-reviewed.
  const [promptPhrase, setPromptPhrase] = useState<string>(PROMPT_PHRASES[0]);
  const [idDoc, setIdDoc] = useState<UploadedFile | null>(null);
  const [selfie, setSelfie] = useState<UploadedFile | null>(null);
  const [clip, setClip] = useState<UploadedFile | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const [draftClip, setDraftClip] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const previewRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const draftClipUrlRef = useRef<string | null>(null);

  const stopCamera = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setRecording(false);
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
      if (timerRef.current) clearInterval(timerRef.current);
      if (draftClipUrlRef.current)
        URL.revokeObjectURL(draftClipUrlRef.current);
    };
  }, [stopCamera]);

  const toggleInterest = (interest: string) => {
    setInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : prev.length >= MAX_INTERESTS
          ? prev
          : [...prev, interest],
    );
  };

  const toggleDay = (day: number) =>
    setDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );

  const toggleTimeframe = (id: string) =>
    setTimeframes((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );

  const handleImageFile = async (
    kind: "id" | "selfie",
    file: File,
  ) => {
    setUploading(kind);
    setErrors([]);
    try {
      const previewUrl = URL.createObjectURL(file);
      const path = await uploadToBucket(
        "verification-docs",
        file,
        extOf(file.name, "jpg"),
      );
      if (kind === "id") setIdDoc({ path, previewUrl });
      else setSelfie({ path, previewUrl });
    } catch (e) {
      setErrors([
        e instanceof Error ? e.message : "Upload failed. Please try again.",
      ]);
    } finally {
      setUploading(null);
    }
  };

  const startRecording = async () => {
    setCameraError(null);
    setErrors([]);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "video/webm",
        });
        if (draftClipUrlRef.current)
          URL.revokeObjectURL(draftClipUrlRef.current);
        draftClipUrlRef.current = URL.createObjectURL(blob);
        setDraftClip(draftClipUrlRef.current);
        if (previewRef.current) previewRef.current.src = draftClipUrlRef.current;
        stopCamera();
      };

      recorder.start();
      setRecording(true);
      setRecordSecs(0);
      timerRef.current = setInterval(() => {
        setRecordSecs((s) => {
          if (s + 1 >= MAX_CLIP_SECONDS) {
            recorderRef.current?.stop();
            return s;
          }
          return s + 1;
        });
      }, 1000);
    } catch {
      setCameraError(
        "Couldn't access your camera. You can upload a video file instead.",
      );
    }
  };

  const stopRecording = () => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
  };

  const useDraftClip = async () => {
    if (!draftClip) return;
    setUploading("clip");
    setErrors([]);
    try {
      const blob = await fetch(draftClip).then((r) => r.blob());
      const path = await uploadToBucket("verification-clips", blob, "webm");
      setClip({ path, previewUrl: draftClip });
      draftClipUrlRef.current = null;
      setDraftClip(null);
    } catch (e) {
      setErrors([
        e instanceof Error ? e.message : "Upload failed. Please try again.",
      ]);
    } finally {
      setUploading(null);
    }
  };

  const discardDraftClip = () => {
    if (draftClipUrlRef.current) {
      URL.revokeObjectURL(draftClipUrlRef.current);
      draftClipUrlRef.current = null;
    }
    setDraftClip(null);
    if (previewRef.current) previewRef.current.src = "";
  };

  const handleClipFile = async (file: File) => {
    setUploading("clip");
    setErrors([]);
    try {
      const previewUrl = URL.createObjectURL(file);
      const path = await uploadToBucket(
        "verification-clips",
        file,
        extOf(file.name, "webm"),
      );
      setClip({ path, previewUrl });
    } catch (e) {
      setErrors([
        e instanceof Error ? e.message : "Upload failed. Please try again.",
      ]);
    } finally {
      setUploading(null);
    }
  };

  const validateStep = (s: number): string[] => {
    if (s === 0) {
      const errs: string[] = [];
      if (bio.trim().length < 20)
        errs.push("Tell us a little more about yourself (at least 20 characters).");
      if (bio.length > MAX_BIO_LENGTH)
        errs.push(`Keep your bio under ${MAX_BIO_LENGTH} characters.`);
      if (interests.length === 0) errs.push("Pick at least one interest.");
      const hr = hourlyRate === "" ? null : Number(hourlyRate);
      const er = eveningRate === "" ? null : Number(eveningRate);
      errs.push(...validateRates({ hourly_rate: hr, evening_rate: er }));
      return errs;
    }
    if (s === 1) {
      const errs: string[] = [];
      if (days.length === 0) errs.push("Pick at least one day you're generally free.");
      if (timeframes.length === 0) errs.push("Pick at least one timeframe.");
      return errs;
    }
    if (s === 2) {
      const errs: string[] = [];
      if (!idDoc) errs.push("Upload a photo of your ID.");
      if (!selfie) errs.push("Upload a selfie.");
      if (!clip) errs.push("Record your verification clip.");
      return errs;
    }
    return [];
  };

  const next = () => {
    const errs = validateStep(step);
    setErrors(errs);
    if (errs.length === 0) {
      stopCamera();
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
      window.scrollTo({ top: 0 });
    }
  };

  const back = () => {
    setErrors([]);
    stopCamera();
    setStep((s) => Math.max(s - 1, 0));
    window.scrollTo({ top: 0 });
  };

  const submit = async () => {
    setSubmitting(true);
    setErrors([]);
    const result = await submitCompanionApplication({
      bio: bio.trim(),
      interests,
      hourly_rate: hourlyRate === "" ? null : Number(hourlyRate),
      evening_rate: eveningRate === "" ? null : Number(eveningRate),
      days,
      timeframes,
      id_document_url: idDoc!.path,
      selfie_url: selfie!.path,
      video_clip_url: clip!.path,
      prompt_phrase: promptPhrase,
    });
    // On success the action redirects; only failures return.
    if (!result.ok) {
      setSubmitting(false);
      const flat = Object.values(result.errors ?? {}).flat();
      setErrors(
        flat.length > 0 ? flat : ["Something went wrong. Please try again."],
      );
      window.scrollTo({ top: 0 });
    }
  };

  const hrNum = hourlyRate === "" ? null : Number(hourlyRate);
  const erNum = eveningRate === "" ? null : Number(eveningRate);

  return (
    <div className="po-form">
      <ol className="po-progress">
        {STEPS.map((label, i) => (
          <li
            key={label}
            className={
              i < step ? "done" : i === step ? "active" : undefined
            }
          >
            <span className="po-progress-dot">{i + 1}</span>
            <span className="po-progress-label">{label}</span>
          </li>
        ))}
      </ol>

      {errors.length > 0 && (
        <div className="po-errors" role="alert">
          {errors.map((e, i) => (
            <p key={i}>{e}</p>
          ))}
        </div>
      )}

      {step === 0 && (
        <section className="po-card">
          <h2>Your companion profile</h2>
          <p className="po-hint">
            This is what renters will see. Be yourself — warm beats perfect.
          </p>

          <label className="po-field">
            <span>Bio</span>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={MAX_BIO_LENGTH}
              rows={4}
              placeholder="A little about you — what you're like at a party, what you love doing on weekends…"
            />
            <span className="po-count">
              {bio.length}/{MAX_BIO_LENGTH}
            </span>
          </label>

          <div className="po-field">
            <span>Interests (up to {MAX_INTERESTS})</span>
            <div className="po-chips">
              {INTEREST_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className={
                    interests.includes(opt) ? "po-chip on" : "po-chip"
                  }
                  onClick={() => toggleInterest(opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div className="po-rates">
            <label className="po-field">
              <span>Hourly rate (min $50)</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                placeholder="60"
              />
              {hrNum !== null && hrNum > 0 && (
                <span className="po-payout">
                  You&apos;ll receive {formatUSD(companionReceives(hrNum))}/hr
                </span>
              )}
            </label>
            <label className="po-field">
              <span>Per-evening rate (min $150)</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                value={eveningRate}
                onChange={(e) => setEveningRate(e.target.value)}
                placeholder="150"
              />
              {erNum !== null && erNum > 0 && (
                <span className="po-payout">
                  You&apos;ll receive {formatUSD(companionReceives(erNum))} per
                  evening
                </span>
              )}
            </label>
          </div>
          <p className="po-hint">
            Set one or both. Renters see one price — you keep 80% of every
            booking.
          </p>
        </section>
      )}

      {step === 1 && (
        <section className="po-card">
          <h2>When are you free?</h2>
          <p className="po-hint">
            Pick your usual days and timeframes. We&apos;ll open up bookable
            slots for the next {AVAILABILITY_WINDOW_DAYS} days — you can adjust
            them anytime later.
          </p>

          <div className="po-field">
            <span>Days</span>
            <div className="po-chips">
              {DAYS_OF_WEEK.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  className={days.includes(d.value) ? "po-chip on" : "po-chip"}
                  onClick={() => toggleDay(d.value)}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div className="po-field">
            <span>Timeframes</span>
            <div className="po-chips">
              {TIMEFRAMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={
                    timeframes.includes(t.id) ? "po-chip on" : "po-chip"
                  }
                  onClick={() => toggleTimeframe(t.id)}
                >
                  {t.label} · {t.start}–{t.end}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="po-card">
          <h2>Verify it&apos;s really you</h2>
          <p className="po-hint">
            Only our review team sees these — never the public. They stay
            private to your bookings.
          </p>

          <div className="po-field">
            <span>1 · Photo ID</span>
            {idDoc ? (
              <div className="po-upload-done">
                <img src={idDoc.previewUrl} alt="ID document preview" />
                <button
                  type="button"
                  className="po-link"
                  onClick={() => setIdDoc(null)}
                >
                  Replace
                </button>
              </div>
            ) : (
              <label className="po-upload">
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  disabled={uploading !== null}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleImageFile("id", f);
                  }}
                />
                <span>{uploading === "id" ? "Uploading…" : "📷 Upload ID photo"}</span>
              </label>
            )}
          </div>

          <div className="po-field">
            <span>2 · Selfie</span>
            {selfie ? (
              <div className="po-upload-done">
                <img src={selfie.previewUrl} alt="Selfie preview" />
                <button
                  type="button"
                  className="po-link"
                  onClick={() => setSelfie(null)}
                >
                  Replace
                </button>
              </div>
            ) : (
              <label className="po-upload">
                <input
                  type="file"
                  accept="image/*"
                  capture="user"
                  hidden
                  disabled={uploading !== null}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleImageFile("selfie", f);
                  }}
                />
                <span>
                  {uploading === "selfie" ? "Uploading…" : "🤳 Take a selfie"}
                </span>
              </label>
            )}
          </div>

          <div className="po-field">
            <span>3 · Video clip (max {MAX_CLIP_SECONDS} seconds)</span>
            <div className="po-phrase">
              <span className="po-phrase-label">Say this on camera:</span>
              <strong className="po-phrase-text">“{promptPhrase}”</strong>
              <button
                type="button"
                className="po-link"
                onClick={() => setPromptPhrase(randomPromptPhrase())}
              >
                New phrase
              </button>
            </div>

            {clip ? (
              <div className="po-upload-done">
                <video
                  src={clip.previewUrl}
                  controls
                  playsInline
                  className="po-video"
                />
                <button
                  type="button"
                  className="po-link"
                  onClick={() => setClip(null)}
                >
                  Re-record
                </button>
              </div>
            ) : (
              <>
                {!recording && !draftClip && (
                  <button
                    type="button"
                    className="po-btn-secondary"
                    onClick={startRecording}
                  >
                    🎥 Record clip
                  </button>
                )}

                {cameraError && (
                  <>
                    <p className="po-hint">{cameraError}</p>
                    <label className="po-upload">
                      <input
                        type="file"
                        accept="video/*"
                        hidden
                        disabled={uploading !== null}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleClipFile(f);
                        }}
                      />
                      <span>
                        {uploading === "clip"
                          ? "Uploading…"
                          : "📤 Upload a video instead"}
                      </span>
                    </label>
                  </>
                )}

                <div style={{ display: recording ? "block" : "none" }}>
                  <video
                    ref={videoRef}
                    muted
                    playsInline
                    className="po-video"
                  />
                  <p className="po-timer">
                    ● {recordSecs}s / {MAX_CLIP_SECONDS}s
                  </p>
                  <button
                    type="button"
                    className="po-btn-secondary"
                    onClick={stopRecording}
                  >
                    Stop
                  </button>
                </div>

                <div style={{ display: !recording && draftClip ? "block" : "none" }}>
                  <video
                    ref={previewRef}
                    src={draftClip ?? undefined}
                    controls
                    playsInline
                    className="po-video"
                  />
                  <div className="po-row">
                    <button
                      type="button"
                      className="po-cta po-cta-sm"
                      disabled={uploading === "clip"}
                      onClick={useDraftClip}
                    >
                      {uploading === "clip" ? "Uploading…" : "Use this clip"}
                    </button>
                    <button
                      type="button"
                      className="po-btn-secondary"
                      onClick={discardDraftClip}
                    >
                      Re-record
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="po-card">
          <h2>Review &amp; submit</h2>
          <dl className="po-review">
            <div>
              <dt>Bio</dt>
              <dd>{bio}</dd>
            </div>
            <div>
              <dt>Interests</dt>
              <dd>{interests.join(", ")}</dd>
            </div>
            <div>
              <dt>Rates</dt>
              <dd>
                {hrNum ? `${formatUSD(hrNum)}/hr` : ""}
                {hrNum && erNum ? " · " : ""}
                {erNum ? `${formatUSD(erNum)}/evening` : ""}
                <span className="po-hint">
                  {" "}
                  — you keep 80% (
                  {hrNum ? formatUSD(companionReceives(hrNum)) + "/hr" : ""}
                  {hrNum && erNum ? ", " : ""}
                  {erNum
                    ? formatUSD(companionReceives(erNum)) + "/evening"
                    : ""}
                  )
                </span>
              </dd>
            </div>
            <div>
              <dt>Availability</dt>
              <dd>
                {days
                  .sort((a, b) => a - b)
                  .map((d) => DAYS_OF_WEEK[d].label)
                  .join(", ")}{" "}
                ·{" "}
                {TIMEFRAMES.filter((t) => timeframes.includes(t.id))
                  .map((t) => t.label)
                  .join(", ")}
              </dd>
            </div>
            <div>
              <dt>Verification</dt>
              <dd>ID ✓ · Selfie ✓ · Video clip ✓</dd>
            </div>
          </dl>
          <p className="po-hint">
            By submitting, you agree to PlusOne&apos;s strictly platonic terms:
            companionship only, always.
          </p>
        </section>
      )}

      <div className="po-nav">
        {step > 0 && (
          <button
            type="button"
            className="po-btn-secondary"
            onClick={back}
            disabled={submitting}
          >
            Back
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button type="button" className="po-cta po-cta-sm" onClick={next}>
            Continue
          </button>
        ) : (
          <button
            type="button"
            className="po-cta po-cta-sm"
            onClick={submit}
            disabled={submitting}
          >
            {submitting ? "Submitting…" : "Submit application"}
          </button>
        )}
      </div>
    </div>
  );
}
