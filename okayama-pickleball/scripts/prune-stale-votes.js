import { CONCURRENCY, runWithConcurrency } from './lib/scraper-utils.js';
import { isSlotPastCurrentJst } from './lib/scraper-utils.js';

const PAGE_SIZE = 1000;
const LEGACY_PREFIX = 'spacepad_1_3_';
const RESPONSE_PRIORITY = { yes: 3, maybe: 2, no: 1 };

/**
 * @typedef {import('@supabase/supabase-js').SupabaseClient} SupabaseClient
 * @typedef {{ slot_key: string, slot_date: string, time_range: string }} CourtSlotRow
 * @typedef {{ id: string, name: string, responses: Record<string, string> | null }} CalendarVoteRow
 */

/**
 * Fetches active open slot keys (`YYYY-MM-DD_HH:00-HH:00`) that have not yet
 * passed relative to the current JST date and hour.
 *
 * @param {SupabaseClient} supabase
 * @param {string} minDate
 * @param {string} todayDateKey
 * @param {number} currentJstHour
 * @returns {Promise<Set<string>>}
 */
async function fetchActiveOpenSlotKeys(
  supabase,
  minDate,
  todayDateKey,
  currentJstHour
) {
  const openKeys = new Set();

  for (let offset = 0; ; offset += PAGE_SIZE) {
    /** @type {{ data: CourtSlotRow[] | null, error: { message: string } | null }} */
    const { data: slots, error } = await supabase
      .from('court_availability')
      .select('slot_key, slot_date, time_range')
      .eq('status', 'open')
      .gte('slot_date', minDate)
      .order('slot_key', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      throw new Error(
        `Failed to fetch open slots at offset ${offset}: ${error.message}`
      );
    }
    if (!slots?.length) break;

    for (const { slot_date, time_range } of slots) {
      const startHour = Number(String(time_range || '').slice(0, 2));
      if (
        Number.isFinite(startHour) &&
        isSlotPastCurrentJst(slot_date, startHour, todayDateKey, currentJstHour)
      ) {
        continue;
      }
      openKeys.add(`${slot_date}_${time_range}`);
    }

    if (slots.length < PAGE_SIZE) break;
  }

  return openKeys;
}

/**
 * Strips legacy Spacepad prefixes, filters out past/closed/unavailable slots,
 * and resolves duplicate keys using `RESPONSE_PRIORITY` (`yes` > `maybe` > `no`).
 *
 * @param {Record<string, string> | null} responses
 * @param {Set<string>} openKeys
 * @param {string} todayDateKey
 * @param {number} currentJstHour
 * @returns {{ cleaned: Record<string, string>, changed: boolean, count: number }}
 */
function sanitizeResponses(
  responses,
  openKeys,
  todayDateKey,
  currentJstHour
) {
  /** @type {Record<string, string>} */
  const cleaned = {};
  let changed = false;

  for (const [rawKey, availability] of Object.entries(responses ?? {})) {
    if (!availability) {
      changed = true;
      continue;
    }

    const key = rawKey.startsWith(LEGACY_PREFIX)
      ? rawKey.slice(LEGACY_PREFIX.length)
      : rawKey;

    if (key !== rawKey) changed = true;

    const slotDate = key.slice(0, 10);
    const startHour = Number(key.slice(11, 13));
    if (
      (Number.isFinite(startHour) &&
        isSlotPastCurrentJst(slotDate, startHour, todayDateKey, currentJstHour)) ||
      !openKeys.has(key)
    ) {
      changed = true;
      continue;
    }

    const existing = cleaned[key];
    if (!existing) {
      cleaned[key] = availability;
    } else {
      changed = true;
      if (
        (RESPONSE_PRIORITY[availability] ?? 0) >
        (RESPONSE_PRIORITY[existing] ?? 0)
      ) {
        cleaned[key] = availability;
      }
    }
  }

  return { cleaned, changed, count: Object.keys(cleaned).length };
}

/**
 * Prunes expired or already-passed time blocks from voter responses,
 * deleting voters with zero active slots remaining.
 *
 * @param {SupabaseClient} supabase
 * @param {string} minDate
 * @param {{ todayDateKey?: string, currentJstHour?: number }} [clockOptions]
 * @returns {Promise<void>}
 */
export async function pruneStaleVotes(supabase, minDate, clockOptions = {}) {
  const todayDateKey = clockOptions.todayDateKey ?? minDate;
  const currentJstHour = clockOptions.currentJstHour ?? -1;

  const openSlotKeys = await fetchActiveOpenSlotKeys(
    supabase,
    minDate,
    todayDateKey,
    currentJstHour
  );

  const { data: votes, error: fetchError } = await supabase
    .from('calendar_votes')
    .select('id, name, responses');

  if (fetchError || !votes) {
    console.error('[prune-votes] Failed to fetch calendar_votes:', fetchError);
    return;
  }

  const now = new Date().toISOString();
  /** @type {Array<{ id: string, name: string }>} */
  const staleVoters = [];
  /** @type {Array<{ id: string, name: string, responses: Record<string, string>, count: number }>} */
  const updates = [];

  for (const { id, name, responses } of votes) {
    const { cleaned, changed, count } = sanitizeResponses(
      responses,
      openSlotKeys,
      todayDateKey,
      currentJstHour
    );
    if (!changed) continue;

    if (count === 0) {
      staleVoters.push({ id, name });
    } else {
      updates.push({ id, name, responses: cleaned, count });
    }
  }

  if (staleVoters.length > 0) {
    const { error } = await supabase
      .from('calendar_votes')
      .delete()
      .in(
        'id',
        staleVoters.map((voter) => voter.id)
      );

    if (error) {
      console.error('[prune-votes] Failed to delete stale voters:', error);
    } else {
      for (const { name } of staleVoters) {
        console.log(
          `[prune-votes] Dropped "${name}" (0 active votes remaining).`
        );
      }
    }
  }

  await runWithConcurrency(
    updates,
    CONCURRENCY,
    async ({ id, name, responses, count }) => {
      const { error } = await supabase
        .from('calendar_votes')
        .update({ responses, updated_at: now })
        .eq('id', id);

      if (error) {
        console.error(`[prune-votes] Failed to update "${name}":`, error);
      } else {
        console.log(
          `[prune-votes] Removed expired/booked slot(s) for "${name}" (${count} active remaining).`
        );
      }
    }
  );
}