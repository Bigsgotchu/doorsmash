"use client";

// PlusOne Phase 2: renter identity verification (ID + video clip).

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { PROMPT_PHRASES, MAX_CLIP_SECONDS, randomPromptPhrase } from "@/lib/plusone/constants";
import { submitRenterVerification } from "../actions";

async function uploadToBucket(bucket: string, file: Blob, ext: string): Promise<string> {
  const supabase = createBrowserSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You're not signed in. Please log in again.");
  const path = `${user.id}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: false });
  if (error) throw new Error(error.message);
  return path;
}

function extOf(name: string, fallback: string): string {
  const parts = name.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : fallback;
}

export default function VerifyIdentityForm({ next }: { next?: string }) {
  const router = useRouter();
  // Deterministic initial phrase: randomPromptPhrase() in the initializer
  // would differ between SSR and hydration and cause a mismatch.
  // (Matches the companion application form's pattern.)
  const [promptPhrase, setPromptPhrase] = useState<string>(PROMPT_PHRASES[0]);
  const [idDoc, setIdDoc] = useState<string | null>(null);
  const [clip, setClip] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const [draftClip, setDraftClip] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const previewRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const draftClipUrlRef = useRef<string | null>(null);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    setRecording(false);
  };

  async function handleIdFile(file: File) {
    setUploading("id");
    setErrors([]);
    try {
      const path = await uploadToBucket("verification-docs", file, extOf(file.name, "jpg"));
      setIdDoc(path);
    } catch (e) {
      setErrors([e instanceof Error ? e.message : "Upload failed."]);
    } finally {
      setUploading(null);
    }
  }

  async function startRecording() {
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
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "video/webm" });
        if (draftClipUrlRef.current) URL.revokeObjectURL(draftClipUrlRef.current);
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
      setCameraError("Couldn't access your camera. You can upload a video file instead.");
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  async function useDraftClip() {
    if (!draftClip) return;
    setUploading("clip");
    setErrors([]);
    try {
      const blob = await fetch(draftClip).then((r) => r.blob());
      const path = await uploadToBucket("verification-clips", blob, "webm");
      setClip(path);
      draftClipUrlRef.current = null;
      setDraftClip(null);
    } catch (e) {
      setErrors([e instanceof Error ? e.message : "Upload failed."]);
    } finally {
      setUploading(null);
    }
  }

  function discardDraftClip() {
    if (draftClipUrlRef.current) {
      URL.revokeObjectURL(draftClipUrlRef.current);
      draftClipUrlRef.current = null;
    }
    setDraftClip(null);
    if (previewRef.current) previewRef.current.src = "";
  }

  async function handleClipFile(file: File) {
    setUploading("clip");
    setErrors([]);
    try {
      const path = await uploadToBucket("verification-clips", file, extOf(file.name, "webm"));
      setClip(path);
    } catch (e) {
      setErrors([e instanceof Error ? e.message : "Upload failed."]);
    } finally {
      setUploading(null);
    }
  }

  async function submit() {
    setSubmitting(true);
    setErrors([]);
    const result = await submitRenterVerification({
      id_document_url: idDoc!,
      video_clip_url: clip!,
      prompt_phrase: promptPhrase,
    });
    if (!result.ok) {
      setSubmitting(false);
      setErrors(
        Object.values(result.errors ?? {}).flat().length > 0
          ? Object.values(result.errors ?? {}).flat()
          : ["Something went wrong. Please try again."],
      );
      window.scrollTo({ top: 0 });
      return;
    }
    setDone(true);
    if (next) {
      router.push(next);
    }
  }

  if (done && !next) {
    return (
      <div>
        <p className="po-success">
          ✓ Verification submitted. We&apos;ll review it and notify you —
          usually within a day.
        </p>
        <Link href="/companions" className="po-btn">
          Browse companions
        </Link>
      </div>
    );
  }

  return (
    <div className="po-form">
      {errors.length > 0 && (
        <div className="po-error">
          {errors.map((e, i) => (
            <p key={i} style={{ margin: 0 }}>{e}</p>
          ))}
        </div>
      )}

      <section className="po-section-card">
        <h2>1 · Photo ID</h2>
        <p className="po-hint">
          Upload a driver&apos;s license, passport, or state ID. It stays
          private — only our review team sees it.
        </p>
        {idDoc ? (
          <p className="po-success">✓ ID uploaded.</p>
        ) : (
          <label className="po-btn po-btn-secondary" style={{ cursor: "pointer" }}>
            <input
              type="file"
              accept="image/*"
              hidden
              disabled={uploading !== null}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleIdFile(f);
              }}
            />
            {uploading === "id" ? "Uploading…" : "📤 Upload ID"}
          </label>
        )}
      </section>

      <section className="po-section-card">
        <h2>2 · Video clip</h2>
        <p className="po-hint">
          Record a {MAX_CLIP_SECONDS}-second clip saying this phrase on camera:{" "}
          <strong>“{promptPhrase}”</strong>{" "}
          <button
            type="button"
            className="po-link"
            onClick={() => setPromptPhrase(randomPromptPhrase())}
          >
            New phrase
          </button>
        </p>
        {clip ? (
          <p className="po-success">✓ Clip uploaded.</p>
        ) : (
          <>
            {!recording && !draftClip && (
              <button type="button" className="po-btn po-btn-secondary" onClick={startRecording}>
                🎥 Record clip
              </button>
            )}
            {cameraError && (
              <>
                <p className="po-hint">{cameraError}</p>
                <label className="po-btn po-btn-secondary" style={{ cursor: "pointer" }}>
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
                  {uploading === "clip" ? "Uploading…" : "📤 Upload a video instead"}
                </label>
              </>
            )}
            <div style={{ display: recording ? "block" : "none" }}>
              <video ref={videoRef} muted playsInline className="po-clip" />
              <p className="po-hint">● {recordSecs}s / {MAX_CLIP_SECONDS}s</p>
              <button type="button" className="po-btn po-btn-secondary" onClick={stopRecording}>
                Stop
              </button>
            </div>
            <div style={{ display: !recording && draftClip ? "block" : "none" }}>
              <video ref={previewRef} src={draftClip ?? undefined} controls playsInline className="po-clip" />
              <div className="po-btn-row">
                <button
                  type="button"
                  className="po-btn"
                  disabled={uploading === "clip"}
                  onClick={useDraftClip}
                >
                  {uploading === "clip" ? "Uploading…" : "Use this clip"}
                </button>
                <button type="button" className="po-btn po-btn-secondary" onClick={discardDraftClip}>
                  Re-record
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      <button
        type="button"
        className="po-btn"
        disabled={submitting || !idDoc || !clip}
        onClick={submit}
      >
        {submitting ? "Submitting…" : "Submit for verification"}
      </button>
    </div>
  );
}
