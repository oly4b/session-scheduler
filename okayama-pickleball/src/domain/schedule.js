import { VENUES } from '../config/venues.js';
import {
  TIME_BLOCKS,
  getJstDayMeta,
  getMergedVoterChoice,
  normalizeResponsesMap,
  rankRecommendedVenues,
} from '../utils/scheduler.js';

/**
 * Ranks preferred 2-hour start hours (lower = better).
 * Outdoor courts peak at 14:00 (daylight/temperature); indoor courts peak at 19:00 (after work/school).
 *
 * @param {number} startHour
 * @param {'indoor' | 'outdoor'} [courtType='indoor']
 * @returns {number}
 */
export function getTwoHourPreferenceRank(startHour, courtType = 'indoor') {
  if (courtType === 'outdoor') {
    if (startHour === 14) return 0;
    if (startHour === 13) return 1;
    if (startHour === 15) return 2;
    return 3 + Math.abs(startHour - 14);
  }
  if (startHour === 19) return 0;
  if (startHour === 18) return 1;
  if (startHour === 20) return 2;
  return 3 + Math.abs(startHour - 19);
}

/**
 * Builds the 4-week (28-day) calendar grid and flattens all open or booked-window
 * slots into `allOpenSlots` for tallying and week-clearing operations.
 *
 * @param {{
 *   openVenuesBySlot: Record<string, Set<string>>,
 *   bookedVenuesBySlot: Record<string, Set<string>>,
 *   bookedSessionsByDate: Record<string, { startHour: number, endHour: number }>,
 *   isJa: boolean,
 *   getDayMeta?: typeof getJstDayMeta,
 * }} params
 */
export function buildCalendarWeeks({
  openVenuesBySlot,
  bookedVenuesBySlot,
  bookedSessionsByDate,
  isJa,
  getDayMeta = getJstDayMeta,
}) {
  const hasLiveAvailability =
    Object.keys(openVenuesBySlot).length > 0 ||
    Object.keys(bookedVenuesBySlot).length > 0;
  const days = [];

  for (let offset = 0; offset < 28; offset += 1) {
    const meta = getDayMeta(offset);
    const isWeekendOrHoliday =
      meta.dayType === 'saturday' ||
      meta.dayType === 'sunday' ||
      meta.dayType === 'holiday';

    const slots = {};
    let openCount = 0;

    for (const block of TIME_BLOCKS) {
      const key = `${meta.dateKey}_${block.id}`;
      const openIds = openVenuesBySlot[key];
      const bookedIds = bookedVenuesBySlot[key];

      const filteredOpenVenues = openIds
        ? VENUES.filter((v) => openIds.has(v.id))
        : [];
      const filteredBookedVenues = bookedIds
        ? VENUES.filter((v) => bookedIds.has(v.id))
        : [];

      const isOpen = filteredOpenVenues.length > 0;
      if (isOpen) openCount += 1;

      slots[block.id] = {
        isOpen,
        isFullyBooked: !isOpen && filteredBookedVenues.length > 0,
        openVenues: filteredOpenVenues,
        openVenueIds: new Set(filteredOpenVenues.map((v) => v.id)),
        summaryText: filteredOpenVenues.map((v) => v.shortName).join(' / '),
        studentPrime: isWeekendOrHoliday || block.isStudentPrime,
      };
    }

    days.push({ ...meta, allBooked: openCount === 0, slots });
  }

  const calendarWeeks = [0, 7, 14, 21].map((start, idx) => {
    const slice = days.slice(start, start + 7);
    return {
      id: `week${idx + 1}`,
      shortTitle: isJa
        ? `第${idx + 1}週: ${slice[0].shortDate}–${slice[6].shortDate}`
        : `Week ${idx + 1}: ${slice[0].shortDate}–${slice[6].shortDate}`,
      rangeLabel: isJa
        ? `${slice[0].year}年 ${slice[0].jpDate}(${slice[0].dow}) 〜 ` +
          `${slice[6].jpDate}(${slice[6].dow})`
        : `${slice[0].enDate} (${slice[0].enDow}) – ` +
          `${slice[6].enDate} (${slice[6].enDow}), ${slice[6].year}`,
      days: slice,
    };
  });

  const allOpenSlots = [];
  calendarWeeks.forEach((week, weekIndex) => {
    for (const day of week.days) {
      const bookedEntry = bookedSessionsByDate[day.dateKey];
      for (const block of TIME_BLOCKS) {
        const cell = day.slots[block.id];
        const inBookedWindow =
          bookedEntry &&
          block.startHour >= bookedEntry.startHour &&
          block.startHour + 1 <= bookedEntry.endHour;
        if (!cell?.isOpen && !inBookedWindow) continue;

        allOpenSlots.push({
          slotKey: `${day.dateKey}_${block.id}`,
          weekIndex,
          dateKey: day.dateKey,
          jpDate: day.jpDate,
          enDate: day.enDate,
          dow: day.dow,
          enDow: day.enDow,
          holiday: day.holiday,
          dayType: day.dayType,
          blockId: block.id,
          startHour: block.startHour,
          timeLabel: block.label,
          openVenues: cell?.openVenues || [],
          openVenueIds: cell?.openVenueIds || new Set(),
          venueSummary: cell?.summaryText || '',
          studentPrime: Boolean(cell?.studentPrime),
        });
      }
    }
  });

  return { calendarWeeks, allOpenSlots, hasLiveAvailability };
}

/**
 * Keeps voters who have at least one active open-slot vote, a session RSVP, or a note
 * so old voters from expired weeks drop out of the UI without deleting DB rows.
 */
export function filterActiveVotes({ votes, allOpenSlots, attendeesByDate }) {
  const openKeySet = new Set(allOpenSlots.map((s) => s.slotKey));
  const rsvpNames = new Set();
  for (const rows of Object.values(attendeesByDate)) {
    for (const row of rows || []) {
      if (row.attendeeName) rsvpNames.add(row.attendeeName);
    }
  }

  return votes.filter((vote) => {
    const hasOpenSlotVote = Object.keys(
      normalizeResponsesMap(vote.responses)
    ).some((k) => openKeySet.has(k));
    const hasSessionRsvp = rsvpNames.has(String(vote.name || '').trim());
    const hasNote = Boolean(String(vote.note || '').trim());
    return hasOpenSlotVote || hasSessionRsvp || hasNote;
  });
}

/**
 * Identifies all contiguous 2-hour blocks with at least one shared open venue and
 * marks the single highest-ranked block per day (`isPriorityTwoHour`) with
 * `priorityPosition: 'start' | 'end'` so the UI can draw one spanning capsule.
 */
export function computeTwoHourHighlights({ calendarWeeks, openVenuesBySlot }) {
  const twoHourHighlightMap = {};
  const twoHourEligibleSlotKeys = new Set();

  for (const week of calendarWeeks) {
    for (const day of week.days) {
      const candidates = [];

      for (let i = 0; i < TIME_BLOCKS.length - 1; i += 1) {
        const b1 = TIME_BLOCKS[i];
        const b2 = TIME_BLOCKS[i + 1];
        const key1 = `${day.dateKey}_${b1.id}`;
        const key2 = `${day.dateKey}_${b2.id}`;

        const ids1 = openVenuesBySlot[key1];
        const ids2 = openVenuesBySlot[key2];
        if (!ids1 || !ids2) continue;

        const shared = VENUES.filter((v) => ids1.has(v.id) && ids2.has(v.id));
        if (!shared.length) continue;

        twoHourEligibleSlotKeys.add(key1);
        twoHourEligibleSlotKeys.add(key2);

        const topVenue = rankRecommendedVenues(
          shared,
          day.dateKey,
          [b1.startHour, b2.startHour],
          openVenuesBySlot,
          1
        )[0];

        candidates.push({
          key1,
          key2,
          spanLabel:
            `${b1.shortLabel}–${String(b2.startHour + 1).padStart(2, '0')}:00`,
          isIndoor: topVenue?.courtType === 'indoor' ? 1 : 0,
          timePrefRank: getTwoHourPreferenceRank(
            b1.startHour,
            topVenue?.courtType
          ),
          distanceKm: topVenue?.distanceKm ?? 99,
          topVenueName: topVenue?.shortName || '',
        });
      }

      if (!candidates.length) continue;

      candidates.sort((a, b) => {
        if (b.isIndoor !== a.isIndoor) return b.isIndoor - a.isIndoor;
        if (a.timePrefRank !== b.timePrefRank) {
          return a.timePrefRank - b.timePrefRank;
        }
        return a.distanceKm - b.distanceKm;
      });

      for (const candidate of candidates) {
        for (const key of [candidate.key1, candidate.key2]) {
          if (!twoHourHighlightMap[key]) {
            twoHourHighlightMap[key] = {
              isTwoHourPart: true,
              isPriorityTwoHour: false,
              spanLabel: candidate.spanLabel,
              topVenueName: candidate.topVenueName,
            };
          }
        }
      }

      const best = candidates[0];
      twoHourHighlightMap[best.key1] = {
        isTwoHourPart: true,
        isPriorityTwoHour: true,
        priorityPosition: 'start',
        spanLabel: best.spanLabel,
        topVenueName: best.topVenueName,
      };
      twoHourHighlightMap[best.key2] = {
        isTwoHourPart: true,
        isPriorityTwoHour: true,
        priorityPosition: 'end',
        spanLabel: best.spanLabel,
        topVenueName: best.topVenueName,
      };
    }
  }

  return { twoHourHighlightMap, twoHourEligibleSlotKeys };
}

export function computeSlotTallies({ allOpenSlots, votes, openVenuesBySlot }) {
  const tallyMap = {};
  let bestScore = 0;

  for (const slot of allOpenSlots) {
    const yesPlayers = [];
    const maybePlayers = [];
    const noPlayers = [];

    for (const vote of votes) {
      const choice = getMergedVoterChoice(vote.responses, slot.slotKey);
      if (choice === 'yes') yesPlayers.push(vote);
      else if (choice === 'maybe') maybePlayers.push(vote);
      else if (choice === 'no') noPlayers.push(vote);
    }

    // Weight `yes` 10x higher than `maybe` so a slot with more firm attendees always outranks `maybe`s.
    const score = yesPlayers.length * 100 + maybePlayers.length * 10;
    if (yesPlayers.length > 0 && score > bestScore) bestScore = score;

    const prevHour = String(slot.startHour - 1).padStart(2, '0');
    const currHour = String(slot.startHour).padStart(2, '0');
    const nextHour = String(slot.startHour + 1).padStart(2, '0');
    const endPlusTwo = String(slot.startHour + 2).padStart(2, '0');

    const prevIds =
      openVenuesBySlot[`${slot.dateKey}_${prevHour}:00-${currHour}:00`];
    const nextIds =
      openVenuesBySlot[`${slot.dateKey}_${nextHour}:00-${endPlusTwo}:00`];

    const twoHourEligibleVenues = slot.openVenues.filter(
      (v) => prevIds?.has(v.id) || nextIds?.has(v.id)
    );

    tallyMap[slot.slotKey] = {
      ...slot,
      isTwoHourBlock: false,
      yesPlayers,
      maybePlayers,
      noPlayers,
      yesCount: yesPlayers.length,
      maybeCount: maybePlayers.length,
      noCount: noPlayers.length,
      score,
      openVenues: twoHourEligibleVenues,
      recommendedVenues: rankRecommendedVenues(
        twoHourEligibleVenues,
        slot.dateKey,
        [slot.startHour],
        openVenuesBySlot,
        3
      ),
      isSweetSpot: yesPlayers.length >= 6 && yesPlayers.length <= 8,
      isDoubleCourt: yesPlayers.length >= 9,
      isTopPick: false,
    };
  }

  if (bestScore > 0) {
    for (const slot of allOpenSlots) {
      if (tallyMap[slot.slotKey].score === bestScore) {
        tallyMap[slot.slotKey].isTopPick = true;
      }
    }
  }

  return tallyMap;
}

/**
 * Ranks the top 5 upcoming 2-hour blocks across unbooked days.
 * Requires >= 3 total votes (minimum viable session size) and tiers scoring so
 * full 2h `yes` voters (1000) outweigh flexible `yes`/`maybe` (100) and 1h-only (10).
 */
export function computeRankedTwoHourBlocks({
  calendarWeeks,
  openVenuesBySlot,
  votes,
  bookedSessionsByDate,
}) {
  const bestByDate = [];

  for (const week of calendarWeeks) {
    for (const day of week.days) {
      if (day.allBooked || bookedSessionsByDate[day.dateKey]) continue;
      const dayBlocks = [];

      for (let i = 0; i < TIME_BLOCKS.length - 1; i += 1) {
        const b1 = TIME_BLOCKS[i];
        const b2 = TIME_BLOCKS[i + 1];
        const slotKey1 = `${day.dateKey}_${b1.id}`;
        const slotKey2 = `${day.dateKey}_${b2.id}`;

        const ids1 = openVenuesBySlot[slotKey1];
        const ids2 = openVenuesBySlot[slotKey2];
        if (!ids1 || !ids2) continue;

        const filteredShared = VENUES.filter(
          (v) => ids1.has(v.id) && ids2.has(v.id)
        );
        if (!filteredShared.length) continue;

        const bothYesPlayers = [];
        const flexBothPlayers = [];
        const partialYesPlayers = [];
        const noPlayers = [];

        for (const vote of votes) {
          const c1 = getMergedVoterChoice(vote.responses, slotKey1);
          const c2 = getMergedVoterChoice(vote.responses, slotKey2);

          if (c1 === 'yes' && c2 === 'yes') {
            bothYesPlayers.push(vote);
          } else if (
            (c1 === 'yes' || c1 === 'maybe') &&
            (c2 === 'yes' || c2 === 'maybe')
          ) {
            flexBothPlayers.push(vote);
          } else if (c1 === 'yes' || c2 === 'yes') {
            partialYesPlayers.push(vote);
          } else if (c1 === 'no' || c2 === 'no') {
            noPlayers.push(vote);
          }
        }

        const totalVotes =
          bothYesPlayers.length +
          flexBothPlayers.length +
          partialYesPlayers.length;
        if (totalVotes < 3) continue;

        const score =
          bothYesPlayers.length * 1000 +
          flexBothPlayers.length * 100 +
          partialYesPlayers.length * 10;

        const recommendedVenues = rankRecommendedVenues(
          filteredShared,
          day.dateKey,
          [b1.startHour, b2.startHour],
          openVenuesBySlot,
          3
        );
        const topCourtType = recommendedVenues[0]?.courtType;

        dayBlocks.push({
          slotKey: `${day.dateKey}_${b1.id}__2h`,
          slotKey1,
          slotKey2,
          isTwoHourBlock: true,
          dateKey: day.dateKey,
          jpDate: day.jpDate,
          enDate: day.enDate,
          dow: day.dow,
          enDow: day.enDow,
          holiday: day.holiday,
          timeLabel: `${b1.shortLabel}–${String(b2.startHour + 1).padStart(2, '0')}:00`,
          isIndoor: topCourtType === 'indoor' ? 1 : 0,
          timePrefRank: getTwoHourPreferenceRank(b1.startHour, topCourtType),
          openVenues: filteredShared,
          recommendedVenues,
          venueSummary: recommendedVenues.map((v) => v.shortName).join(' / '),
          yesPlayers: bothYesPlayers,
          maybePlayers: [...flexBothPlayers, ...partialYesPlayers],
          noPlayers,
          bothYesCount: bothYesPlayers.length,
          flexBothCount: flexBothPlayers.length,
          partialYesCount: partialYesPlayers.length,
          totalVotes,
          score,
          isSweetSpot: bothYesPlayers.length >= 6 && bothYesPlayers.length <= 8,
          isDoubleCourt: bothYesPlayers.length >= 9,
        });
      }

      if (!dayBlocks.length) continue;

      dayBlocks.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (b.isIndoor !== a.isIndoor) return b.isIndoor - a.isIndoor;
        return a.timePrefRank - b.timePrefRank;
      });
      const [primaryBlock, secondBestBlock = null] = dayBlocks;

      bestByDate.push({
        ...primaryBlock,
        alternativeTwoHourBlock: secondBestBlock,
      });
    }
  }

  return bestByDate.sort((a, b) => b.score - a.score).slice(0, 5);
}

/**
 * Purely cycles a single slot through `unset -> yes -> maybe -> no -> unset`
 * so clicking a cell repeatedly lets voters clear a choice without a reset button.
 */
export function cycleSlotChoice(responses, slotKey) {
  const current = responses[slotKey];
  const next = { ...responses };
  if (!current) next[slotKey] = 'yes';
  else if (current === 'yes') next[slotKey] = 'maybe';
  else if (current === 'maybe') next[slotKey] = 'no';
  else delete next[slotKey];
  return next;
}

/**
 * Marks `startHour` and subsequent unset 2h-eligible slots on `dateKey` as `'yes'`,
 * stopping before the next already-selected slot so existing ranges on the same
 * day (e.g. `17:00-19:00` when tapping `15:00`) are never overwritten.
 *
 * Returns `{ responses, previewKeys }` so a second tap can trim or reset only
 * the auto-filled preview slots.
 */
export function fillDayFromHourOnwards(
  responses,
  dateKey,
  startHour,
  twoHourEligibleSlotKeys
) {
  const next = { ...responses };
  const previewKeys = [];
  for (const block of TIME_BLOCKS) {
    if (block.startHour < startHour) continue;
    const slotKey = `${dateKey}_${block.id}`;
    if (!twoHourEligibleSlotKeys.has(slotKey)) continue;
    if (block.startHour > startHour && next[slotKey]) break;
    next[slotKey] = 'yes';
    previewKeys.push(slotKey);
  }
  return { responses: next, previewKeys };
}

/**
 * Finalizes a range selection on `dateKey`: keeps `fromHour..untilHour` as `'yes'`
 * and clears only the auto-filled `previewKeys` after `untilHour`, leaving any
 * previously selected ranges on the same date intact.
 */
export function applyDayTimeRange(
  responses,
  dateKey,
  fromHour,
  untilHour,
  twoHourEligibleSlotKeys,
  previewKeys = null
) {
  const next = { ...responses };
  const previewSet = previewKeys ? new Set(previewKeys) : null;
  for (const block of TIME_BLOCKS) {
    if (block.startHour < fromHour) continue;
    const slotKey = `${dateKey}_${block.id}`;
    if (!twoHourEligibleSlotKeys.has(slotKey)) continue;
    if (block.startHour <= untilHour) {
      if (!previewSet || previewSet.has(slotKey)) {
        next[slotKey] = 'yes';
      }
    } else if (!previewSet || previewSet.has(slotKey)) {
      delete next[slotKey];
    }
  }
  return next;
}

/**
 * Applies a day-level quick-select preset (`all`, `afternoon` <18:00, `evening` >=18:00,
 * or `null` to clear) only to open slots that belong to a valid 2-hour block.
 */
export function applyDayWindowToResponses(
  responses,
  day,
  nextMode,
  twoHourEligibleSlotKeys
) {
  const next = { ...responses };
  for (const block of TIME_BLOCKS) {
    const slotKey = `${day.dateKey}_${block.id}`;
    const cell = day.slots[block.id];
    if (!cell?.isOpen || !twoHourEligibleSlotKeys.has(slotKey)) continue;

    if (!nextMode) {
      delete next[slotKey];
      continue;
    }

    const matchesWindow =
      nextMode === 'all' ||
      (nextMode === 'afternoon' && block.startHour < 18) ||
      (nextMode === 'evening' && block.startHour >= 18);

    if (matchesWindow) next[slotKey] = 'yes';
    else delete next[slotKey];
  }
  return next;
}

/**
 * Marks every unbooked, 2h-eligible open slot in the active week as `yes` and
 * returns updated `dayWindows` so the row quick-select buttons stay in sync.
 */
export function fillWeekAllResponses(
  responses,
  week,
  bookedSessionsByDate,
  twoHourEligibleSlotKeys
) {
  const next = { ...responses };
  const dayWindows = {};

  for (const day of week.days) {
    if (day.allBooked || bookedSessionsByDate[day.dateKey]) continue;
    dayWindows[day.dateKey] = 'all';

    for (const block of TIME_BLOCKS) {
      const slotKey = `${day.dateKey}_${block.id}`;
      const cell = day.slots[block.id];
      if (!cell?.isOpen || !twoHourEligibleSlotKeys.has(slotKey)) continue;
      next[slotKey] = 'yes';
    }
  }

  return { responses: next, dayWindows };
}

/**
 * Clears all responses belonging to `weekIndex` while preserving votes on other weeks.
 */
export function clearWeekResponses(responses, allOpenSlots, weekIndex) {
  const next = { ...responses };
  for (const slot of allOpenSlots) {
    if (slot.weekIndex === weekIndex) {
      delete next[slot.slotKey];
    }
  }
  return next;
}

/**
 * Finds voters who answered `yes` to every 1-hour slot within `[startHour, endHour)`
 * so newly created or edited bookings auto-seed `session_attendees` accurately.
 */
export function findAttendeesAvailableForSession({
  votes,
  dateKey,
  startHour,
  endHour,
}) {
  if (!dateKey || !Number.isFinite(startHour) || !Number.isFinite(endHour)) {
    return [];
  }
  if (endHour <= startHour) return [];

  const requiredSlotKeys = [];
  for (let hour = startHour; hour < endHour; hour += 1) {
    const startStr = `${String(hour).padStart(2, '0')}:00`;
    const endStr = `${String(hour + 1).padStart(2, '0')}:00`;
    requiredSlotKeys.push(`${dateKey}_${startStr}-${endStr}`);
  }

  const seenNames = new Set();
  const matchedNames = [];

  for (const vote of votes || []) {
    const cleanName = String(vote?.name || '').trim();
    if (!cleanName) continue;

    const lower = cleanName.toLowerCase();
    if (seenNames.has(lower)) continue;

    const allYes = requiredSlotKeys.every(
      (slotKey) => getMergedVoterChoice(vote.responses, slotKey) === 'yes'
    );
    if (!allYes) continue;

    seenNames.add(lower);
    matchedNames.push(cleanName);
  }

  return matchedNames;
}
