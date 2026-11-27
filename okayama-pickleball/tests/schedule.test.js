import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyDayTimeRange,
  applyDayWindowToResponses,
  buildCalendarWeeks,
  clearWeekResponses,
  computeRankedTwoHourBlocks,
  computeSlotTallies,
  computeTwoHourHighlights,
  cycleSlotChoice,
  fillDayFromHourOnwards,
  fillWeekAllResponses,
  filterActiveVotes,
  findAttendeesAvailableForSession,
} from '../src/domain/schedule.js';

function fakeDayMeta(offset) {
  const dayNum = String(offset + 1).padStart(2, '0');
  return {
    dateKey: `2026-12-${dayNum}`,
    year: 2026,
    jpDate: `12月${offset + 1}日`,
    shortDate: `12/${offset + 1}`,
    dow: '火',
    holiday: '',
    dayType: 'weekday',
  };
}

test('computeRankedTwoHourBlocks skips booked dates and ranks top 5', () => {
  const openVenuesBySlot = {
    '2026-12-01_18:00-19:00': new Set(['kurashiki_gym']),
    '2026-12-01_19:00-20:00': new Set(['kurashiki_gym']),
    '2026-12-02_18:00-19:00': new Set(['fukuda']),
    '2026-12-02_19:00-20:00': new Set(['fukuda']),
  };

  const bookedSessionsByDate = {
    '2026-12-01': { dateKey: '2026-12-01', startHour: 18, endHour: 20 },
  };

  const { calendarWeeks } = buildCalendarWeeks({
    openVenuesBySlot,
    bookedVenuesBySlot: {},
    bookedSessionsByDate,
    isJa: true,
    getDayMeta: fakeDayMeta,
  });

  const votes = [
    {
      id: '1',
      name: 'A',
      responses: {
        '2026-12-01_18:00-19:00': 'yes',
        '2026-12-01_19:00-20:00': 'yes',
        '2026-12-02_18:00-19:00': 'yes',
        '2026-12-02_19:00-20:00': 'yes',
      },
    },
    {
      id: '2',
      name: 'B',
      responses: {
        '2026-12-01_18:00-19:00': 'yes',
        '2026-12-01_19:00-20:00': 'yes',
        '2026-12-02_18:00-19:00': 'yes',
        '2026-12-02_19:00-20:00': 'yes',
      },
    },
    {
      id: '3',
      name: 'C',
      responses: {
        '2026-12-01_18:00-19:00': 'yes',
        '2026-12-01_19:00-20:00': 'yes',
        '2026-12-02_18:00-19:00': 'maybe',
        '2026-12-02_19:00-20:00': 'yes',
      },
    },
  ];

  const ranked = computeRankedTwoHourBlocks({
    calendarWeeks,
    openVenuesBySlot,
    votes,
    bookedSessionsByDate,
  });

  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].dateKey, '2026-12-02');
  assert.equal(ranked[0].bothYesCount, 2);
  assert.equal(ranked[0].flexBothCount, 1);
});

test('cycleSlotChoice and week/day reducers update responses purely', () => {
  const key = '2026-12-01_18:00-19:00';
  let r = cycleSlotChoice({}, key);
  assert.equal(r[key], 'yes');
  r = cycleSlotChoice(r, key);
  assert.equal(r[key], 'maybe');
  r = cycleSlotChoice(r, key);
  assert.equal(r[key], 'no');
  r = cycleSlotChoice(r, key);
  assert.equal(r[key], undefined);

  const openVenuesBySlot = {
    '2026-12-01_14:00-15:00': new Set(['kurashiki_gym']),
    '2026-12-01_15:00-16:00': new Set(['kurashiki_gym']),
    '2026-12-01_18:00-19:00': new Set(['kurashiki_gym']),
    '2026-12-01_19:00-20:00': new Set(['kurashiki_gym']),
  };

  const { calendarWeeks, allOpenSlots } = buildCalendarWeeks({
    openVenuesBySlot,
    bookedVenuesBySlot: {},
    bookedSessionsByDate: {},
    isJa: false,
    getDayMeta: fakeDayMeta,
  });

  const { twoHourEligibleSlotKeys } = computeTwoHourHighlights({
    calendarWeeks,
    openVenuesBySlot,
  });

  const day = calendarWeeks[0].days[0];
  const eveningOnly = applyDayWindowToResponses(
    {},
    day,
    'evening',
    twoHourEligibleSlotKeys
  );
  assert.deepEqual(Object.keys(eveningOnly).sort(), [
    '2026-12-01_18:00-19:00',
    '2026-12-01_19:00-20:00',
  ]);

  const filled = fillWeekAllResponses(
    {},
    calendarWeeks[0],
    {},
    twoHourEligibleSlotKeys
  );
  assert.equal(Object.keys(filled.responses).length, 4);

  const cleared = clearWeekResponses(filled.responses, allOpenSlots, 0);
  assert.equal(Object.keys(cleared).length, 0);
});

test('filterActiveVotes & computeSlotTallies handle legacy prefix and RSVPs', () => {
  const openVenuesBySlot = {
    '2026-12-01_18:00-19:00': new Set(['kurashiki_gym']),
    '2026-12-01_19:00-20:00': new Set(['kurashiki_gym']),
  };

  const { allOpenSlots } = buildCalendarWeeks({
    openVenuesBySlot,
    bookedVenuesBySlot: {},
    bookedSessionsByDate: {},
    isJa: true,
    getDayMeta: fakeDayMeta,
  });

  const votes = [
    {
      id: '1',
      name: 'LegacyVoter',
      responses: { 'spacepad_1_3_2026-12-01_18:00-19:00': 'yes' },
      note: '',
    },
    {
      id: '2',
      name: 'RsvpOnly',
      responses: {},
      note: '',
    },
    {
      id: '3',
      name: 'Inactive',
      responses: { '2026-11-01_18:00-19:00': 'yes' },
      note: '',
    },
  ];

  const active = filterActiveVotes({
    votes,
    allOpenSlots,
    attendeesByDate: { '2026-12-01': [{ attendeeName: 'RsvpOnly' }] },
  });
  assert.deepEqual(
    active.map((v) => v.name),
    ['LegacyVoter', 'RsvpOnly']
  );

  const tallies = computeSlotTallies({ allOpenSlots, votes, openVenuesBySlot });
  assert.equal(tallies['2026-12-01_18:00-19:00'].yesCount, 1);
  assert.equal(tallies['2026-12-01_18:00-19:00'].isTopPick, true);
});

test('findAttendeesAvailableForSession works across arbitrary time ranges and durations', () => {
  const votes = [
    {
      id: '1',
      name: 'AllHours',
      responses: {
        '2026-12-01_12:00-13:00': 'yes',
        '2026-12-01_15:00-16:00': 'yes',
        '2026-12-01_16:00-17:00': 'yes',
        '2026-12-01_18:00-19:00': 'yes',
        '2026-12-01_19:00-20:00': 'yes',
        'spacepad_1_3_2026-12-01_20:00-21:00': 'yes',
      },
    },
    {
      id: '2',
      name: 'FirstHourOnly',
      responses: {
        '2026-12-01_15:00-16:00': 'yes',
        '2026-12-01_18:00-19:00': 'yes',
        '2026-12-01_19:00-20:00': 'yes',
      },
    },
    {
      id: '3',
      name: 'SecondHourOnly',
      responses: {
        '2026-12-01_16:00-17:00': 'yes',
      },
    },
    {
      id: '4',
      name: 'MaybeSecond',
      responses: {
        '2026-12-01_15:00-16:00': 'yes',
        '2026-12-01_16:00-17:00': 'maybe',
      },
    },
    {
      id: '5',
      name: 'OtherDate',
      responses: {
        '2026-12-02_12:00-13:00': 'yes',
      },
    },
  ];

  // 1-hour session
  assert.deepEqual(
    findAttendeesAvailableForSession({
      votes,
      dateKey: '2026-12-01',
      startHour: 12,
      endHour: 13,
    }),
    ['AllHours']
  );

  // 2-hour session
  assert.deepEqual(
    findAttendeesAvailableForSession({
      votes,
      dateKey: '2026-12-01',
      startHour: 15,
      endHour: 17,
    }),
    ['AllHours']
  );

  // 3-hour evening session (including legacy spacepad_1_3_ key)
  assert.deepEqual(
    findAttendeesAvailableForSession({
      votes,
      dateKey: '2026-12-01',
      startHour: 18,
      endHour: 21,
    }),
    ['AllHours']
  );
});

test('fillDayFromHourOnwards and applyDayTimeRange fill contiguous time ranges', () => {
  const dateKey = '2026-12-01';
  const eligible = new Set([
    `${dateKey}_13:00-14:00`,
    `${dateKey}_14:00-15:00`,
    `${dateKey}_15:00-16:00`,
    `${dateKey}_16:00-17:00`,
    `${dateKey}_17:00-18:00`,
    `${dateKey}_18:00-19:00`,
    `${dateKey}_19:00-20:00`,
    `${dateKey}_20:00-21:00`,
  ]);

  const onwards = fillDayFromHourOnwards({}, dateKey, 13, eligible);
  assert.equal(onwards[`${dateKey}_13:00-14:00`], 'yes');
  assert.equal(onwards[`${dateKey}_16:00-17:00`], 'yes');
  assert.equal(onwards[`${dateKey}_20:00-21:00`], 'yes');
  assert.equal(onwards[`${dateKey}_12:00-13:00`], undefined);

  const ranged = applyDayTimeRange(onwards, dateKey, 13, 18, eligible);
  assert.equal(ranged[`${dateKey}_13:00-14:00`], 'yes');
  assert.equal(ranged[`${dateKey}_15:00-16:00`], 'yes');
  assert.equal(ranged[`${dateKey}_18:00-19:00`], 'yes');
  assert.equal(ranged[`${dateKey}_19:00-20:00`], undefined);
  assert.equal(ranged[`${dateKey}_20:00-21:00`], undefined);
});
