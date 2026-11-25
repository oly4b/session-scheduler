import test from 'node:test';
import assert from 'node:assert/strict';
import {
  adjustBookingEndForStart,
  buildBookingPayloadFromForm,
  clampBookingEndTime,
  clampBookingTimeForDate,
} from '../src/domain/bookingForm.js';
import {
  MANUAL_VENUE_ID,
  OTHER_VENUE_OPTION,
  buildShortEventUrl,
  formatConfirmedSessionInvite,
} from '../src/utils/confirmedInvite.js';

test('bookingForm time clamping and payload building', () => {
  assert.equal(
    clampBookingTimeForDate('2026-12-01', '14:00-16:00', '2026-12-01', 16),
    '17:00-18:00'
  );
  assert.equal(
    adjustBookingEndForStart('19:00', '17:00-18:00'),
    '19:00-20:00'
  );
  assert.equal(clampBookingEndTime('17:00', '18:00-20:00'), '18:00-19:00');

  const known = buildBookingPayloadFromForm({
    bookingTime: '18:00-20:00',
    selectedBookingVenueId: 'kurashiki_gym',
    customBookingVenue: '',
    customBookingMapUrl: '',
    bookingCourtType: 'outdoor',
  });
  assert.equal(known.dbRow.venue_id, 'kurashiki_gym');
  assert.equal(known.dbRow.venue_name, '');
  assert.equal(known.dbRow.court_type, 'indoor');
  assert.equal(known.stateEntry.venueName, '倉敷体育館');

  const custom = buildBookingPayloadFromForm({
    bookingTime: '14:00-16:00',
    selectedBookingVenueId: OTHER_VENUE_OPTION,
    customBookingVenue: 'Custom Park',
    customBookingMapUrl: 'https://maps.google.com/?q=custom',
    bookingCourtType: 'outdoor',
  });
  assert.equal(custom.dbRow.venue_id, MANUAL_VENUE_ID);
  assert.equal(custom.dbRow.venue_name, 'Custom Park');
  assert.equal(custom.dbRow.court_type, 'outdoor');
});

test('confirmedInvite builds short v= URL for known venues and venue= for custom', () => {
  const knownUrl = buildShortEventUrl({
    origin: 'https://example.com',
    dateIso: '2026-12-01',
    startHour: 18,
    endHour: 20,
    venueId: 'fukuda',
  });
  assert.equal(
    knownUrl,
    'https://example.com/api/event?date=2026-12-01&start=18&end=20&v=fukuda'
  );

  const invite = formatConfirmedSessionInvite({
    origin: 'https://example.com',
    dateIso: '2026-12-01',
    timeRangeText: '18:00-20:00',
    venueId: OTHER_VENUE_OPTION,
    customVenueName: 'Municipal Gym',
    customMapUrl: 'https://maps.google.com/?q=gym',
    courtType: 'indoor',
    format: 'en',
  });
  assert.match(invite, /Municipal Gym/);
  assert.match(invite, /venue=Municipal\+Gym/);
});
