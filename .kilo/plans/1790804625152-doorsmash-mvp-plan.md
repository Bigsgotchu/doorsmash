# DoorSmash MVP — Web App Implementation Plan

## Goal

Transform the existing UI mockup (`app/page.tsx` + `app/globals.css`) into a live, deployed DoorSmash web app on Vercel with real Supabase authentication, database, matching logic, chat, and date scheduling.

**Core loop to prove**: Signup → Profile Setup → Discover → Smash → Match → Chat → Send Date Card

## Current State

| Layer | Status | Details |
|-------|--------|---------|
| Next.js 16.3.8 + React 19.2 + TS + Tailwind v4 | ✅ Ready | Fresh create-next-app project |
| UI mockup | ✅ Complete | `app/page.tsx` (384 lines) — all 4 sections (Discover/Matches/Messages/Profile), match modal, chat modal, schedule modal. 100% mock data + 1740 lines of responsive CSS |
| Auth | ❌ None | No login/signup. Fake "Karina" user in UI |
| Backend | ❌ None | No API routes, no server actions, no `proxy.ts` |
| Database | ❌ None | No schema, no Supabase |
| Storage | ❌ None | Profile photos not wired |
| Deployment | ❌ None | No Vercel config, no env vars |

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| Styles | Tailwind CSS v4 (existing `globals.css` preserved) |
| Auth | Supabase Auth (email/password) |
| Database | Supabase (PostgreSQL with RLS) |
| Storage | Supabase Storage (profile photos) |
| Realtime | Supabase Realtime (chat messages) |
| Deploy | Vercel |
| Env | `.env.local` → Vercel Environment Variables |

---

## Key Next.js 16 Constraints

- `middleware.ts` → **`proxy.ts`** (file and export renamed)
- `cookies()`, `headers()`, `draftMode()` are **async-only** — `await cookies()` etc.
- `params` and `searchParams` in page/route handlers are **Promises** — `await params`
- Turbopack is default for `next dev` and `next build`
- `next lint` command removed — run `npx eslint .` directly
- Use `NEXT_PUBLIC_` prefix for client-exposed env vars
- `serverRuntimeConfig` / `publicRuntimeConfig` removed — use `process.env` directly

---

## Phase 0: Foundation Setup

### 0.1 Install Dependencies

```bash
npm install @supabase/supabase-js @supabase/ssr
npm install -D @supabase/auth-js @types/node
```

Update `package.json` scripts:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint ."
  }
}
```

### 0.2 Environment Variables

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

> **Note**: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are safe to expose client-side. `SUPABASE_SERVICE_ROLE_KEY` stays server-only.

### 0.3 Update `.gitignore`

The existing `.gitignore` already ignores `.env*` — verified OK.

---

## Phase 1: Supabase Infrastructure

### 1.1 Create Supabase Project

1. Go to [supabase.com](https://supabase.com), create a new project
2. Note: Project URL, anon (publishable) key, service_role key
3. Enable Auth → Authentication settings:
   - Set site URL to `http://localhost:3000` (dev) and `https://doorsmash.vercel.app` (prod)
   - Enable email confirmations (recommended for MVP)
   - Set redirect URLs: `http://localhost:3000/auth/callback`, `https://doorsmash.vercel.app/auth/callback`

### 1.2 Database Schema

Run this SQL in the Supabase SQL Editor:

```sql
-- Trigger: create profile on signup
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, created_at)
  values (new.id, new.email, null, now());
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Table: profiles
create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text unique not null,
  full_name text,
  display_name text,
  age integer check (age > 0),
  bio text,
  neighborhood text,
  location text,
  distance_preference integer default 25,       -- miles
  gender text,
  gender_preference text,
  primary_photo_url text,
  is_verified boolean default false,
  is_profile_complete boolean default false,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- Table: swipes (one-way likes)
create table public.swipes (
  id bigint generated always as identity primary key,
  swiper_id uuid references public.profiles(id) on delete cascade not null,
  target_id uuid references public.profiles(id) on delete cascade not null,
  direction text check (direction in ('like', 'pass')) not null,
  created_at timestamp with time zone default now() not null,
  unique (swiper_id, target_id)
);

-- Table: matches (mutual likes)
create table public.matches (
  id uuid default gen_random_uuid() primary key,
  user_a uuid references public.profiles(id) on delete cascade not null,
  user_b uuid references public.profiles(id) on delete cascade not null,
  created_at timestamp with time zone default now() not null,
  unique (user_a, user_b)
);

create index on public.matches (user_a);
create index on public.matches (user_b);

-- Table: conversations (1:1 chat)
create table public.conversations (
  id uuid default gen_random_uuid() primary key,
  match_id uuid references public.matches(id) on delete cascade,
  user_a uuid references public.profiles(id) on delete cascade,
  user_b uuid references public.profiles(id) on delete cascade,
  created_at timestamp with time zone default now() not null,
  unique (user_a, user_b)
);

-- Table: messages
create table public.messages (
  id bigint generated always as identity primary key,
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  sender_id uuid references public.profiles(id) on delete cascade not null,
  content text check (length(content) > 0) not null,
  created_at timestamp with time zone default now() not null
);

create index on public.messages (conversation_id, created_at);

-- Table: date_ideas (catalog)
create table public.date_ideas (
  id bigint generated always as identity primary key,
  title text not null,
  category text not null,           -- 'DINNER', 'WALK', 'DRINKS', etc.
  description text,
  image_url text,
  created_at timestamp with time zone default now() not null
);

-- Table: date_proposals (sent within a match)
create table public.date_proposals (
  id uuid default gen_random_uuid() primary key,
  match_id uuid references public.matches(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete cascade,
  proposer_id uuid references public.profiles(id) on delete cascade,
  date_idea_id bigint references public.date_ideas(id),
  custom_title text,
  location_name text,
  proposed_at timestamp with time zone,
  proposed_time timestamp with time zone not null,
  note text,
  status text check (status in ('pending', 'accepted', 'declined')) default 'pending' not null,
  created_at timestamp with time zone default now() not null
);

create index on public.date_proposals (match_id);

-- Table: notifications
create table public.notifications (
  id bigint generated always as identity primary key,
  recipient_id uuid references public.profiles(id) on delete cascade not null,
  type text check (type in ('match', 'message', 'date_proposal')) not null,
  title text not null,
  body text,
  data jsonb,
  read boolean default false not null,
  created_at timestamp with time zone default now() not null
);

create index on public.notifications (recipient_id, read, created_at);

-- Table: reports / blocks
create table public.reports (
  id bigint generated always as identity primary key,
  reporter_id uuid references public.profiles(id) on delete cascade not null,
  reported_id uuid references public.profiles(id) on delete cascade not null,
  reason text check (reason in ('inappropriate', 'spam', 'harassment', 'other')) not null,
  details text,
  status text check (status in ('pending', 'reviewed', 'resolved')) default 'pending' not null,
  created_at timestamp with time zone default now() not null
);

-- Table: blocked_users
create table public.blocked_users (
  id bigint generated always as identity primary key,
  blocker_id uuid references public.profiles(id) on delete cascade not null,
  blocked_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamp with time zone default now() not null,
  unique (blocker_id, blocked_id)
);

-- Table: admin_users
create table public.admin_users (
  id uuid references public.profiles(id) on delete cascade not null primary key,
  created_at timestamp with time zone default now() not null
);
```

### 1.3 RLS (Row Level Security) Policies

Enable RLS on every table above, then add policies:

```sql
-- Security definer function to check admin
create function public.is_admin(user_id uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admin_users where id = user_id);
$$;

-- profiles: users can read all profiles (except blocked users), update own
alter table public.profiles enable row level security;

create policy "Profiles are viewable by authenticated users"
  on public.profiles for select using (auth.uid() is not null);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- swipes: users can insert own swipes, read all
alter table public.swipes enable row level security;

create policy "Users can create swipes for themselves"
  on public.swipes for insert
  with check (auth.uid() = swiper_id);

create policy "Users can read all swipes"
  on public.swipes for select using (auth.uid() is not null);

-- matches: both participants can read
alter table public.matches enable row level security;

create policy "Match participants can view"
  on public.matches for select
  using (auth.uid() = user_a or auth.uid() = user_b);

-- conversations: participants can read/write
alter table public.conversations enable row level security;

create policy "Conversation participants can access"
  on public.conversations for all
  using (auth.uid() = user_a or auth.uid() = user_b)
  with check (auth.uid() = user_a or auth.uid() = user_b);

-- messages: participants of the conversation can read/write
alter table public.messages enable row level security;

create policy "Conversation participants can read messages"
  on public.messages for select
  using (
    exists (
      select 1 from public.conversations
      where conversations.id = messages.conversation_id
      and (conversations.user_a = auth.uid() or conversations.user_b = auth.uid())
    )
  );

create policy "Conversation participants can send messages"
  on public.messages for insert
  with check (
    exists (
      select 1 from public.conversations
      where conversations.id = messages.conversation_id
      and (conversations.user_a = auth.uid() or conversations.user_b = auth.uid())
    )
  );

-- date_ideas: viewable by all authenticated, insert by admin only
alter table public.date_ideas enable row level security;

create policy "Date ideas viewable by authenticated users"
  on public.date_ideas for select using (auth.uid() is not null);

create policy "Admin can manage date ideas"
  on public.date_ideas for all using (public.is_admin(auth.uid()));

-- date_proposals: match participants can view/create
alter table public.date_proposals enable row level security;

create policy "Match participants can view proposals"
  on public.date_proposals for select using (
    exists (
      select 1 from public.matches m
      where m.id = date_proposals.match_id
      and (m.user_a = auth.uid() or m.user_b = auth.uid())
    )
  );

create policy "Match participants can create proposals"
  on public.date_proposals for insert
  with check (
    exists (
      select 1 from public.matches m
      where m.id = date_proposals.match_id
      and (m.user_a = auth.uid() or m.user_b = auth.uid())
    )
  );

-- notifications: recipients can read
alter table public.notifications enable row level security;

create policy "Users can read own notifications"
  on public.notifications for select using (auth.uid() = recipient_id);

-- reports: reporter can create, admin can read/update
alter table public.reports enable row level security;

create policy "Users can report"
  on public.reports for insert with check (auth.uid() = reporter_id);

create policy "Admins can manage reports"
  on public.reports for all using (public.is_admin(auth.uid()));

-- blocked_users: blocker can manage own blocks
alter table public.blocked_users enable row level security;

create policy "Users can manage own blocks"
  on public.blocked_users for all using (auth.uid() = blocker_id) with check (auth.uid() = blocker_id);

-- admin_users: admin-only
alter table public.admin_users enable row level security;

create policy "Admin only" on public.admin_users for all using (public.is_admin(auth.uid()));
```

### 1.4 Storage Buckets

In Supabase Dashboard → Storage → Create Bucket:

| Bucket | Purpose |
|--------|---------|
| `profile-photos` | User profile photos |
| `date-photos` | Date idea images |

Add RLS policies for storage (allow authenticated users to read; users can upload to own profile path).

### 1.5 Seed Data

Insert a few date ideas into `public.date_ideas` so the Date Cards column has real content.

---

## Phase 2: Supabase Client Layer

### 2.1 Client-Side Client (`lib/supabase/client.ts`)

```ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
```

### 2.2 Server-Side Client (`lib/supabase/server.ts`)

Uses the **async** `cookies()` API (Next.js 16 requirement):

```ts
import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookieStore.set(cookiesToSet);
        },
      },
    },
  );
}
```

### 2.3 Auth Helpers (`lib/supabase/auth.ts`)

Server-only functions using the server client:

```ts
import "server-only";
import { createClient } from "./server";

export async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getUserProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles").select("*").eq("id", user.id).single();
  return profile;
}
```

---

## Phase 3: Auth Flow & Router Structure

### 3.1 Route Groups

Restructure `app/`:

```
app/
├── (auth)/                    # Public auth pages
│   ├── login/
│   │   └── page.tsx           # Login + signup form
│   ├── auth/
│   │   ├── callback/
│   │   │   └── route.ts       # OAuth + PKCE callback handler
│   │   └── signout/
│   │       └── route.ts       # Logout endpoint
│   └── confirm/
│       └── page.tsx           # Email confirmation handler
├── (app)/                     # Protected app (all existing UI)
│   └── page.tsx               # Refactored main page
├── profile/                   # Profile setup/edit
│   ├── page.tsx
│   └── edit/
│       └── page.tsx
├── admin/                     # Admin dashboard
│   └── page.tsx
├── api/                       # Route handlers
│   ├── profiles/
│   │   ├── route.ts           # GET (list for discovery), POST (update profile)
│   │   └── [id]/route.ts      # GET single profile
│   ├── swipes/
│   │   └── route.ts           # POST swipe, GET recent swipes
│   ├── matches/
│   │   └── route.ts           # GET user's matches
│   ├── conversations/
│   │   └── route.ts           # POST create conversation
│   ├── messages/
│   │   └── route.ts           # GET messages, POST message
│   ├── date-ideas/
│   │   └── route.ts           # GET date ideas
│   ├── date-proposals/
│   │   └── route.ts           # POST proposal, GET proposals
│   ├── notifications/
│   │   └── route.ts           # GET unread count, POST notification
│   ├── reports/
│   │   └── route.ts           # POST report
│   └── admin/
│       └── reports/
│           └── route.ts       # GET/PUT reports (admin only)
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── auth.ts
│   ├── types.ts               # Shared TypeScript types
│   └── utils.ts               # Utility functions
├── proxy.ts                   # Next.js 16 proxy (replaces middleware)
├── app/
│   └── globals.css            # Existing CSS preserved
└── layout.tsx
```

### 3.2 Auth Pages

#### 3.2.1 Login/Signup Page (`app/(auth)/login/page.tsx`)

Uses Supabase `signInWithPassword` / `signUp`. Server Action for form submission.

- Email + password fields
- Toggle between Login and Sign Up
- "Continue with Google" button (optional for MVP)

#### 3.2.2 Auth Callback (`app/(auth)/auth/callback/route.ts`)

Handles PKCE flow after OAuth:

```ts
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next")?.replace(/^\/+/, "") || "";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const redirectTo = next ? `/${next}` : "/profile";
      return redirect(redirectTo);
    }
  }
  return redirect("/auth/auth-code-error");
}
```

#### 3.2.3 Signout (`app/(auth)/auth/signout/route.ts`)

```ts
export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return redirect("/login");
}
```

### 3.3 Proxy for Auth Protection (`proxy.ts`)

**Critical**: Next.js 16 uses `proxy.ts` instead of `middleware.ts`. The export is named `proxy`.

```ts
import { updateSession } from "@/lib/supabase/middleware";
import type { NextRequest } from "next/server";

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};

export async function proxy(request: NextRequest) {
  return updateSession(request);
}
```

The `updateSession` function in `lib/supabase/middleware.ts` handles:
1. Create server client from cookies
2. Refresh session
3. Redirect unauthenticated users to `/login` when accessing protected routes
4. Redirect authenticated users away from `/login`
5. Write session cookies to response

---

## Phase 4: Backend API Routes

### 4.1 Profiles API (`api/profiles/route.ts`)

**GET** — Returns profiles for discovery (filtered by preferences, excluding blocked/swiped):

```ts
// Returns up to 10 candidate profiles for the logged-in user
// Filters: blocked users, already-swiped, location distance
```

**POST** — Update the logged-in user's profile (name, bio, photos, preferences).

### 4.2 Swipes API (`api/swipes/route.ts`)

**POST** — Record a swipe (like/pass):

```ts
// 1. Insert swipe row
// 2. If direction === 'like':
//    a. Check if target also liked this user → create match
//    b. Create conversation if match
//    c. Notify target of match
// 3. Return { matched: boolean }
```

### 4.3 Matches API (`api/matches/route.ts`)

**GET** — Returns the logged-in user's matches with last message + unread count.

### 4.4 Conversations API (`api/conversations/route.ts`)

**GET** — List all conversations for the user.
**POST** — Create a new conversation (used internally during match).

### 4.5 Messages API (`api/messages/route.ts`)

**GET** — Paginated message history for a conversation.
**POST** — Send a new message, also creates a notification for recipient.

### 4.6 Date Ideas API (`api/date-ideas/route.ts`)

**GET** — Returns all date ideas (public catalog, seeded data).

### 4.7 Date Proposals API (`api/date-proposals/route.ts`)

**POST** — Propose a date within a match (sends to chat as a date card).
**GET** — Get proposals for a match.

### 4.8 Notifications API (`api/notifications/route.ts`)

**GET** — Return unread notifications for the user.
**POST** — Internal endpoint for creating notifications (called by Server Actions on swipe/match/message events).

### 4.9 Reports API (`api/reports/route.ts`)

**POST** — Block/report a user. Creates a report row + blocked_user row.

### 4.10 Admin Reports API (`api/admin/reports/route.ts`)

**GET** — Admin-only: list pending reports.
**PUT** — Admin-only: update report status (reviewed/resolved).

---

## Phase 5: Frontend Integration

### 5.1 Refactoring `app/page.tsx` (the main app shell)

The existing `page.tsx` has beautiful UI with tab navigation (Discover/Matches/Messages/Profile) and modal overlays. The approach:

**Strategy**: Keep the visual layout and CSS intact. Lift the component into `/app/(app)/page.tsx` as a protected route. Replace:
- Hardcoded `profiles[]` array → Supabase query
- Hardcoded `matches[]` array → Supabase query  
- Hardcoded `messages[]` array → Supabase Realtime subscription
- `smashProfile()` → POST to `/api/swipes`
- `sendMessage()` → POST to `/api/messages`
- `proposeDate()` → POST to `/api/date-proposals`
- `advanceProfile()` / `setProfileIndex` → fetch next profile from API
- `profileIndex` → local index into fetched candidates

**Client-Side Supabase**: The main page already uses `"use client"`. Keep it that way and use `createBrowserClient()` directly for:
- Fetching discovery profiles (on load + after swipe)
- Fetching matches list
- Subscribing to realtime messages
- Subscribing to realtime notifications

### 5.2 Profile Setup Flow (`app/profile/page.tsx`)

New page that renders when `is_profile_complete = false`:

- Display name input
- Age input
- BIO textarea
- Neighborhood / location input
- Distance preference slider
- Gender + preference radios
- Photo upload (file picker → Supabase Storage)
- "Save profile" button → API POST → sets `is_profile_complete = true` → redirect to `/(app)/page`

### 5.3 Profile Edit (`app/profile/edit/page.tsx`)

Same form, pre-filled with existing profile data.

### 5.4 Matching Logic (in the Smash handler)

```ts
// On smash:
// 1. POST /api/swipes { target_id, direction: 'like' }
// 2. API checks if target also swiped 'like' on this user
// 3. If mutual: create match, create conversation, create notification, show "It's a match" modal
// 4. If not mutual: just advance to next profile
// 5. Always advance to next candidate profile from /api/profiles
```

### 5.5 Chat — Real-time via Supabase Realtime

```ts
const supabase = createClient();
const channel = supabase
  .channel(`messages:conversation_id=eq.${conversationId}`)
  .on(
    "postgres_changes",
    {
      event: "INSERT",
      schema: "public",
      table: "messages",
      filter: `conversation_id=eq.${conversationId}`,
    },
    (payload) => {
      setMessages((prev) => [...prev, payload.new]);
    },
  )
  .subscribe();

return () => supabase.removeChannel(channel);
```

### 5.6 Auth State Provider

Create `lib/providers/supabase-provider.tsx` — a client component that:
- Creates the browser client
- Provides it via React Context
- Tracks auth state changes
- Shows login page when unauthenticated

Wrap the root layout children with this provider.

### 5.7 Admin Route

`app/admin/page.tsx` — Server Component that:
1. Checks `public.is_admin(auth.uid())` via server client
2. If not admin → redirect to `/login` or 404
3. If admin → fetch pending reports from API
4. Display report list with action buttons (block user, dismiss report)

---

## Phase 6: Types

### 6.1 Shared TypeScript Types (`lib/types.ts`)

```ts
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
```

---

## Phase 7: Testing

### 7.1 Test Framework

Add Vitest (lightweight, works with Next.js/TS out of the box):

```bash
npm install -D vitest @testing-library/react @testing-library/user-event @testing-library/jest-dom happy-dom
```

### 7.2 Test Files

```
__tests__/
├── api/
│   ├── swipes.test.ts        # Swipe → match logic
│   ├── messages.test.ts      # Message insertion + notification
│   └── auth.test.ts          # Auth guards
├── components/
│   └── ui.test.tsx           # Critical UI state transitions
└── lib/
    └── utils.test.ts         # Utility functions
```

### 7.3 Test Commands

Add to `package.json`:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "happy-dom",
    setupFiles: ["./vitest.setup.ts"],
  },
});
```

---

## Phase 8: Validation & Deployment

### 8.1 Pre-Deploy Validation

Run in this order:

```bash
npm run lint          # ESLint flat config
npx tsc --noEmit      # Type check
npm run test          # Vitest unit tests
npm run build         # Production build (Turbopack)
```

### 8.2 Vercel Deployment

1. Push to GitHub (create repo `doorsmash-web` or use existing)
2. Import project into Vercel
3. In Vercel Dashboard → Settings → Environment Variables, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Set up Supabase Edge Functions for notifications (optional — can use polling as fallback)
5. Deploy: `git add . && git commit -m "MVP" && git push`

### 8.3 Post-Deploy Smoke Test

- Visit the deployed URL
- Sign up with a test email
- Create a profile
- Verify Supabase Auth email confirmation flow
- Verify discovery loads real profiles from DB
- Verify swipe → match flow
- Verify chat works in real-time

---

## Phase 9: Seed Data for Testing

### 9.1 Seed Profiles

Insert 5-10 fake profiles into `auth.users` + `public.profiles` via SQL so discovery has data.

### 9.2 Seed Date Ideas

```sql
insert into public.date_ideas (title, category, description, image_url) values
  ('Pasta & a little gossip', 'DINNER', 'Sorella · 7:00 pm', 'https://images.unsplash.com/photo-1551183053-bf91a1d81141'),
  ('Golden hour, on foot', 'WALK', 'Silver Lake Reservoir · 6:15 pm', 'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8'),
  ('One drink, no big plan', 'DRINKS', 'Bar Flores · 8:00 pm', 'https://images.unsplash.com/photo-1514933651103-005eec06c04b');
```

### 9.3 Seed Admin User

```sql
insert into public.admin_users (id) values ('<your-user-id>');
```

---

## Data Flow Summary

```
User visits "/" 
  → proxy.ts checks auth via Supabase server client
  → If unauthenticated + path = protected → redirect to /login
  → If authenticated + profile incomplete → redirect to /profile
  → If authenticated + profile complete → render main app

Login page:
  → POST form (Server Action) → supabase.auth.signInWithPassword
  → On success → redirect to /

Main App (client component):
  → On mount: fetch candidates from /api/profiles
  → Smash button → POST /api/swipes → check mutual → show match modal
  → Matches tab → fetch /api/matches → show match list
  → Messages tab → fetch /api/conversations → subscribe to realtime
  → Send message → POST /api/messages → realtime broadcasts to other user
  → Schedule date → POST /api/date-proposals → appears in chat
  → Profile tab → fetch own profile → edit if needed

Admin:
  → /admin page checks is_admin() → fetch /api/admin/reports
  → Review → PUT /api/admin/reports/:id
```

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Supabase free tier limits | Monitor usage; set TTL on old messages |
| Email confirmation friction | Make confirmations optional in dev; required in prod |
| Image upload performance | Use Supabase Storage with CDN; resize before upload |
| Realtime scaling | Start with polling fallback for messages if needed |
| Mobile layout needs tuning | CSS already responsive; smoke test on phone sizes |
| Match race condition | Use Supabase transaction or unique constraint on swipes |
| Profile photos need cleanup on delete | Storage bucket lifecycle rules |

---

## What's NOT in MVP Scope

- OAuth/social login (email/password only)
- Push notifications / web push
- Payment / Stripe (monetization phase)
- Mobile app (React Native phase)
- Geolocation-based matching (manual location input only — MVP uses distance filter without GPS)
| Admin user management (manually add admin via SQL)
- Advanced reporting analytics
- Photo verification/AI moderation

---

## Task Checklist (Implementation Order)

1. [ ] Install dependencies (`@supabase/supabase-js`, `@supabase/ssr`, `vitest`, testing libs)
2. [ ] Create `.env.local` with Supabase credentials
3. [ ] Create Supabase project + run schema SQL + enable RLS + add policies
4. [ ] Create `lib/supabase/client.ts`, `server.ts`, `middleware.ts`
5. [ ] Create `lib/types.ts`
6. [ ] Create `proxy.ts` (Next.js 16 auth guard)
7. [ ] Create auth pages: `/login`, `/auth/callback`, `/auth/signout`
8. [ ] Create Supabase provider (`lib/providers/supabase-provider.tsx`)
9. [ ] Create profile setup page (`/profile/page.tsx`) + profile edit (`/profile/edit/page.tsx`)
10. [ ] Move main app to `/app/(app)/page.tsx`, add auth guard wrapper
11. [ ] Create API routes: profiles, swipes, matches, conversations, messages, date-ideas, date-proposals, notifications, reports, admin/reports
12. [ ] Refactor `app/page.tsx` to consume real data from Supabase + API routes
13. [ ] Implement swipe → match → conversation → notification logic
14. [ ] Implement realtime chat via Supabase Realtime
15. [ ] Wire up date proposal to chat overlay
16. [ ] Wire up block/report to safety menu
17. [ ] Create admin dashboard at `/admin/page.tsx`
18. [ ] Seed date ideas + test profiles + admin user
19. [ ] Add Vitest config + write tests for swipe/match logic + API routes
20. [ ] Run `npx tsc --noEmit`, `npx eslint .`, `npm run build`
21. [ ] Push to GitHub → Vercel deploy
22. [ ] Smoke test deployed app end-to-end
