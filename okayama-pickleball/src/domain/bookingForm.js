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

export const START_HOUR_OPTIONS = Array.from({ length: 10 }, (_, idx) => {
  const hour = String(idx + 12).padStart(2, '0');
  return `${hour}:00`;
});

export const END_HOUR_OPTIONS = Array.from({ length: 10 }, (_, idx) => {
  const hour = String(idx + 13).padStart(2, '0');
  return `${hour}:00`;
});

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

export function clampBookingEndTime(nextEnd, currentTime) {
  const currentStart = String(currentTime || '').split('-')[0] || '17:00';
  const startHour = parseHourValue(currentStart);
  const endHour = parseHourValue(nextEnd);
  const minEndHour = Math.min(22, startHour + 1);
  const clampedEnd =
    endHour <= startHour ? formatHourSlot(minEndHour) : nextEnd;
  return `${currentStart}-${clampedEnd}`;
}

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
