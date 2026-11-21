import { createClient } from '@supabase/supabase-js';
import { pruneStaleVotes } from './prune-stale-votes.js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function getJstToday() {
  const jstTime = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return jstTime.toISOString().slice(0, 10);
}

await pruneStaleVotes(supabase, getJstToday());