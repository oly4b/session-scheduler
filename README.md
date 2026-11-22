# OkadaiDinks Pickleball Session Scheduler (`岡大dinks`)

A real-time group scheduling web app for coordinating pickleball sessions across **Okayama City and Kurashiki City** indoor gymnasiums and outdoor hard courts. It combines live member availability voting with automated court availability synced from both **Okayama City `yoyacool`** and **Kurashiki City `Spacepad`**.

---

## Features

- **Rolling 28-Day JST Calendar & Dynamic Holiday Engine:** Automatically generates Weeks 1–4 in Japan Standard Time with an astronomical Japanese holiday calculator (handling statutory holidays, substitute holidays `振替休日`, and Citizens' holidays `国民の休日`).
- **Multi-Venue 1-Hour Session Grid (12:00–22:00):** Filters by area (Okayama / Kurashiki) or individual facility, highlights student-prime evening/weekend slots (`★ 18:00~`), and locks single-hour orphan slots (`2h不可`) so voting stays focused on playable 2-hour continuous windows.
- **Independent-Date Top 5 Recommendations & Same-Day Alternatives:** Ranks the top 5 independent dates that have at least **3 member votes** across continuous 2-hour blocks, automatically surfaces the top 3 recommended courts per slot, and lets users toggle into the **2nd-best 2-hour option on that same day (`同日の第2候補`)** inside the details modal.
- **Real-Time Group Voting & View/Edit Guardrails:** Players submit `◯` / `△` / `✕` availability and notes with live updates via Supabase Realtime, read-only voter inspection (`閲覧モード`), and one-click LINE / Instagram invite generation with `.ics` calendar export links (`/api/event`).
- **Automated Hourly Multi-Portal Sync & Vote Pruning:** Headless Playwright scrapers sync both `yoyacool` and `Spacepad` hourly from `11:28` to `21:28` JST via GitHub Actions, pruning expired or fully booked slots (`prune-stale-votes.js`) once both scrapers succeed.

---

## Tech Stack

- **Frontend:** React, Vite (Rolldown code-splitting), Tailwind CSS, Lucide Icons (deployed on Vercel)
- **Database & Realtime:** Supabase (`court_availability` and `calendar_votes` tables with RLS & B-tree indexes)
- **Scraper & Automation:** Node.js, Playwright (Chromium), GitHub Actions

---

## Project Structure

```text
okayama-pickleball/
├── .github/
│   └── workflows/
│       └── sync-availability.yml   # Hourly cron job (11:28–21:28 JST)
├── api/
│   └── event.js                    # Vercel serverless ICS calendar & Google Maps redirect
├── scripts/
│   ├── lib/
│   │   └── scraper-utils.js        # Shared JST helpers, asset blocking, concurrency & Supabase sync
│   ├── prune-stale-votes.js        # Stale/booked-out vote cleanup logic
│   ├── run-prune-votes.js          # CLI entry point for post-sync vote pruning
│   ├── scrape-spacepad.js          # Playwright GraphQL scraper for Kurashiki Spacepad venues
│   └── scrape-yoyacool.js          # Playwright scraper for Okayama City yoyacool venues
├── src/
│   ├── config/
│   │   └── venues.js               # Master venue metadata, coordinates, tiers & booking URLs
│   ├── lib/
│   │   └── supabase.js             # Configured browser Supabase client
│   ├── utils/
│   │   └── scheduler.js            # JST calendar math, Japanese holiday engine & venue ranking
│   └── App.jsx                     # Main scheduling UI, voting matrix, modals & Top 5 leaderboard
├── .oxlintrc.json                  # Oxlint configuration
├── vite.config.js                  # Vite + Tailwind + vendor chunk configuration
└── package.json