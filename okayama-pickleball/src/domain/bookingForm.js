import { VENUE_BY_ID } from '../config/venues.js';
import {
  MANUAL_VENUE_ID,
  OTHER_VENUE_OPTION,
  normalizeCourtType,
} from '../utils/confirmedInvite.js';
import {
  formatHourSlot,
  getMinStartHourForDate,
  parseHourValue,
} from '../utils/jst.js';

// Scheduler operates on 1-hour blocks from 12:00 through 22:00 (starts 12–21, ends 13–22).
export const START_HOUR_OPTIONS = Array.from({ length: 10 }, (_, idx) => {
  const hour = String(idx + 12).padStart(2, '0');
  return `${hour}:00`;
});

export const END_HOUR_OPTIONS = Array.from({ length: 10 }, (_, idx) => {
  const hour = String(idx + 13).padStart(2, '0');
  return `${hour}:00`;
});

/**
 * Prevents selecting a past start hour when the user switches the booking date
 * to today (JST), clamping the range forward while keeping at least 1 hour.
 */
export function clampBookingTimeForDate(
  nextDate,
  currentTime,
  todayJstDateKey,
  currentJstHour
) {
  if (!nextDate) return currentTime;
  const minAllowedStart = getMinStartHourForDate(
    nextDate,
    todayJstDateKey,
    currentJstHour
  );
  const [rawStart, rawEnd] = String(currentTime || '').split('-');
  const currentStart = parseHourValue(rawStart || '17:00');
  const currentEnd = parseHourValue(rawEnd || '19:00');

  if (currentStart >= minAllowedStart) return currentTime;
  const nextStart = Math.min(21, minAllowedStart);
  const nextEnd = Math.min(22, Math.max(currentEnd, nextStart + 1));
  return `${formatHourSlot(nextStart)}-${formatHourSlot(nextEnd)}`;
}

/**
 * Auto-bumps the end time to `start + 1h` (capped at 22:00) whenever the user
 * picks a start time that meets or exceeds the current end time.
 */
export function adjustBookingEndForStart(nextStart, currentTime) {
  const currentEnd = String(currentTime || '').split('-')[1] || '19:00';
  const startHour = parseHourValue(nextStart);
  const endHour = parseHourValue(currentEnd);
  const adjustedEnd =
    endHour <= startHour
      ? formatHourSlot(Math.min(22, startHour + 1))
      : currentEnd;
  return `${nextStart}-${adjustedEnd}`;
}

/**
 * Guarantees end time stays strictly after start time when the user edits the
 * end-time dropdown directly.
 */
export function clampBookingEndTime(nextEnd, currentTime) {
  const currentStart = String(currentTime || '').split('-')[0] || '17:00';
  const startHour = parseHourValue(currentStart);
  const endHour = parseHourValue(nextEnd);
  const minEndHour = Math.min(22, startHour + 1);
  const clampedEnd =
    endHour <= startHour ? formatHourSlot(minEndHour) : nextEnd;
  return `${currentStart}-${clampedEnd}`;
}

/**
 * Builds both the Supabase `booked_sessions` row (`dbRow`) and the optimistic
 * React state entry (`stateEntry`). Known venues omit `venue_name`/`map_url` in
 * `dbRow` so `VENUE_BY_ID` remains the single source of truth; custom venues use
 * `MANUAL_VENUE_ID` ('other').
 */
export function buildBookingPayloadFromForm({
  bookingTime,
  selectedBookingVenueId,
  customBookingVenue,
  customBookingMapUrl,
  bookingCourtType,
}) {
  const [rawStart, rawEnd] = String(bookingTime || '').split('-');
  const startHour = parseHourValue(rawStart || '17:00');
  const endHour = Math.max(startHour + 1, parseHourValue(rawEnd || '19:00'));
  const isOther =
    selectedBookingVenueId === OTHER_VENUE_OPTION || !selectedBookingVenueId;
  const venueName = isOther ? customBookingVenue.trim() : '';
  const mapUrl = isOther ? customBookingMapUrl.trim() : '';
  const venueId = isOther ? MANUAL_VENUE_ID : selectedBookingVenueId;
  const matchedVenue = !isOther ? VENUE_BY_ID.get(venueId) : null;
  const courtType = isOther
    ? normalizeCourtType(bookingCourtType, 'indoor')
    : normalizeCourtType(matchedVenue?.courtType, 'indoor');
  const displayName = isOther
    ? venueName
    : matchedVenue?.fullName || matchedVenue?.shortName || '';

  return {
    dbRow: {
      start_hour: startHour,
      end_hour: endHour,
      venue_id: venueId,
      venue_name: venueName,
      map_url: mapUrl,
      court_type: courtType,
      updated_at: new Date().toISOString(),
    },
    stateEntry: {
      startHour,
      endHour,
      venueId,
      venueName: displayName,
      mapUrl,
      courtType,
    },
  };
}
