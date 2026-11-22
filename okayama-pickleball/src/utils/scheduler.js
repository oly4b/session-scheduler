import { VENUES, VENUE_BY_ID } from '../config/venues';

export const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
export const DAY_MS = 86_400_000;
export const LEGACY_SPACEPAD_PREFIX = 'spacepad_1_3_';

export const TIME_BLOCKS = Array.from({ length: 10 }, (_, idx) => {
  const startHour = 12 + idx;
  const startLabel = `${String(startHour).padStart(2, '0')}:00`;
  const endLabel = `${String(startHour + 1).padStart(2, '0')}:00`;
  return {
    id: `${startLabel}-${endLabel}`,
    startHour,
    label: `${startLabel}–${endLabel}`,
    shortLabel: startLabel,
    isStudentPrime: startHour >= 18,
  };
});

export const ACTIVE_VENUE_IDS = new Set(VENUES.map((v) => v.id));

const JP_DOW = ['日', '月', '火', '水', '木', '金', '土'];
const RESPONSE_PRIORITY = { yes: 3, maybe: 2, no: 1 };

/** @type {Map<number, Set<string>>} */
const holidayCacheByYear = new Map();

function getNthWeekdayOfMonth(year, month, targetDow, occurrence) {
  const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const offset = (targetDow - firstDow + 7) % 7;
  return 1 + offset + (occurrence - 1) * 7;
}

function getEquinoxDay(year, isAutumnal) {
  const base = isAutumnal ? 23.2488 : 20.8431;
  return Math.floor(base + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

/**
 * Builds and caches all statutory Japanese national holidays (`YYYY-MM-DD`) for `year`,
 * including substitute holidays (振替休日) and sandwiched Citizens' Holidays (国民の休日).
 *
 * @param {number} year
 * @returns {Set<string>}
 */
function getJapaneseHolidaysForYear(year) {
  const cached = holidayCacheByYear.get(year);
  if (cached) return cached;

  const toKey = (m, d) =>
    `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  const baseDates = [
    [1, 1], // 元日
    [1, getNthWeekdayOfMonth(year, 1, 1, 2)], // 成人の日
    [2, 11], // 建国記念の日
    [2, 23], // 天皇誕生日
    [3, getEquinoxDay(year, false)], // 春分の日
    [4, 29], // 昭和の日
    [5, 3], // 憲法記念日
    [5, 4], // みどりの日
    [5, 5], // こどもの日
    [7, getNthWeekdayOfMonth(year, 7, 1, 3)], // 海の日
    [8, 11], // 山の日
    [9, getNthWeekdayOfMonth(year, 9, 1, 3)], // 敬老の日
    [9, getEquinoxDay(year, true)], // 秋分の日
    [10, getNthWeekdayOfMonth(year, 10, 1, 2)], // スポーツの日
    [11, 3], // 文化の日
    [11, 23], // 勤労感謝の日
  ];

  const holidays = new Set(baseDates.map(([m, d]) => toKey(m, d)));

  // Substitute holidays (振替休日): Sunday holidays shift to the next non-holiday weekday.
  for (const [m, d] of baseDates) {
    const date = new Date(Date.UTC(year, m - 1, d));
    if (date.getUTCDay() !== 0) continue;

    while (holidays.has(date.toISOString().slice(0, 10))) {
      date.setUTCDate(date.getUTCDate() + 1);
    }
    holidays.add(date.toISOString().slice(0, 10));
  }

  // Citizens' Holidays (国民の休日): a weekday sandwiched between two national holidays.
  for (const key of [...holidays]) {
    const dayAfter = new Date(`${key}T00:00:00Z`);
    dayAfter.setUTCDate(dayAfter.getUTCDate() + 1);
    const twoDaysAfter = new Date(dayAfter);
    twoDaysAfter.setUTCDate(twoDaysAfter.getUTCDate() + 1);

    const middleKey = dayAfter.toISOString().slice(0, 10);
    const endKey = twoDaysAfter.toISOString().slice(0, 10);

    if (dayAfter.getUTCDay() !== 0 && !holidays.has(middleKey) && holidays.has(endKey)) {
      holidays.add(middleKey);
    }
  }

  holidayCacheByYear.set(year, holidays);
  return holidays;
}

/**
 * Returns true if `dateKey` (`YYYY-MM-DD`) is a statutory Japanese national holiday.
 *
 * @param {number} year
 * @param {string} dateKey
 * @returns {boolean}
 */
export function isJapaneseHoliday(year, dateKey) {
  return getJapaneseHolidaysForYear(year).has(dateKey);
}

/**
 * Formats an integer start hour (e.g. `19`) into `19:00-20:00`.
 *
 * @param {number} startHour
 * @returns {string}
 */
export function formatHourBlock(startHour) {
  const start = String(startHour).padStart(2, '0');
  const end = String(startHour + 1).padStart(2, '0');
  return `${start}:00-${end}:00`;
}

/**
 * Returns JST calendar metadata for a day offset from today.
 *
 * @param {number} offsetDays
 */
export function getJstDayMeta(offsetDays) {
  const jst = new Date(Date.now() + JST_OFFSET_MS + offsetDays * DAY_MS);
  const year = jst.getUTCFullYear();
  const month = jst.getUTCMonth() + 1;
  const day = jst.getUTCDate();
  const dowIdx = jst.getUTCDay();
  const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const isHoliday = isJapaneseHoliday(year, dateKey);

  let dayType = 'weekday';
  if (isHoliday) dayType = 'holiday';
  else if (dowIdx === 6) dayType = 'saturday';
  else if (dowIdx === 0) dayType = 'sunday';

  return {
    dateKey,
    year,
    month,
    day,
    jpDate: `${month}月${day}日`,
    shortDate: `${month}/${day}`,
    dow: JP_DOW[dowIdx],
    dowIdx,
    holiday: isHoliday ? '祝' : '',
    dayType,
  };
}

/**
 * Resolves a voter's choice for `slotKey`, merging legacy Spacepad keys if present.
 *
 * @param {Record<string, string> | null | undefined} responsesMap
 * @param {string} slotKey
 * @returns {'yes' | 'maybe' | 'no' | undefined}
 */
export function getMergedVoterChoice(responsesMap, slotKey) {
  if (!responsesMap) return undefined;
  const direct = responsesMap[slotKey];
  const legacy = responsesMap[`${LEGACY_SPACEPAD_PREFIX}${slotKey}`];
  if (!direct) return legacy;
  if (!legacy) return direct;
  return RESPONSE_PRIORITY[direct] >= RESPONSE_PRIORITY[legacy] ? direct : legacy;
}

/**
 * Strips legacy prefixes from a voter's response map and deduplicates conflicts
 * using `RESPONSE_PRIORITY` (`yes` > `maybe` > `no`).
 *
 * @param {Record<string, string> | null | undefined} rawResponses
 * @returns {Record<string, 'yes' | 'maybe' | 'no'>}
 */
export function normalizeResponsesMap(rawResponses) {
  const normalized = {};
  if (!rawResponses) return normalized;

  for (const [key, val] of Object.entries(rawResponses)) {
    if (!val) continue;
    const cleanKey = key.startsWith(LEGACY_SPACEPAD_PREFIX)
      ? key.slice(LEGACY_SPACEPAD_PREFIX.length)
      : key;
    const existing = normalized[cleanKey];
    if (!existing || RESPONSE_PRIORITY[val] > RESPONSE_PRIORITY[existing]) {
      normalized[cleanKey] = val;
    }
  }
  return normalized;
}

function getVenueFacilityTier(venue) {
  if (venue.courtType === 'indoor') return 3;
  if (venue.hasLights) return 2;
  return 1;
}

/**
 * Ranks candidate venues by continuous adjacent availability, facility tier
 * (indoor > lit outdoor > unlit outdoor), and distance from JR Okayama Station.
 *
 * @param {import('../config/venues').VenueConfig[]} candidateVenues
 * @param {string} dateKey
 * @param {number[]} targetHours
 * @param {Record<string, Set<string>>} openVenuesBySlot
 * @param {number} [limit=3]
 */
export function rankRecommendedVenues(
  candidateVenues,
  dateKey,
  targetHours,
  openVenuesBySlot,
  limit = 3
) {
  const minHour = Math.min(...targetHours);
  const maxHour = Math.max(...targetHours);
  const prevHour = minHour - 1;
  const nextHour = maxHour + 1;

  const prevIds =
    prevHour >= 12
      ? openVenuesBySlot[`${dateKey}_${formatHourBlock(prevHour)}`]
      : undefined;
  const nextIds =
    nextHour <= 21
      ? openVenuesBySlot[`${dateKey}_${formatHourBlock(nextHour)}`]
      : undefined;

  return candidateVenues
    .map((venue) => {
      const hasPrev = Boolean(prevIds?.has(venue.id));
      const hasNext = Boolean(nextIds?.has(venue.id));
      const adjacentCount = (hasPrev ? 1 : 0) + (hasNext ? 1 : 0);

      let continuousSpan = null;
      if (hasPrev && hasNext) {
        continuousSpan = `${prevHour}:00–${nextHour + 1}:00 連続空き`;
      } else if (hasPrev) {
        continuousSpan = `${prevHour}:00–${maxHour + 1}:00 連続空き`;
      } else if (hasNext) {
        continuousSpan = `${minHour}:00–${nextHour + 1}:00 連続空き`;
      }

      return {
        ...venue,
        hasAdjacent: adjacentCount > 0,
        adjacentCount,
        continuousSpan,
        facilityTier: getVenueFacilityTier(venue),
      };
    })
    .sort((a, b) => {
      if (b.adjacentCount !== a.adjacentCount) return b.adjacentCount - a.adjacentCount;
      if (b.facilityTier !== a.facilityTier) return b.facilityTier - a.facilityTier;
      return (a.distanceKm ?? 99) - (b.distanceKm ?? 99);
    })
    .slice(0, limit);
}

/**
 * Formats an ISO timestamp into a compact JST month/day/time label.
 *
 * @param {string} iso
 * @returns {string}
 */
export function formatJstTimestamp(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export { VENUES, VENUE_BY_ID };