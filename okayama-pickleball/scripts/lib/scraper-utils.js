import { createClient } from '@supabase/supabase-js';

export const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
export const DAY_MS = 86_400_000;
export const SCRAPE_DAYS = 28;
export const CONCURRENCY = 3;
export const UPSERT_BATCH_SIZE = 600;

export const ALLOWED_START_HOURS = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
export const ALLOWED_HOURS_SET = new Set(ALLOWED_START_HOURS);

const BLOCKED_RESOURCE_TYPES = new Set(['image', 'font', 'media']);

/**
 * @typedef {import('playwright').Page} Page
 * @typedef {import('@supabase/supabase-js').SupabaseClient} SupabaseClient
 * @typedef {{
 *   year: number,
 *   month: number,
 *   day: number,
 *   monthPrefix: string,
 *   dateKey: string,
 * }} JstDateParts
 * @typedef {{
 *   slot_key: string,
 *   slot_date: string,
 *   time_range: string,
 *   court_detail: string,
 *   status: 'open' | 'booked' | 'closed',
 *   updated_at: string,
 * }} CourtSlotRecord
 */

/**
 * Returns a JST calendar date string (`YYYY-MM-DD`) offset from today.
 *
 * @param {number} [offsetDays=0]
 * @returns {string}
 */
export function getJstDateString(offsetDays = 0) {
  const timestamp = Date.now() + JST_OFFSET_MS + offsetDays * DAY_MS;
  return new Date(timestamp).toISOString().slice(0, 10);
}

/**
 * Returns calendar components and ISO keys for a JST date offset from today.
 *
 * @param {number} [offsetDays=0]
 * @returns {JstDateParts}
 */
export function getJstParts(offsetDays = 0) {
  const jst = new Date(Date.now() + JST_OFFSET_MS + offsetDays * DAY_MS);
  const year = jst.getUTCFullYear();
  const month = jst.getUTCMonth() + 1;
  const day = jst.getUTCDate();

  return {
    year,
    month,
    day,
    monthPrefix: `${year}-${String(month).padStart(2, '0')}`,
    dateKey: jst.toISOString().slice(0, 10),
  };
}

/**
 * Returns the current hour (`0`–`23`) in `Asia/Tokyo` (JST).
 *
 * @returns {number}
 */
export function getCurrentJstHour() {
  const jstHour = new Date(Date.now() + JST_OFFSET_MS).getUTCHours();
  return Number.isFinite(jstHour) ? jstHour : 0;
}

/**
 * Returns whether a slot on `dateKey` starting at `startHour` has already
 * started or passed relative to the current JST date and hour.
 *
 * @param {string} dateKey
 * @param {number} startHour
 * @param {string} todayDateKey
 * @param {number} currentJstHour
 * @returns {boolean}
 */
export function isSlotPastCurrentJst(
  dateKey,
  startHour,
  todayDateKey,
  currentJstHour
) {
  if (!dateKey) return true;
  if (dateKey < todayDateKey) return true;
  if (dateKey > todayDateKey) return false;

  const parsedStartHour = Number(startHour);
  if (!Number.isFinite(parsedStartHour)) return false;

  return parsedStartHour <= currentJstHour;
}

/**
 * Formats an integer start hour (e.g., `14`) into a 1-hour block (`14:00-15:00`).
 *
 * @param {number} startHour
 * @returns {string}
 */
export function formatTimeRange(startHour) {
  const start = String(startHour).padStart(2, '0');
  const end = String(startHour + 1).padStart(2, '0');
  return `${start}:00-${end}:00`;
}

/**
 * Aborts non-essential asset requests (images, fonts, media) on a Playwright page.
 *
 * @param {Page} page
 * @returns {Promise<void>}
 */
export function blockNonEssentialAssets(page) {
  return page.route('**/*', (route) =>
    BLOCKED_RESOURCE_TYPES.has(route.request().resourceType())
      ? route.abort()
      : route.continue()
  );
}

/**
 * Executes an async worker over `items` with a bounded concurrency pool.
 *
 * @template T, R
 * @param {T[]} items
 * @param {number} limit
 * @param {(item: T) => Promise<R>} worker
 * @returns {Promise<R[]>}
 */
export async function runWithConcurrency(items, limit, worker) {
  /** @type {Promise<R>[]} */
  const results = [];
  /** @type {Set<Promise<void>>} */
  const executing = new Set();

  for (const item of items) {
    const task = Promise.resolve().then(() => worker(item));
    results.push(task);

    const tracked = task.then(() => {
      executing.delete(tracked);
    });
    executing.add(tracked);

    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }

  return Promise.all(results);
}

/**
 * Creates an authenticated Supabase service client from environment variables.
 *
 * @returns {SupabaseClient}
 */
export function createSupabaseServiceClient() {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * Purges expired rows for `venueIds` prior to `minDate`, optionally removes legacy
 * rows matching `legacyOrFilter`, and upserts `records` in batches.
 *
 * @param {SupabaseClient} supabase
 * @param {{
 *   venueIds: string[],
 *   minDate: string,
 *   records: CourtSlotRecord[],
 *   legacyOrFilter?: string,
 * }} options
 * @returns {Promise<void>}
 */
export async function syncCourtAvailability(
  supabase,
  { venueIds, minDate, records, legacyOrFilter }
) {
  const { error: deleteExpiredError } = await supabase
    .from('court_availability')
    .delete()
    .in('court_detail', venueIds)
    .lt('slot_date', minDate);

  if (deleteExpiredError) {
    throw new Error(
      `Failed to purge expired slots: ${deleteExpiredError.message}`
    );
  }

  if (legacyOrFilter) {
    const { error: deleteLegacyError } = await supabase
      .from('court_availability')
      .delete()
      .or(legacyOrFilter);

    if (deleteLegacyError) {
      throw new Error(
        `Failed to purge legacy rows: ${deleteLegacyError.message}`
      );
    }
  }

  for (let i = 0; i < records.length; i += UPSERT_BATCH_SIZE) {
    const batch = records.slice(i, i + UPSERT_BATCH_SIZE);
    const { error } = await supabase
      .from('court_availability')
      .upsert(batch, { onConflict: 'slot_key' });

    if (error) {
      throw new Error(
        `Supabase upsert error at offset ${i}: ${error.message}`
      );
    }
  }
}