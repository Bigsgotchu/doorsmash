"use client";

import { useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { GENDER_OPTIONS } from "@/lib/types";

interface ProfileFormProps {
  profile: Profile | null;
}

export default function ProfileForm({ profile }: ProfileFormProps) {
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(
    profile?.primary_photo_url ?? null,
  );
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    display_name: profile?.display_name ?? "",
    age: profile?.age ?? "",
    bio: profile?.bio ?? "",
    neighborhood: profile?.neighborhood ?? "",
    location: profile?.location ?? "",
    distance_preference: profile?.distance_preference ?? 25,
    gender: profile?.gender ?? "",
    gender_preference: profile?.gender_preference ?? "",
  });

  const handleChange = (field: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const uploadPhoto = async (file: File) => {
    setUploading(true);
    setError(null);

    const fileExt = file.name.split(".").pop();
    const fileName = `${profile?.id ?? "temp"}-${Date.now()}.${fileExt}`;
    const filePath = `${profile?.id ?? "temp"}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("profile-photos")
      .upload(filePath, file);

    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from("profile-photos")
      .getPublicUrl(filePath);

    setPhotoPreview(publicUrl);
    handleChange("primary_photo_url", publicUrl);
    setUploading(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadPhoto(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Basic validation
    if (!formData.display_name || !formData.age) {
      setError("Name and age are required.");
      return;
    }

    const ageNum = parseInt(formData.age as unknown as string);
    if (isNaN(ageNum) || ageNum < 18 || ageNum > 100) {
      setError("Age must be between 18 and 100.");
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/profiles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...formData,
            age: ageNum,
            is_profile_complete: true,
            primary_photo_url: photoPreview,
          }),
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || "Failed to save profile");
        }

        router.push("/");
        router.refresh();
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : "Something went wrong",
        );
      }
    });
  };

  return (
    <form className="profile-setup-form" onSubmit={handleSubmit}>
      {error && <p className="form-error">{error}</p>}

      <div className="photo-upload">
        {photoPreview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoPreview}
            alt="Profile preview"
            className="photo-preview"
          />
        ) : (
          <div className="photo-placeholder">
            <span aria-hidden="true">📷</span>
            <span>Add a photo</span>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          disabled={uploading}
          className="file-input"
        />
        <button
          type="button"
          className="photo-button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? "Uploading…" : photoPreview ? "Change photo" : "Add photo"}
        </button>
      </div>

      <div className="field-group">
        <label htmlFor="display_name">Name</label>
        <input
          id="display_name"
          type="text"
          value={formData.display_name}
          onChange={(e) => handleChange("display_name", e.target.value)}
          placeholder="Jane"
          maxLength={50}
          required
        />
      </div>

      <div className="field-group">
        <label htmlFor="age">Age</label>
        <input
          id="age"
          type="number"
          value={formData.age}
          onChange={(e) => handleChange("age", e.target.value)}
          placeholder="28"
          min={18}
          max={100}
          required
        />
      </div>

      <div className="field-group">
        <label htmlFor="neighborhood">Neighborhood</label>
        <input
          id="neighborhood"
          type="text"
          value={formData.neighborhood}
          onChange={(e) => handleChange("neighborhood", e.target.value)}
          placeholder="Silver Lake"
          maxLength={100}
        />
      </div>

      <div className="field-group">
        <label htmlFor="location">Location</label>
        <input
          id="location"
          type="text"
          value={formData.location}
          onChange={(e) => handleChange("location", e.target.value)}
          placeholder="Los Angeles, CA"
          maxLength={100}
        />
      </div>

      <div className="field-group">
        <label htmlFor="bio">About me</label>
        <textarea
          id="bio"
          value={formData.bio}
          onChange={(e) => handleChange("bio", e.target.value)}
          placeholder="A little about you..."
          maxLength={500}
          rows={3}
        />
      </div>

      <div className="field-group">
        <label>Distance preference (miles)</label>
        <input
          type="range"
          min={1}
          max={100}
          value={formData.distance_preference}
          onChange={(e) =>
            handleChange("distance_preference", parseInt(e.target.value))
          }
        />
        <span className="range-value">{formData.distance_preference} mi</span>
      </div>

      <div className="field-group">
        <label>Gender</label>
        <div className="radio-group">
          {GENDER_OPTIONS.map((g) => (
            <label key={g} className="radio-option">
              <input
                type="radio"
                name="gender"
                value={g}
                checked={formData.gender === g}
                onChange={() => handleChange("gender", g)}
              />
              <span>{g}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="field-group">
        <label>Show me</label>
        <div className="radio-group">
          {GENDER_OPTIONS.map((g) => (
            <label key={g} className="radio-option">
              <input
                type="radio"
                name="gender_preference"
                value={g}
                checked={formData.gender_preference === g}
                onChange={() => handleChange("gender_preference", g)}
              />
              <span>{g}</span>
            </label>
          ))}
        </div>
      </div>

      <button
        type="submit"
        className="auth-submit"
        disabled={isPending || uploading}
      >
        {isPending ? "Saving…" : profile?.is_profile_complete ? "Save changes" : "Save profile"}
      </button>
    </form>
  );
}
