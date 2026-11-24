import {
  createSupabaseServiceClient,
  getCurrentJstHour,
  getJstDateString,
} from './lib/scraper-utils.js';
import { pruneStaleVotes } from './prune-stale-votes.js';

/**
 * Initializes the Supabase service client and prunes stale or already-passed
 * court availability votes for the current JST date and hour.
 *
 * @returns {Promise<void>}
 */
async function main() {
  const supabase = createSupabaseServiceClient();
  const todayDateKey = getJstDateString(0);
  const currentJstHour = getCurrentJstHour();

  await pruneStaleVotes(supabase, todayDateKey, {
    todayDateKey,
    currentJstHour,
  });
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[prune-votes] Fatal error: ${message}`);
  process.exitCode = 1;
}