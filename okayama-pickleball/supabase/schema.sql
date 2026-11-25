-- ============================================================================
-- 桃dinks Session Scheduler — Supabase Database Schema, Indexes, RLS & Realtime
-- ============================================================================
-- Run this in the Supabase SQL Editor to stand up a fresh project from scratch.
-- Derived from queries in:
--   - src/services/schedulerRepository.js
--   - scripts/lib/scraper-utils.js
--   - scripts/prune-stale-votes.js

-- 1. Court availability scraped from Okayama yoyacool & Kurashiki Spacepad
CREATE TABLE IF NOT EXISTS public.court_availability (
  slot_key     text PRIMARY KEY,
  slot_date    text NOT NULL,
  time_range   text NOT NULL,
  court_detail text NOT NULL,
  status       text NOT NULL CHECK (status IN ('open', 'booked', 'closed')),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_court_availability_slot_date
  ON public.court_availability (slot_date);

CREATE INDEX IF NOT EXISTS idx_court_availability_court_date
  ON public.court_availability (court_detail, slot_date);

-- 2. Group member availability votes
CREATE TABLE IF NOT EXISTS public.calendar_votes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  note       text NOT NULL DEFAULT '',
  responses  jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Confirmed session bookings (one booking per JST date; triggers 23505 on duplicate)
CREATE TABLE IF NOT EXISTS public.booked_sessions (
  date_key   text PRIMARY KEY,
  start_hour integer NOT NULL,
  end_hour   integer NOT NULL,
  venue_id   text NOT NULL DEFAULT '',
  venue_name text NOT NULL DEFAULT '',
  map_url    text NOT NULL DEFAULT '',
  court_type text NOT NULL DEFAULT 'indoor' CHECK (court_type IN ('indoor', 'outdoor')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Per-session attendee RSVPs (auto-seeded on booking create/edit, toggled by voters)
CREATE TABLE IF NOT EXISTS public.session_attendees (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_date  text NOT NULL,
  start_hour    integer NOT NULL,
  end_hour      integer NOT NULL,
  venue_id      text NOT NULL DEFAULT '',
  venue_name    text NOT NULL DEFAULT '',
  attendee_name text NOT NULL,
  status        text NOT NULL DEFAULT 'yes' CHECK (status IN ('yes', 'maybe')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT session_attendees_date_name_key UNIQUE (session_date, attendee_name)
);

CREATE INDEX IF NOT EXISTS idx_session_attendees_session_date
  ON public.session_attendees (session_date);

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================
-- The frontend uses the public anon/publishable key for open group polling
-- (no login required), while scrapers & vote-pruning scripts use the
-- service_role key (which bypasses RLS).

ALTER TABLE public.court_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booked_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_attendees ENABLE ROW LEVEL SECURITY;

-- court_availability: public read-only; writes are performed by service_role scrapers
CREATE POLICY "Allow public read on court_availability"
  ON public.court_availability FOR SELECT
  TO anon, authenticated
  USING (true);

-- calendar_votes: open group poll read/write/delete
CREATE POLICY "Allow public read on calendar_votes"
  ON public.calendar_votes FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public insert on calendar_votes"
  ON public.calendar_votes FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow public update on calendar_votes"
  ON public.calendar_votes FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete on calendar_votes"
  ON public.calendar_votes FOR DELETE
  TO anon, authenticated
  USING (true);

-- booked_sessions: open group read/write/delete
CREATE POLICY "Allow public read on booked_sessions"
  ON public.booked_sessions FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public insert on booked_sessions"
  ON public.booked_sessions FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow public update on booked_sessions"
  ON public.booked_sessions FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete on booked_sessions"
  ON public.booked_sessions FOR DELETE
  TO anon, authenticated
  USING (true);

-- session_attendees: open group read/write/delete
CREATE POLICY "Allow public read on session_attendees"
  ON public.session_attendees FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public insert on session_attendees"
  ON public.session_attendees FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow public update on session_attendees"
  ON public.session_attendees FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete on session_attendees"
  ON public.session_attendees FOR DELETE
  TO anon, authenticated
  USING (true);

-- ============================================================================
-- Supabase Realtime Publication
-- ============================================================================
-- Required for live updates in src/services/schedulerRepository.js
ALTER PUBLICATION supabase_realtime
  ADD TABLE public.calendar_votes, public.booked_sessions, public.session_attendees;
