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

## 2026-10-01 — Supabase workflow
- Cloud DB is truth (`csxalahmdhmbqejpjabp`). Never `supabase start` / local stack. Migrations apply via `supabase db push` to the linked cloud project.
- If a `supabase db query` command hits local DB instead of cloud, the local stack is running — run `supabase stop` first, then use the `--linked` flag. The project link is set via `supabase link --project-ref csxalahmdhmbqejpjabp`.
- When Karina corrects you on something already decided, put it in `.kilo/rules/project-decisions.md` the same session — that's what the self-improvement loop is for.

## 2026-10-01 — Booking date display bug
- `timeUntil()` shows "NaNm" for the time-until-event display on `/bookings/[id]`. Root cause: `start_time` from Postgres is `HH:MM:SS` (e.g. "18:00:00"), but the page constructs `new Date(\`${event_date}T${start_time}:00\`)` which produces "2026-12-15T18:00:00:00" — the extra `:00` is an invalid ISO 8601 time. Fix: strip the redundant `:00` suffix or use `bookingStartsAt` (which has the same bug).
