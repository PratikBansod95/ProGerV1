# ProGer

A lightweight, role-based project management web app with automatic Green/Amber/Red health flags, Definition-of-Done checklists, and a personal task bucket for team members.

Built with **Next.js**, **Supabase**, and **Tailwind CSS**.

## Features (MVP)

- Invite-only authentication with role-based routing (Admin, PM, Team Member)
- **Project Hub** — health badges, progress, search/filter/sort
- **Project Detail** — Overview metrics, risk flags, Tasks board/table
- **Task Detail** — checklist enforcement, override logging, activity feed
- **My Bucket** — cross-project task list with personal priority ordering

## Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project
- (Optional) [Vercel](https://vercel.com) account for deployment

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.local.example` to `.env.local` and fill in your Supabase credentials:

```bash
cp .env.local.example .env.local
```

### 3. Run database migration

In the Supabase SQL editor, run:

1. [`supabase/migrations/001_initial.sql`](supabase/migrations/001_initial.sql)
2. [`supabase/seed.sql`](supabase/seed.sql)

### 4. Create the first admin user

1. In Supabase **Authentication → Users**, invite or create a user.
2. In the SQL editor, promote them to admin:

```sql
UPDATE users SET role = 'admin', name = 'Your Name' WHERE email = 'you@example.com';
```

3. Disable public sign-ups in **Authentication → Providers → Email**.

### 5. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import the project in Vercel.
3. Add the same environment variables from `.env.local`.
4. Deploy.

## Project structure

```
app/           # Next.js App Router pages
components/    # UI components (projects, tasks, bucket)
lib/           # Supabase clients, auth, health engine, server actions
supabase/      # SQL migrations and seed data
types/         # Shared TypeScript types
```

## Health badge logic

Health is computed at read time from task data — never stored manually:

- **Red** — any overdue task or blocked task with no activity for 3+ days
- **Amber** — any To Do task due within 48 hours
- **Green** — otherwise

## Post-MVP roadmap

- Timeline (Gantt) tab
- Stakeholder View
- Admin Panel (user invites, checklist templates, override patterns)
