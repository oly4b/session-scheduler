import { createSupabaseServiceClient, getJstDateString } from './lib/scraper-utils.js';
import { pruneStaleVotes } from './prune-stale-votes.js';

/**
 * Initializes the Supabase service client and prunes stale court availability
 * votes prior to today's JST date.
 *
 * @returns {Promise<void>}
 */
async function main() {
  const supabase = createSupabaseServiceClient();
  await pruneStaleVotes(supabase, getJstDateString(0));
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[prune-votes] Fatal error: ${message}`);
  process.exitCode = 1;
}