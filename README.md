# 桃dinks Pickleball Session Scheduler

A real-time group scheduling web app for coordinating pickleball sessions across **Okayama City and Kurashiki City** indoor gymnasiums and outdoor hard courts. It combines live member availability voting, confirmed session cards with dedicated session attendance tracking, and automated court availability synced from both **Okayama City `yoyacool**` and **Kurashiki City `Spacepad**`.

---

## Features

* **Rolling 28-Day JST Calendar & Dynamic Holiday Engine:** Automatically generates Weeks 1–4 in Japan Standard Time (`Asia/Tokyo`) with a dynamic Japanese holiday calculator (handling statutory holidays, substitute holidays `振替休日`, and Citizens' holidays `国民の休日`), bilingual `JA` / `EN` UI switching, and auto-translate guards (`translate="no"`).
* **Multi-Venue 1-Hour Session Grid & Day-Window Presets (12:00–22:00):** Displays hourly availability across Okayama and Kurashiki facilities, highlights student-prime evening/weekend slots (`18:00~`), locks single-hour orphan slots (`2h不可`) so voting stays focused on playable 2-hour continuous windows, and supports quick day-window fills (`終日` / `昼のみ` / `夜のみ`) and week actions.
* **Confirmed Session Rows & Per-Session Attendance (`session_attendees`):** Displays confirmed bookings as full-width sticky session cards (`予約確定` / `Booked`), blocks unbooked current-day rows (`確定予定はありません` / `NO SESSION BOOKED`), and tracks `◯` session attendees in a dedicated `session_attendees` table with live Supabase Realtime updates and keyword-guarded booking removal.
* **Independent-Date Top 5 Recommendations & Same-Day Alternatives:** Ranks the top 5 independent dates that have at least **3 member votes** across continuous 2-hour blocks, automatically surfaces the top 3 recommended courts per slot, and lets users toggle into the **2nd-best 2-hour option on that same day (`同日の第2候補`)** inside the details modal.
* **Real-Time Group Voting, View/Edit Guardrails & Invite Sharing:** Players submit `◯` / `△` / `✕` availability and notes with live updates via Supabase Realtime, inspect responses in read-only mode (`閲覧モード`), edit existing responses via a voter picker, and generate `JA` / `EN` / bilingual SNS invites with `/api/event` calendar & map links.
* **JST Time-Aware Scraping & Vote Pruning:** Headless Playwright scrapers sync both `yoyacool` and `Spacepad` via GitHub Actions while skipping already-passed hours on the current JST date (`isSlotPastCurrentJst`), followed by `run-prune-votes.js` (`prune-stale-votes.js`) to clean up stale or booked-out poll slots and voters with zero remaining active votes.

---

## Tech Stack

* **Frontend:** React, Vite, Tailwind CSS, Lucide Icons (deployed on Vercel)
* **Database & Realtime:** Supabase (`court_availability`, `calendar_votes`, `booked_sessions`, and `session_attendees` tables with RLS & Realtime subscriptions)
* **Scraper & Automation:** Node.js, Playwright (Chromium), GitHub Actions

---

## Project Structure

```text
okayama-pickleball/
├── .github/
│   └── workflows/
│       └── sync-availability.yml   # Scheduled Playwright sync & vote pruning workflow
├── api/
│   └── event.js                    # Vercel serverless ICS calendar & Google Maps redirect
├── scripts/
│   ├── lib/
│   │   └── scraper-utils.js        # JST date/hour helpers, asset blocking, concurrency & DB sync
│   ├── prune-stale-votes.js        # Stale, past-hour & booked-out vote cleanup logic
│   ├── run-prune-votes.js          # CLI entry point for post-sync vote pruning
│   ├── scrape-spacepad.js          # Playwright GraphQL scraper for Kurashiki Spacepad venues
│   └── scrape-yoyacool.js          # Playwright scraper for Okayama City yoyacool venues
├── src/
│   ├── config/
│   │   └── venues.js               # Master venue metadata, court types, tiers & booking URLs
│   ├── lib/
│   │   └── supabase.js             # Configured browser Supabase client
│   ├── utils/
│   │   ├── confirmedInvite.js      # JST date helper & confirmed session invite/ICS helpers
│   │   └── scheduler.js            # JST calendar math, Japanese holiday engine & venue ranking
│   └── App.jsx                     # Main scheduling UI, voting matrix, booked cards & modals
├── .oxlintrc.json                  # Oxlint configuration
├── vite.config.js                  # Vite + Tailwind configuration
└── package.json