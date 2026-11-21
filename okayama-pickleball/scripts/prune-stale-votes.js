/**
 * Removes ONLY the specific time blocks (YYYY-MM-DD_HH:00-HH:00) that are
 * expired or fully booked across all 13 venues from every voter's `responses`,
 * keeping all other voted slots intact. Drops a voter row only if 0 votes remain.
 */
export async function pruneStaleVotes(supabase, minDate) {
  const validSlotKeys = new Set();
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('court_availability')
      .select('slot_date, time_range')
      .eq('status', 'open')
      .gte('slot_date', minDate)
      .range(from, from + pageSize - 1);

    if (error || !data || data.length === 0) break;
    for (const row of data) {
      validSlotKeys.add(`${row.slot_date}_${row.time_range}`);
    }
    if (data.length < pageSize) break;
    from += pageSize;
  }

  // Safety guard: never prune if court_availability returned 0 open rows
  if (validSlotKeys.size === 0) return;

  const { data: votes, error: votesError } = await supabase
    .from('calendar_votes')
    .select('id, name, responses');

  if (votesError || !votes) {
    console.error('Failed to fetch calendar_votes for pruning:', votesError);
    return;
  }

  for (const vote of votes) {
    const raw = vote.responses || {};
    const cleaned = {};
    let changed = false;

    for (const [key, val] of Object.entries(raw)) {
      const normalizedKey = key.startsWith('spacepad_1_3_')
        ? key.slice('spacepad_1_3_'.length)
        : key;

      if (normalizedKey !== key) changed = true;

      // Keeps every voted time block that still has >= 1 open venue; drops only booked-out blocks
      if (validSlotKeys.has(normalizedKey)) {
        cleaned[normalizedKey] = val;
      } else {
        changed = true;
      }
    }

    const remainingCount = Object.keys(cleaned).length;

    if (remainingCount === 0) {
      const { error: delError } = await supabase
        .from('calendar_votes')
        .delete()
        .eq('id', vote.id);

      if (!delError) {
        console.log(`[prune-votes] Dropped "${vote.name}" (0 active votes remaining).`);
      }
    } else if (changed) {
      const { error: updError } = await supabase
        .from('calendar_votes')
        .update({
          responses: cleaned,
          updated_at: new Date().toISOString(),
        })
        .eq('id', vote.id);

      if (!updError) {
        console.log(
          `[prune-votes] Removed booked-out slot(s) for "${vote.name}" (${remainingCount} active remaining).`
        );
      }
    }
  }
}