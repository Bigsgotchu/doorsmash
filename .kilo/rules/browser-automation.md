# Browser automation rules

Every browser/playwright tool call must follow these. Violating them wastes the user's time.

## 1. Observe before acting
- Before interacting with any page, take a fresh accessibility snapshot — or read the component source in the repo.
- NEVER invent a selector from visible label text. `input[placeholder="Date"]` is a guess; check whether that placeholder exists first.
- Prefer selectors in this order: element `id` (`#br-date`) → associated `<label>` → role + accessible name. Placeholder text is a last resort and usually wrong.

## 2. No fabricated refs
- `ref` values (e.g. `div[ref="f1e11"]`) come only from a fresh snapshot. Never make one up.

## 3. browser_evaluate runs plain JavaScript
- No TypeScript: no `as` casts, no type annotations, no interfaces.
- Build the complete script string first. If it is undefined or empty, DO NOT call the tool.

## 4. File uploads
- Use `set_input_files` directly on the `input[type="file"]`, even if hidden — Playwright handles it.
- The visible "Upload" control is often a `<label>`, not a `<button>`. Don't click it first.

## 5. Date/time inputs
- Fill with `page.fill`: dates as `YYYY-MM-DD`, times as `HH:MM`.

## 6. Two-strike rule
- If two selector attempts fail, STOP guessing. Read the component source (`app/.../_components/`) and use the real markup. A third guess is never the answer.
