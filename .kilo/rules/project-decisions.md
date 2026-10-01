# Project decisions — standing, do not re-litigate

- **Cloud DB is truth.** Supabase project `csxalahmdhmbqejpjabp` (West US). Never `supabase start` / local stack. Migrations in `supabase/migrations/` apply via `supabase db push` to the linked cloud project. If a command hits local, the link is wrong — fix it with `supabase link --project-ref csxalahmdhmbqejpjabp`.
- **Repo** is `Bigsgotchu/doorsmash`; users only ever see **PlusOne**.
- **Credentials** live in `.env.local` (gitignored). Never in chat, rules, or inline in commands — always `process.env.X`. CLI tokens persist via `supabase login`.
- **When replacing code, remove the old** — never leave both.
- **V1 is platonic.** Public language: "plus-one" / "event companion", never "rent a date".
