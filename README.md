# JEE Practice Hub

JEE Practice Hub is a web-based preparation and computer-based test (CBT) practice platform built with React, TypeScript, Tailwind CSS, Vite, and KaTeX, backed by Supabase (PostgreSQL with Row-Level Security, Auth, and Storage).

---

## Architecture Overview

- **Frontend**: React 19 SPA built with Vite and Tailwind CSS.
- **Math Typography**: Fast client-side rendering via KaTeX.
- **Backend**: PostgreSQL database hosted on Supabase with strict Row-Level Security (RLS) policies enforcing multi-student isolation and monitor oversight.
- **Deployment**: Single-Page Application hosted on Vercel with automated continuous deployment from the GitHub `main` branch.

---

## Prerequisites

- Node.js `>= 20.x`
- npm `>= 10.x`
- Supabase CLI (`supabase`) for local migration management

---

## Local Development Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/vikas0313/JEE-practice-hub.git
   cd JEE-practice-hub
   ```

2. **Install dependencies**:
   ```bash
   npm ci
   ```

3. **Configure environment variables**:
   Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
   Populate `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` with your Supabase project credentials.

4. **Start the local dev server**:
   ```bash
   npm run dev
   ```

---

## Supabase Hosted Project Setup

1. **Create Supabase Project**:
   - Create a new project in the Supabase Dashboard.
   - Recommended region: **Mumbai (ap-south-1)** for lowest latency to users in India.

2. **Apply Database Migrations**:
   Link your project and push all versioned migrations:
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```
   All 37 migrations in `supabase/migrations/` will apply in order, establishing tables, indexes, and RLS policies.

3. **Configure Authentication**:
   - Navigate to **Authentication $\to$ URL Configuration**.
   - Set **Site URL** to your Vercel production domain: `https://<your-project>.vercel.app`.
   - Add preview domains to **Redirect URLs**: `https://<your-project>-*.vercel.app/**`, `http://localhost:5173/**`.
   - Under **Auth Settings**: Disable email confirmation if using instant access registration.
   - Enable CAPTCHA protection (hCaptcha or Cloudflare Turnstile).

4. **Provision Accounts**:
   - The monitor (guardian) account must be created directly via Supabase Auth dashboard or SQL seed script, **never** via the public student registration form.
   - Student accounts register via `/register` with guardian details and monitor approval.

5. **Set Backend Secrets (Server-Only)**:
   For external services (e.g. SMTP email sender, CAPTCHA verification):
   ```bash
   npx supabase secrets set SMTP_PASS="..." CAPTCHA_SECRET_KEY="..."
   ```

---

## Vercel Deployment Guide

1. **Import Repository in Vercel**:
   - Go to [vercel.com/new](https://vercel.com/new).
   - Select `vikas0313/JEE-practice-hub`.

2. **Build Settings**:
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm ci`

3. **Configure Environment Variables in Vercel**:
   Add the following variables under **Project Settings $\to$ Environment Variables** (Production & Preview):
   - `VITE_SUPABASE_URL`: `https://<your-project>.supabase.co`
   - `VITE_SUPABASE_ANON_KEY`: `<your-anon-key>`
   - `VITE_APP_ENV`: `production`
   - `VITE_CAPTCHA_SITE_KEY`: `<your-captcha-site-key>`

   > **Security Invariant**:
   > `VITE_SUPABASE_ANON_KEY` and `VITE_SUPABASE_URL` are safe to embed in client-side code because all tenant isolation and access controls are strictly enforced at the database level by Row-Level Security (RLS).
   > **NEVER** expose `SUPABASE_SERVICE_ROLE_KEY` in Vercel environment variables.

4. **Deploy**:
   - Click **Deploy**. Vercel will build the project and serve it with the security headers defined in `vercel.json`.

---

## Security & Key Rotation Procedures

If any key or credential is ever suspected of compromise:
1. **Supabase Anon & Service Role Keys**:
   - In Supabase Dashboard, go to **Project Settings $\to$ API $\to$ JWT Settings**.
   - Rotate the JWT Secret. This immediately invalidates the old anon key and service role key.
   - Update `VITE_SUPABASE_ANON_KEY` in Vercel and trigger a redeployment.
2. **Database Password**:
   - In **Project Settings $\to$ Database**, reset the database password.
3. **Monitor Account Credentials**:
   - Reset the monitor password directly in Supabase Auth or change the registered email.
