import { VENUE_BY_ID } from '../config/venues.js';
import {
  MANUAL_VENUE_ID,
  normalizeCourtType,
} from '../utils/confirmedInvite.js';
import {
  formatJstTimestamp,
  normalizeSessionDateKey,
} from '../utils/jst.js';
import {
  ACTIVE_VENUE_IDS,
  escapeIlikePattern,
  getJstDayMeta,
} from '../utils/scheduler.js';
import { supabase } from '../lib/supabase.js';

const AVAILABILITY_PAGE_SIZE = 1000;

export function normalizeBookedRow(row) {
  if (!row?.date_key) return null;

  const rawVenueId = String(row.venue_id || '').trim();
  const matchedVenue =
    rawVenueId && rawVenueId !== MANUAL_VENUE_ID
      ? VENUE_BY_ID.get(rawVenueId)
      : null;

  const trimmedName = String(row.venue_name || '').trim();
  const resolvedVenueName =
    trimmedName || matchedVenue?.fullName || matchedVenue?.shortName || '';

  const resolvedVenueId = matchedVenue
    ? matchedVenue.id
    : trimmedName || rawVenueId === MANUAL_VENUE_ID
      ? MANUAL_VENUE_ID
      : '';

  const resolvedCourtType = matchedVenue
    ? normalizeCourtType(matchedVenue.courtType, 'indoor')
    : normalizeCourtType(row.court_type, 'indoor');

  return {
    dateKey: normalizeSessionDateKey(row.date_key),
    startHour: Number(row.start_hour),
    endHour: Number(row.end_hour),
    venueId: resolvedVenueId,
    venueName: resolvedVenueName,
    mapUrl: String(row.map_url || '').trim(),
    courtType: resolvedCourtType,
  };
}

export function resolveBookingVenueLabel(booking, fallbackLabel) {
  if (booking.venueName?.trim()) return booking.venueName.trim();
  const record =
    booking.venueId && booking.venueId !== MANUAL_VENUE_ID
      ? VENUE_BY_ID.get(booking.venueId)
      : null;
  return record?.fullName || record?.shortName || fallbackLabel;
}

export async function fetchVotes(client = supabase) {
  const { data, error } = await client
    .from('calendar_votes')
    .select('*')
    .order('created_at', { ascending: true });

  return { votes: data || [], error };
}

export async function fetchBookedSessions(
  minDate = getJstDayMeta(0).dateKey,
  client = supabase
) {
  const { data, error } = await client
    .from('booked_sessions')
    .select(
      'date_key, start_hour, end_hour, venue_id, venue_name, map_url, court_type'
    )
    .gte('date_key', minDate)
    .order('date_key', { ascending: true });

  if (error) return { bookedSessionsByDate: null, error };

  const bookedSessionsByDate = {};
  for (const row of data || []) {
    const normalized = normalizeBookedRow(row);
    if (normalized) bookedSessionsByDate[normalized.dateKey] = normalized;
  }
  return { bookedSessionsByDate, error: null };
}

export async function fetchSessionAttendees(
  minDate = getJstDayMeta(0).dateKey,
  client = supabase
) {
  const { data, error } = await client
    .from('session_attendees')
    .select(
      'session_date, start_hour, end_hour, venue_id, venue_name, attendee_name, status'
    )
    .gte('session_date', minDate);

  if (error) return { attendeesByDate: null, error };

  const attendeesByDate = {};
  for (const row of data || []) {
    const dateKey = normalizeSessionDateKey(row?.session_date);
    const cleanName = String(row?.attendee_name || '').trim();
    if (!dateKey || !cleanName) continue;
    if (!attendeesByDate[dateKey]) attendeesByDate[dateKey] = [];
    attendeesByDate[dateKey].push({
      sessionDate: dateKey,
      startHour: Number(row.start_hour),
      endHour: Number(row.end_hour),
      venueId: String(row.venue_id || ''),
      venueName: String(row.venue_name || ''),
      attendeeName: cleanName,
      status: row.status === 'maybe' ? 'maybe' : 'yes',
    });
  }
  return { attendeesByDate, error: null };
}

export async function fetchCourtAvailability(
  minDate = getJstDayMeta(0).dateKey,
  client = supabase
) {
  const openVenuesBySlot = {};
  const bookedVenuesBySlot = {};
  let latestYoyacool = '';
  let latestSpacepad = '';

  for (let from = 0; ; from += AVAILABILITY_PAGE_SIZE) {
    const { data, error } = await client
      .from('court_availability')
      .select(
        'slot_key, slot_date, time_range, court_detail, status, updated_at'
      )
      .gte('slot_date', minDate)
      .order('slot_key', { ascending: true })
      .range(from, from + AVAILABILITY_PAGE_SIZE - 1);

    if (error || !data?.length) break;

    for (const row of data) {
      const venueId = row.court_detail;
      if (!ACTIVE_VENUE_IDS.has(venueId)) continue;

      const key = `${row.slot_date}_${row.time_range}`;
      if (row.status === 'open') {
        if (!openVenuesBySlot[key]) openVenuesBySlot[key] = new Set();
        openVenuesBySlot[key].add(venueId);
      } else if (row.status === 'booked') {
        if (!bookedVenuesBySlot[key]) bookedVenuesBySlot[key] = new Set();
        bookedVenuesBySlot[key].add(venueId);
      }

      const src = VENUE_BY_ID.get(venueId)?.source;
      if (src === 'yoyacool' && row.updated_at > latestYoyacool) {
        latestYoyacool = row.updated_at;
      } else if (src === 'spacepad' && row.updated_at > latestSpacepad) {
        latestSpacepad = row.updated_at;
      }
    }

    if (data.length < AVAILABILITY_PAGE_SIZE) break;
  }

  const hasData =
    Object.keys(openVenuesBySlot).length > 0 ||
    Object.keys(bookedVenuesBySlot).length > 0;

  return {
    hasData,
    openVenuesBySlot,
    bookedVenuesBySlot,
    lastSyncedAt: {
      yoyacool: formatJstTimestamp(latestYoyacool),
      spacepad: formatJstTimestamp(latestSpacepad),
    },
  };
}

export async function saveVoteWithRsvps(
  {
    editingVoteId,
    payload,
    pendingRsvpByDate,
    bookedSessionsByDate,
    attendeeName,
    fallbackVenueLabel,
  },
  client = supabase
) {
  const { error } = editingVoteId
    ? await client
        .from('calendar_votes')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', editingVoteId)
    : await client.from('calendar_votes').insert([payload]);

  if (error) throw error;

  const entries = Object.entries(pendingRsvpByDate || {});
  for (const [dateKey, choice] of entries) {
    const booking = bookedSessionsByDate[dateKey];
    if (!booking) continue;

    if (choice === 'yes') {
      const { error: upsertError } = await client
        .from('session_attendees')
        .upsert(
          {
            session_date: dateKey,
            start_hour: booking.startHour,
            end_hour: booking.endHour,
            venue_id: booking.venueId || '',
            venue_name: resolveBookingVenueLabel(booking, fallbackVenueLabel),
            attendee_name: attendeeName,
            status: 'yes',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'session_date,attendee_name' }
        );
      if (upsertError) throw upsertError;
    } else {
      const { data: deletedRows, error: deleteError } = await client
        .from('session_attendees')
        .delete()
        .eq('session_date', dateKey)
        .ilike('attendee_name', escapeIlikePattern(attendeeName))
        .select('id');
      if (deleteError) throw deleteError;
      if (!deletedRows?.length) {
        console.warn(
          'No session_attendees row deleted; check DELETE RLS policy.',
          { dateKey, attendeeName }
        );
      }
    }
  }
}

export async function deleteVoteCascade(
  { voteId, targetName },
  client = supabase
) {
  const { error } = await client
    .from('calendar_votes')
    .delete()
    .eq('id', voteId);
  if (error) throw error;

  if (targetName) {
    const { error: attendeeDeleteError } = await client
      .from('session_attendees')
      .delete()
      .ilike('attendee_name', escapeIlikePattern(targetName));
    if (attendeeDeleteError) throw attendeeDeleteError;
  }
}

async function seedSessionAttendees(
  { dateKey, dbRow, autoAttendeeNames = [], venueName = '' },
  client = supabase
) {
  if (!autoAttendeeNames.length) return;

  const nowIso = new Date().toISOString();
  const attendeeRows = autoAttendeeNames.map((attendeeName) => ({
    session_date: dateKey,
    start_hour: dbRow.start_hour,
    end_hour: dbRow.end_hour,
    venue_id: dbRow.venue_id || '',
    venue_name: venueName,
    attendee_name: attendeeName,
    status: 'yes',
    updated_at: nowIso,
  }));

  const { error: seedError } = await client
    .from('session_attendees')
    .upsert(attendeeRows, { onConflict: 'session_date,attendee_name' });
  if (seedError) {
    console.error('Failed to auto-seed session_attendees:', seedError);
  }
}

export async function createBookedSession(
  { dateKey, dbRow, autoAttendeeNames = [], venueName = '' },
  client = supabase
) {
  const { error } = await client.from('booked_sessions').insert({
    date_key: dateKey,
    ...dbRow,
  });

  if (error?.code === '23505') {
    return { ok: false, isDuplicate: true, error };
  }
  if (error) {
    return { ok: false, isDuplicate: false, error };
  }

  await seedSessionAttendees(
    { dateKey, dbRow, autoAttendeeNames, venueName },
    client
  );

  return { ok: true, isDuplicate: false, error: null };
}

export async function updateBookedSession(
  { dateKey, dbRow, autoAttendeeNames = [], venueName = '' },
  client = supabase
) {
  const { error } = await client
    .from('booked_sessions')
    .update(dbRow)
    .eq('date_key', dateKey);
  if (error) throw error;

  const { error: clearError } = await client
    .from('session_attendees')
    .delete()
    .eq('session_date', dateKey);
  if (clearError) {
    console.error('Failed to clear stale session_attendees:', clearError);
  }

  await seedSessionAttendees(
    { dateKey, dbRow, autoAttendeeNames, venueName },
    client
  );
}

export async function clearBookedSessionCascade(
  { dateKey },
  client = supabase
) {
  const { error } = await client
    .from('booked_sessions')
    .delete()
    .eq('date_key', dateKey);
  if (error) throw error;

  await client
    .from('session_attendees')
    .delete()
    .eq('session_date', dateKey);
}

export function subscribeToSchedulerRealtime(
  { onVotesChange, onBookingEvent, onAttendeesChange },
  client = supabase
) {
  const votesChannel = client
    .channel('calendar-votes-realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'calendar_votes' },
      onVotesChange
    )
    .subscribe();

  const bookingsChannel = client
    .channel('booked-sessions-realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'booked_sessions' },
      onBookingEvent
    )
    .subscribe();

  const attendeesChannel = client
    .channel('session-attendees-realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'session_attendees' },
      onAttendeesChange
    )
    .subscribe();

  return () => {
    client.removeChannel(votesChannel);
    client.removeChannel(bookingsChannel);
    client.removeChannel(attendeesChannel);
  };
}
