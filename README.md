# הקיץ של אדם ☀️ — Adam's Summer Planner

A cute, iOS 26 (Liquid Glass) style calendar web app for planning who takes care of Adam
each day during his August 2026 summer break. Hebrew, right-to-left.

**You** plan the month and share one link with the family. Family members open the link and
see a **read-only** plan — they can't change anything. Editing is unlocked with a private
passcode.

## Features
- Full August 2026 calendar, Hebrew RTL, weekends (Fri/Sat) highlighted automatically.
- Tap a day to assign a caretaker, mark a **family vacation** 🏖️, or clear it.
- Manage the caretaker list: add, rename, recolor, remove (starts empty).
- One shared link. Family = view only. Parents = edit after entering the passcode.
- Auto color legend.

## Run locally
```bash
npm install
npm start
# open http://localhost:3000
```
Default local edit code: `adam2026` (tap the 🔒 button, enter the code).

## Storage — read this first
The free Render tier has **no persistent disk**, and its filesystem is wiped whenever the
service sleeps. So for a free deployment the plan must live in an external store. This app
supports **Upstash Redis** (free, durable) — highly recommended for the free tier.

- **With Upstash** (free + durable): the plan survives sleeps, restarts and redeploys.
- **Without Upstash**: the plan is kept in the container filesystem and will reset when the
  free service sleeps. Fine only for local testing.
- **Paid Starter instance** ($7/mo): you can instead attach a Persistent Disk and set
  `DATA_DIR` to its mount path — then no Upstash is needed.

### Step 1 — create a free Upstash Redis DB (2 min)
1. Sign up at https://upstash.com (free).
2. **Create Database** → any name → region close to you → Free plan.
3. On the database page, copy **`UPSTASH_REDIS_REST_URL`** and **`UPSTASH_REDIS_REST_TOKEN`**
   (under "REST API").

### Step 2 — deploy on Render (Blueprint)
1. Put this folder in a Git repo (GitHub/GitLab) and push it.
2. On Render → **New → Blueprint**, pick the repo. Render reads `render.yaml`.
3. Set the env vars when prompted:
   - **`EDIT_CODE`** — your own private passcode (the code you type to edit the plan).
   - **`UPSTASH_REDIS_REST_URL`** and **`UPSTASH_REDIS_REST_TOKEN`** — from step 1.
4. Deploy. Your app will be live at `https://<name>.onrender.com`.

The free service sleeps when idle and wakes on the next visit (first load takes a few seconds);
your plan stays safe in Upstash regardless.

### Manual setup (without Blueprint)
- New → **Web Service** → connect repo.
- Build command: `npm install` · Start command: `npm start`
- Environment: add `EDIT_CODE`, plus either the two `UPSTASH_...` vars (recommended) or, on a
  paid instance, `DATA_DIR=/var/data` with a Persistent Disk mounted at `/var/data`.

## How sharing works
Send the family the plain URL (e.g. `https://<name>.onrender.com`). They always see your
latest saved plan, read-only. To edit, tap 🔒, enter your `EDIT_CODE`, make changes, then
**💾 שמירה ושיתוף** (Save & share). Everyone's next visit shows the update.

## Tech
Plain HTML/CSS/JS frontend + a tiny Express server. Data stored as JSON on disk. No build step.
