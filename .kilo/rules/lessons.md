# Lessons learned

## 2026-10-01 — Browser automation
- Observe before acting: snapshot the page or read the component source before choosing selectors. Never invent selectors from label text.
- `browser_evaluate` runs plain JavaScript — no TypeScript syntax (`as` casts, annotations).
- File uploads: `set_input_files` directly on `input[type="file"]`, even hidden. The visible control is often a `<label>`, not a `<button>`.
- Booking form uses id selectors: #br-title, #br-type, #br-date, #br-start, #br-end. Date/time inputs have no placeholder — fill with YYYY-MM-DD / HH:MM.
- Never fabricate `ref` values; use only refs from a fresh snapshot.
- Two-strike rule: after two failed selector attempts, read the component source instead of guessing again.

## 2026-10-01 — Credentials
- Tokens live in `.env.local` (gitignored), never in chat, rules, or memory files. Supabase CLI token persists via `supabase login`.
- When replacing code, remove the old code — don't leave both.
