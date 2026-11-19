# OkadaiDinks Pickleball Session Scheduler

A real-time group scheduling web app for coordinating pickleball sessions at **Seto Athletic Park Gymnasium Sub-Arena** (Okayama City). It combines live player availability voting with automated court availability synced directly from the Okayama City `yoyacool` reservation portal.

---

## Features

- **Rolling 14-Day JST Calendar:** Automatically displays Week 1 (Days 1–7) and Week 2 (Days 8–14) in Japan Standard Time, rolling forward daily at midnight JST.
- **1-Hour Session Grid (12:00–21:00):** Non-overlapping hourly time blocks (`12:00–13:00` through `20:00–21:00`) for clear scheduling.
- **Live Court Availability Badges:** Automatically locks unavailable slots and displays open half-court availability (`1/2A`, `1/2B`), booked status (`✕ 予約済`), or facility closures (`休館`).
- **Real-Time Group Voting & Rankings:** Players can submit `◯` / `△` / `✕` availability and notes, with instant updates via Supabase Realtime and an automated Top 5 best-slot ranking.
- **Automated Hourly Sync:** A headless Playwright scraper runs hourly from 10:00 to 22:00 JST via GitHub Actions, pruning expired dates and updating Supabase.

---

## Tech Stack

- **Frontend:** React, Vite, Supabase JS Client (deployed on Vercel)
- **Database & Realtime:** Supabase (`court_availability` and `calendar_votes` tables)
- **Scraper & Automation:** Node.js, Playwright (Chromium), GitHub Actions

---

## Project Structure

```text
okayama-pickleball/
├── .github/
│   └── workflows/
│       └── sync-availability.yml   # Hourly cron job (10:00–22:00 JST)
├── scripts/
│   └── scrape-availability.js      # Playwright scraper for yoyacool (Room 141)
├── src/
│   └── App.jsx                     # Main scheduling UI, voting grid, and rankings
├── .oxlintrc.json                  # Oxlint configuration
└── package.json