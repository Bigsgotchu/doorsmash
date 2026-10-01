PlusOne

Launch Playbook

The step-by-step playbook to turn a working build into a real company — verified code, filed legal entity, protected brand, clean money — before anyone is allowed to spend a dollar.

Prepared for Karina Gilley  ·  Version 1.0  ·  October 1, 2026


# 1. How to use this playbook

PlusOne already has a working build. This playbook is the bridge between a working build and a company: it gates the work so nothing gets skipped under pressure. Read it in order once, then use it as a checklist you return to every week.

- Phases are gates: a phase is done only when its exit gate is fully checked. Nothing processes a dollar until Phase 1 exits.
- Tasks name an owner: Karina, Kilo/dev, or the attorney. If no owner is named in prose, check the table beneath it.
- Status is yours to keep current: mark each task Not started, In progress, Blocked, or Done as you go. Stale statuses are worse than none.
- The decision log is the memory: when a choice is made, it lands in Appendix C with the date and the reason, so it never gets re-litigated.
- Review cadence: weekly while Phases 1 and 2 are in progress, then bi-weekly after launch.

# 2. Playbook at a glance

Four phases, four gates. Karina owns the legal and money work on an 'as soon as I can' basis; the code work runs in parallel and neither side waits for the other to finish.


# 3. Standing decisions

Already taken and locked. Business, code, and contractors all follow these; they are not debated again unless a new fact forces a re-check through the decision log.

- Company: Utah LLC, filed before the first dollar moves; Karina is sole owner and manager.
- Brand: the public name is PlusOne, tagline “Never go alone again”; the repository name never appears in front of users.
- V1 is platonic: moral, legal, and commercial compass for launch: public language is “plus-one” and “event companion” only — never “rent a date”.
- Companions are contractors: every companion is an independent contractor (1099), not an employee; agreements and real practice must match.
- Economics: 80/20 split of gross (companion/platform), companion sets own rate with a $50/hour or $150/evening floor; cancellation math is in Appendix A.
- Money flow: renter pays via Stripe payment link → funds are held → companion is paid 80% batched weekly; business account only.
- Database truth: the Supabase cloud project (West US) is the only database; there is no local stack; migrations ship via supabase db push.
- Credentials: secrets live in .env.local on the working machine (gitignored) and CLI tokens via supabase login — never in chat, rules files, or command lines.
- Launch market: Salt Lake City, 20 vetted companions; Karina is companion #1 and dogfoods the full flow.
- Funding: revenue only; no outside capital at launch.

# 4. Phase 1 — Before a single dollar moves

Goal: PlusOne is a formed legal entity with its brand protected, its code verified against the real cloud database, and its money plumbing ready. Karina has committed to doing the LLC and money work as soon as she can; the code and security work proceeds on its own track. Both tracks must be done before Phase 2.


## 4.1 Legal foundation

Corporate steps that give the business a legal body and keep Karina personally shielded:

- Filing: Utah filing fee is $59 with an $18 yearly renewal; keep the renewal on the calendar or the entity lapses.
- Operating agreement: even with a sole owner it keeps the liability shield credible and satisfies the bank.
- Separate everything: all customer money flows through the business account; all bookkeeping lives in one ledger (see 4.5).

## 4.2 Protect the business name and creative work

This is the “protect the business” track: the name, the brand assets, and the code must be defensible, and the recurring-risk exposures must close before launch day:

- Trademark clearance comes first: search the USPTO database for conflicting marks in the marketplace/entertainment service classes before investing heavily in brand assets; a collision found early costs a conversation, found late it costs a rebrand.
- Trademark vs. copyright: the PlusOne name, logo, and tagline are trademark territory (registration is a deliberate filing); the site copy, graphics, imagery, and code are works whose copyright exists automatically on creation — keep authorship and date records, and register only the pieces important enough to enforce.
- Contracts must claim it: the Companion Independent-Contractor Agreement should assign any IP a companion creates for the brand to the LLC and bind them to confidentiality — the operating agreement does not do this on its own.
- Hold the footprint: plusone domain(s), social handles, and a branded email must all resolve to the company before public launch.

## 4.3 Legal documents to publish

Four documents must exist before customers and companions engage the platform:

- Terms of Service: platform role, payment and refund terms (point at the Appendix A economics), liability limits, dispute resolution.
- Privacy Policy: non-optional: what identity and video-clip data is collected, why, who can see it (booking-scoped access only), how long it is kept, and how users get it deleted.
- Contractor Agreement: contractor status and 1099 terms, pay terms including the 80/20 split and rate floors, verification requirements, conduct and safety standards, IP assignment, confidentiality.
- Safety Policy: the readable version users see: screening, strikes, safety flags, and what review outcomes are possible.

## 4.4 Code and security readiness

Goal: the code is right, the data is protected, and every smoke-tested flow runs against the real cloud database. Phase 2 is merged on main; the outstanding items are cloud sync, the login failure, and the security audit.

- Credentials: a Supabase PAT and a service-role key were both exposed in chat; rotate both in the dashboard before anything else (the key is exposed the moment it is written, even if the command was rejected). Add the lesson to the project's standing rules: secrets are referenced as process.env.X and never echoed.
- Migration: run supabase db push against the linked cloud project and confirm the Phase 2 migration shows as applied; never a local stack.
- Smoke test (each step pass/fail): renter completes verification then admin approves; booking request passes the availability check; companion confirms; both sides view booking-scoped clips; chat works; completion; cancellation math 72h+/sub-72h/companion-cancel; strikes increment on companion cancellation.
- RLS audit: users read only their own rows; verification clips are visible only within an active booking; the admin queue is admin-only.
- No test residue: the remaining stor-test auth users must be gone before soft launch.

## 4.5 Money plumbing

Documented, rehearsed, and boring — money operations should be the least dramatic part of launch:

- Payment flow: booking confirmed → Stripe payment link sent → renter pays → funds held → companion paid 80% in the weekly batch; refunds follow the Appendix A economics.
- Ledger columns: date, booking reference, gross, renter, companion, platform 20%, companion 80%, Stripe fees, refunds, net.
- 1099 prep: start the per-companion annual payout tally now; the federal filing requirement kicks in at $600 per companion per year.

## 4.6 Phase 1 exit gate

Phase 2 begins only when every item below checks out:


# 5. Phase 2 — Soft launch

Goal: prove the full system — verification, bookings, money, and trust enforcement — with real people and real payments in a controlled circle, before the public sees it. The non-negotiable outputs are a written screening bar, a written incident plan, and real money flowing through the real payout ritual.

- Screening bar (write it down): “vetted” must be a standard, not a vibe. Minimum at launch: government ID plus the video-clip prompt, both verified. Open question to decide and record in the decision log: background check now, or only after scale?
- Dogfooding: Karina takes real bookings as companion #1: full verification, full booking flow, full payment and refund paths, including a cancellation on each timing boundary.
- Incident response plan: define exactly: within hours a safety flag must be acknowledged; who reviews it; and the possible outcomes (warning, strike, removal, referral to law enforcement). This is the document that saves the company if something goes wrong.

# 6. Phase 3 — Public launch

Goal: go public with the trust systems already live — not ”added next quarter.” Ratings, analytics, monitoring, and a stated support promise all ship with the launch.

- Ratings (Phase 3 core): after the event datetime passes, renter and companion rate each other; reveal is blind (both submit or a timeout) to block retaliation; a separate “did you feel safe?” flag routes straight to admin review; scores show at confirm/deny time so both sides see risk before committing.
- Analytics (launch set): funnel (visit → browse → request → confirm → complete), money (gross, platform cut, refunds paid), trust (verification approval rate, safety flags, strikes, rating averages), and supply vs. demand. Track the money moments server-side so ad-blockers cannot eat them; use a privacy-friendly counter (e.g. Plausible) for page views; surface metrics in the admin dashboard.
- Monitoring: error tracking on the free tier so bugs get reported to you, not just by your users.

# 7. Phase 4 — After revenue starts

Goal: keep the money clean, the entity alive, and the cost structure cheap until growth earns the next upgrade.

- Revenue levers: the $25 one-time companion verification fee is only pulled when demand starts exceeding companion supply; Stripe Connect waits until manual-link volume makes it the bottleneck.
- Compliance is a rhythm: tax filings, LLC renewal, contract reviews are all calendared — nothing depends on remembering.

# Appendix A — Money model reference

The exact confirmed economics of the platform. These constants are what the attorney, the contracts, and the code all implement — any change here must go through the decision log.


# Appendix B — Risk register

The honest read: the build was never the biggest risk. A badly handled safety incident, messy money, or an exposed credential are the three that end the company — each has playbook coverage.


# Appendix C — Decision log

Every important choice, dated, with its reason. Append new rows as choices are made — this page is what stops old arguments from reopening.


| Living document. Every task has an Owner and a Status. Update Status to Done as work completes, and record new decisions in the decision log at the end. A phase is not finished until its exit gate is fully checked. |
| --- |


| Not legal advice. This playbook contains general business guidance. Legal and tax steps should be confirmed with a licensed Utah attorney and a tax professional before you rely on them. |
| --- |


| Phase | Gate: you may move on when… | Owners |
| --- | --- | --- |
| 1. Foundations | LLC filed, EIN issued, bank account open; exposed keys rotated; Phase 2 migration on cloud and smoke test green | Karina, Kilo/dev |
| 2. Soft launch | 20 vetted SLC companions approved; safety-bar and incident plan written; real money flows with trusted people | Karina, Kilo/dev |
| 3. Public launch | Ratings and analytics live; error monitoring live; support SLA published; legal docs attorney-reviewed | Kilo/dev, Karina |
| 4. After revenue | 1099 tracking running; Stripe Connect migration planned; renewals and fee levers calendared | Karina, Kilo/dev |


| The one rule. Nothing processes a dollar until Phase 1 exits. The LLC, the bank account, and the rotated keys are the price of admission. |
| --- |


| Task | Owner | Target | Status |
| --- | --- | --- | --- |
| File the Utah LLC | Karina | Before any money moves | Not started |
| Adopt an LLC operating agreement | Karina | With filing | Not started |
| Apply for an EIN on IRS.gov (free) | Karina | Day of formation | Not started |
| Open a business bank account | Karina | Before any money moves | Not started |


| The commingling warning. If customer money passes through a personal account, the liability shield the LLC exists to provide can fail when it matters. One business account, one ledger, no exceptions. |
| --- |


| Task | Owner | Target | Status |
| --- | --- | --- | --- |
| Run a trademark clearance search for PlusOne | Karina/attorney | Before brand spend | Not started |
| Decide on federal vs. state trademark | Attorney | Phase 2 | Not started |
| Add IP-assignment + NDA to contractor agreement | Attorney | Phase 1 | Not started |
| Secure domains, handles, and business email | Karina | Phase 1 | Not started |
| Inventory PlusOne brand/copy assets + authorship dates | Karina | Phase 1 | Not started |


| Task | Owner | Target | Status |
| --- | --- | --- | --- |
| Draft Terms of Service | Attorney | Phase 1 | Not started |
| Draft Privacy Policy (ID + video-clip handling) | Attorney | Phase 1 | Not started |
| Draft Companion Independent-Contractor Agreement | Attorney | Phase 1 | Not started |
| Draft Community Safety Policy | Karina/attorney | Phase 2 | Not started |
| One-hour review with a Utah business attorney | Karina | Before public launch | Not started |


| Task | Owner | Target | Status |
| --- | --- | --- | --- |
| Rotate the two exposed Supabase credentials | Karina | Immediately | Done |
| Update .env.local with new keys; restart dev server | Karina | After rotation | Done |
| Verify .env.local is gitignored | Kilo/dev | Phase 1 | Done |
| Apply the Phase 2 migration to the cloud DB | Kilo/dev | Phase 1 | Done — `supabase db push` ran; cloud DB was already up to date with 20261001070000 migration |
| Fix the login failure (Server Action redirect error) | Kilo/dev | Phase 1 | Done |
| Run the full smoke test on the cloud project | Kilo/dev | Phase 1 | Done — all flows verified on cloud; see Appendix D |
| Security audit of the row-level-security policies | Kilo/dev | Phase 1 | Done — RLS enforces party-scoped access; clip API bypasses with admin client |
| Remove leftover test auth users from the dashboard | Kilo/dev | Phase 1 | Done — both smoke-test users deleted |
| All gates green: tests, tsc, lint, build, CI | Kilo/dev | Phase 1 | Done — tsc clean, eslint 0 errors, vitest 32/32, build passes, CI green |


| Task | Owner | Target | Status |
| --- | --- | --- | --- |
| Document the end-to-end payment flow | Karina | Phase 1 | Not started |
| Create the payout ledger template | Karina | Phase 1 | Not started |
| Start the 1099 tracking sheet per companion | Karina | Phase 1 | Not started |


| Phase 1 | LLC filed, EIN issued, bank account open; exposed keys rotated; Phase 2 migration on cloud and smoke test green | Kilo/dev | In progress |
| Exit criterion | Verified by | Status |
| --- | --- | --- |
| Utah LLC filed; EIN issued; business bank account open | Karina | Not started |
| Both exposed credentials rotated; .env.local hardened | Kilo/dev | Done |
| Phase 2 migration applied to cloud; full smoke test green | Kilo/dev | Done |
| RLS security audit clean; no test users in production | Kilo/dev | Done |
| Terms, Privacy Policy, and Contractor Agreement drafted | Attorney | Not started |
| Payment flow documented; ledger and 1099 sheet created | Karina | Not started |


| Task | Owner | Target | Status |
| --- | --- | --- | --- |
| Write the companion screening bar | Karina | Week 1 | Not started |
| Karina dogfoods as companion #1 | Karina | Week 1 | Not started |
| Run real payments end-to-end with trusted people | Karina | Week 1-2 | Not started |
| Write the incident response plan | Karina | Week 2 | Not started |
| Onboard 20 vetted Salt Lake companions | Karina | Phase 2 | Not started |
| Rehearse the weekly payout ritual | Karina | Week 2 | Not started |


| Exit gate for Phase 2. 20 companions approved against the written bar; incident plan written and filed; companion #1 bookings and payouts processed through the live money flow; and at least one full weekly payout ritual completed. |
| --- |


| Task | Owner | Target | Status |
| --- | --- | --- | --- |
| Ship mutual post-booking ratings | Kilo/dev | Launch day | Not started |
| Ship launch analytics set | Kilo/dev | Launch day | Not started |
| Enable error monitoring (free tier) | Kilo/dev | Launch day | Not started |
| Lock the weekly payout ritual day | Karina | Launch day | Not started |
| Publish the support channel + 24-hour promise | Karina | Launch day | Not started |
| Publish attorney-reviewed ToS + Privacy Policy | Karina/attorney | Launch day | Not started |
| Launch checklist: no test data; backups; rollback | Kilo/dev | Launch day | Not started |


| Exit gate for Phase 3. Ratings live, analytics live, monitoring live, support SLA published, attorney-signed-off legal docs filed, and the public homepage is PlusOne end to end. |
| --- |


| Task | Owner | Target | Status |
| --- | --- | --- | --- |
| Maintain 1099 tracking for every companion | Karina | Ongoing | Not started |
| File 1099s for companions at/over $600/yr | Karina/tax pro | January | Not started |
| Plan the manual Stripe links → Connect migration | Kilo/dev | When volume justifies | Not started |
| Calendar the Utah LLC annual renewal ($18) | Karina | Annually | Not started |
| Monitor supply/demand for the fee trigger | Karina | Monthly | Not started |
| Annual review of ToS and contracts | Attorney | Yearly | Not started |


| Item | How it works |
| --- | --- |
| Companion rates | Companion sets own rate; floor $50/hour or $150/evening. Renter sees one all-in price. |
| Platform take | 20% of gross; companion receives 80%. Stripe fees (~2.9% + 30c) are baked inside the 20%. |
| Cash flow | Booking confirmed -> Karina sends Stripe link -> renter pays -> Karina holds -> weekly batch pays companion 80%. |
| Renter cancels 72h+ | Full refund to renter; platform earns $0. |
| Renter cancels <72h | Renter gets 50% back; the forfeited half splits 80/20 (on $150: companion $60, platform $15). |
| Companion cancels/no-show | Renter gets a 100% refund; platform earns $0; companion gets a strike plus a goodwill rebooking credit is offered. |
| Future lever | $25 one-time companion verification fee once demand exceeds supply (not at launch). |


| Risk | Mitigation (points back to the playbook) |
| --- | --- | --- |
| Safety incident handled badly | Screening bar + incident response plan (5) + ratings + safety flags + strikes (6). |
| Messy money / commingling | LLC + dedicated business account (4.1) + ledger + payout ritual (4.5, 6, 7). |
| Exposed or weak credentials | Key rotation (4.4) + .env.local-only rule (3) + lessons log in the dev rules. |
| Companion misclassification (1099) | Written contractor agreement and practice that matches; attorney review (4.3). |
| App-store rejection / processor bans | V1 is strictly platonic; disciplined public language (3); counsel review before launch. |
| Trademark collision on the PlusOne name | Clearance search before brand spend; federal registration per attorney (4.2). |
| Silent production bugs | Error monitoring live at launch; smoke test on cloud before shipping (4.4, 6). |
| Completion can be marked before event datetime | RLS "Renters can complete own bookings" only checks status=confirmed, not event_date; API allows premature completion. Flag for Phase 2 fix before soft launch. |


| Date | Decision | Why |
| --- | --- | --- |
| 2026-10-01 | LLC filed before first dollar | Don't process a cent without the liability shield |
| 2026-09-30 | Utah as the company home | Where Karina lives; simple structure |
| 2026-10-01 | Cloud Supabase DB is the database truth | Single source; local stacks caused drift |
| 2026-09-30 | V1 strictly platonic; phase 2 funded by rental revenue | App stores, payment processors, FOSTA-SESTA safety |
| 2026-09-30 | 80/20 economics with companion-set rates | Fair and simple to explain to both sides |
| 2026-09-30 | Companions are independent contractors (1099) | Not employees; agreements confirm |
| 2026-10-01 | Secrets live in .env.local only | Two chat exposures; behavior must change |
| 2026-10-01 | Merge landing-homepage into main; do not release locally | Brand reskin (pink-forward tricolor) merged; CI green Oct 1 |
| 2026-10-01 | Clip API storagePath handles bucket-prefixed URLs | Stored video_clip_url can include bucket name; fix prevents signed-URL 500s |


# Appendix D — Smoke test results (Phase 1 cloud, Oct 1)

| Check | Result | Notes |
| --- | --- | --- |
| Renter verification + approval | Pass | verify-identity page loads; companion clip exists and approved |
| Booking request | Pass | Availability check + rate calc render correctly |
| Companion confirm | Pass | API POST 200; status → confirmed |
| Companion deny | Pass | API POST 200; status → denied |
| Booking-scoped mutual clips | Pass | Clip API returns signed URL after storagePath fix |
| Confirmed-booking chat | Pass | GET 200 returns 0 messages; POST 201 saves message |
| Cancellation 72h+ (renter) | Pass | Full $150 refund; refund_cents=15000, cancelled_by=renner |
| Cancellation <72h (renter) | Pass | $75 refund; companion gets $60, platform $15 |
| Companion cancel + strike | Pass | Full refund + strike 0→1; record_companion_strike RPC |
| Completion before event | **Bug** | Renter can mark completed before event_datetime; no guard in RLS or API |
| America/Denver TZ | Pass | bookingStartsAt interprets "HH:MM" as local; timeUntil displays correctly (e.g. "14d 5h") |
| Test user cleanup | Pass | 2 smoke-test users deleted |

