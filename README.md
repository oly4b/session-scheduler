# 桃dinks Pickleball Session Scheduler

A real-time group scheduling web app for coordinating pickleball sessions across **Okayama City and Kurashiki City** indoor gymnasiums and outdoor hard courts. It combines live member availability voting, confirmed session cards with automatic RSVP seeding and attendance tracking, and automated court availability synced from both **Okayama City `yoyacool`** and **Kurashiki City `Spacepad`**.

---

## Features

* **Rolling 28-Day JST Calendar & Dynamic Holiday Engine:** Automatically generates Weeks 1–4 in Japan Standard Time (`Asia/Tokyo`) with a dynamic Japanese holiday calculator (handling statutory holidays, substitute holidays `振替休日`, and Citizens' holidays `国民の休日`), browser-locale detection (`JA` / `EN`) with manual toggle, and auto-translate guards (`translate="no"`).
* **Multi-Venue 1-Hour Session Grid & Day-Window Presets (12:00–22:00):** Displays hourly availability across 13 Okayama and Kurashiki facilities, highlights student-prime evening/weekend slots (`18:00~`), locks single-hour orphan slots (`2h不可`) so voting stays focused on playable 2-hour continuous windows, and supports quick day-window fills (`終日` / `昼のみ` / `夜のみ`) and week actions.
* **Confirmed Session Cards, Auto-RSVP Seeding & Attendance (`session_attendees`):** Displays confirmed bookings as full-width sticky session cards (`予約確定` / `Booked`), blocks unbooked current-day rows (`確定予定はありません` / `NO SESSION BOOKED`), and automatically seeds `Going` (`◯`) RSVPs for voters available across **all** hours of a newly created or edited session (re-syncing on time edits), with live Supabase Realtime updates and keyword-guarded removal.
* **Independent-Date Top 5 Recommendations & Same-Day Alternatives:** Ranks the top 5 unbooked dates with at least **3 member votes** across continuous 2-hour blocks (automatically excluding dates that already have a confirmed booking), surfaces the top 3 recommended courts per slot, and lets users inspect the **2nd-best 2-hour option on that same day (`同日の第2候補`)**.
* **Real-Time Group Voting, View/Edit Guardrails & Invite Sharing:** Players submit `◯` / `△` / `✕` availability and notes with live updates via Supabase Realtime, inspect responses in read-only mode (`閲覧モード`), edit existing responses via a voter picker, and generate `JA` / `EN` / bilingual SNS invites with `/api/event` `.ics` calendar & map links (plus an in-app browser gate for LINE/Instagram).
* **JST Time-Aware Scraping & Vote Pruning:** Headless Playwright scrapers sync both `yoyacool` and `Spacepad` via GitHub Actions while skipping already-passed hours on the current JST date (`isSlotPastCurrentJst`), followed by `run-prune-votes.js` (`prune-stale-votes.js`) to clean up stale or booked-out poll slots and voters with zero remaining active votes.

---

## Tech Stack

* **Frontend:** React 19, Vite, Tailwind CSS, Lucide Icons (deployed on Vercel)
* **Database & Realtime:** Supabase (`court_availability`, `calendar_votes`, `booked_sessions`, and `session_attendees` tables with RLS & Realtime subscriptions)
* **Scraper & Automation:** Node.js, Playwright (Chromium), GitHub Actions
* **Testing & Linting:** Node built-in test runner (`node --test`), Oxlint

---

## Project Structure

```text
okayama-pickleball/
├── .github/
│   └── workflows/
│       └── sync-availability.yml   # Scheduled Playwright sync & vote pruning workflow
├── api/
│   └── event.js                    # Vercel serverless ICS calendar & in-app browser gate
├── public/
│   └── og-image.jpg                # Optimized Open Graph link preview image
├── scripts/
│   ├── lib/
│   │   └── scraper-utils.js        # Asset blocking, concurrency & Supabase upsert helpers
│   ├── prune-stale-votes.js        # Stale, past-hour & booked-out vote cleanup logic
│   ├── run-prune-votes.js          # CLI entry point for post-sync vote pruning
│   ├── scrape-spacepad.js          # Playwright GraphQL scraper for Kurashiki Spacepad venues
│   └── scrape-yoyacool.js          # Playwright scraper for Okayama City yoyacool venues
├── src/
│   ├── components/
│   │   └── modals/                 # Booking, Share, SlotInspect, GoingTally, EditPicker, ConfirmKeyword
│   ├── config/
│   │   └── venues.js               # Master venue metadata, court types, coordinates & booking URLs
│   ├── domain/
│   │   ├── bookingForm.js          # Pure booking time-clamping & payload builders
│   │   └── schedule.js             # Calendar grid, 2h ranking, tallies, reducers & auto-RSVP matching
│   ├── hooks/
│   │   └── useSchedulerData.js     # Initial fetch & Supabase Realtime subscription lifecycle
│   ├── i18n/
│   │   ├── copy.js                 # Bilingual (EN / JA) UI dictionary
│   │   └── useLanguage.js          # Locale detection, persistence & document sync
│   ├── lib/
│   │   └── supabase.js             # Configured browser Supabase client
│   ├── services/
│   │   └── schedulerRepository.js  # Supabase queries, cascades & attendee seeding
│   ├── utils/
│   │   ├── confirmedInvite.js      # Confirmed session invite & short /api/event URL builder
│   │   ├── jst.js                  # Shared Asia/Tokyo date/hour helpers (frontend & scripts)
│   │   └── scheduler.js            # Japanese holiday engine, legacy key merge & venue ranking
│   └── App.jsx                     # Main scheduling UI & voting matrix
├── tests/
│   ├── bookingForm.test.js         # Unit tests for booking form, invites & ILIKE escaping
│   └── schedule.test.js            # Unit tests for calendar, 2h ranking & auto-RSVP matching
├── .oxlintrc.json                  # Oxlint configuration
├── vite.config.js                  # Vite + Tailwind configuration
└── package.json
```

---

## Development & Verification

```bash
cd okayama-pickleball
npm install
npm run dev                  # Start local Vite dev server
npm run lint                 # Run Oxlint
node --test tests/*.test.js  # Run unit tests
npm run build                # Build production bundle
```

```

---

## Development & Verification

```bash
cd okayama-pickleball
npm install
npm run dev                  # Start local Vite dev server
npm run lint                 # Run Oxlint
node --test tests/*.test.js  # Run unit tests
npm run build                # Build production bundle
```