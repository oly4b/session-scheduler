import { VENUES } from '../config/venues.js';
import {
  DAY_MS,
  DOW_EN,
  DOW_JP,
  JST_OFFSET_MS,
  formatJstTimestamp,
  getJstParts,
} from './jst.js';

const MONTH_EN = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export { JST_OFFSET_MS, formatJstTimestamp };

// Set of all configured venue IDs; used to ignore retired/unknown court_detail rows in DB.
export const ACTIVE_VENUE_IDS = new Set(VENUES.map((v) => v.id));

// Canonical 1-hour columns (12:00–22:00). `isStudentPrime` (>= 18:00) marks
// weekday evening hours when student-discounted/prime sessions are highlighted.
export const TIME_BLOCKS = Array.from({ length: 10 }, (_, idx) => {
  const startHour = 12 + idx;
  const endHour = startHour + 1;
  const startStr = `${String(startHour).padStart(2, '0')}:00`;
  const endStr = `${String(endHour).padStart(2, '0')}:00`;
  return {
    id: `${startStr}-${endStr}`,
    startHour,
    label: `${startStr}–${endStr}`,
    shortLabel: startStr,
    isStudentPrime: startHour >= 18,
  };
});

/**
 * Calculates the Vernal Equinox Day (春分の日) in March for a given year.
 *
 * @param {number} year
 * @returns {number}
 */
function getVernalEquinoxDay(year) {
  return Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

/**
 * Calculates the Autumnal Equinox Day (秋分の日) in September for a given year.
 *
 * @param {number} year
 * @returns {number}
 */
function getAutumnalEquinoxDay(year) {
  return Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

/**
 * Returns the day of the month for the Nth specific weekday in a month.
 *
 * @param {number} year
 * @param {number} month - 1-indexed month (1 = January).
 * @param {number} weekday - 0 (Sunday) through 6 (Saturday).
 * @param {number} nth - 1-indexed occurrence (e.g., 2 for 2nd Monday).
 * @returns {number}
 */
function getNthWeekdayOfMonth(year, month, weekday, nth) {
  const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const offset = (weekday - firstDow + 7) % 7;
  return 1 + offset + (nth - 1) * 7;
}

const holidayYearCache = new Map();

/**
 * Computes all Japanese national holidays (国民の祝日), substitute holidays
 * (振替休日), and Citizens' holidays (国民の休日) for a given year.
 *
 * @param {number} year
 * @returns {Set<string>} Set of `YYYY-MM-DD` date strings.
 */
function getJapaneseHolidaysForYear(year) {
  if (holidayYearCache.has(year)) return holidayYearCache.get(year);

  const baseHolidays = new Set();
  const add = (m, d) => {
    baseHolidays.add(`${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  };

  add(1, 1); // 元日
  add(1, getNthWeekdayOfMonth(year, 1, 1, 2)); // 成人の日 (2nd Mon)
  add(2, 11); // 建国記念の日
  add(2, 23); // 天皇誕生日
  add(3, getVernalEquinoxDay(year)); // 春分の日
  add(4, 29); // 昭和の日
  add(5, 3); // 憲法記念日
  add(5, 4); // みどりの日
  add(5, 5); // こどもの日
  add(7, getNthWeekdayOfMonth(year, 7, 1, 3)); // 海の日 (3rd Mon)
  add(8, 11); // 山の日
  add(9, getNthWeekdayOfMonth(year, 9, 1, 3)); // 敬老の日 (3rd Mon)
  add(9, getAutumnalEquinoxDay(year)); // 秋分の日
  add(10, getNthWeekdayOfMonth(year, 10, 1, 2)); // スポーツの日 (2nd Mon)
  add(11, 3); // 文化の日
  add(11, 23); // 勤労感謝の日

  const allHolidays = new Set(baseHolidays);

  // Substitute holidays (振替休日): Sunday holiday shifts to next non-holiday weekday
  for (const dateKey of baseHolidays) {
    const dt = new Date(`${dateKey}T00:00:00Z`);
    if (dt.getUTCDay() !== 0) continue;

    let cursor = new Date(dt.getTime() + DAY_MS);
    while (allHolidays.has(cursor.toISOString().slice(0, 10))) {
      cursor = new Date(cursor.getTime() + DAY_MS);
    }
    allHolidays.add(cursor.toISOString().slice(0, 10));
  }

  // Citizens' holiday (国民の休日): non-holiday sandwiched between two holidays
  for (let m = 1; m <= 12; m += 1) {
    const daysInMonth = new Date(Date.UTC(year, m, 0)).getUTCDate();
    for (let d = 2; d < daysInMonth; d += 1) {
      const cur = new Date(Date.UTC(year, m - 1, d));
      if (cur.getUTCDay() === 0) continue;

      const curKey = cur.toISOString().slice(0, 10);
      if (allHolidays.has(curKey)) continue;

      const prevKey = new Date(cur.getTime() - DAY_MS).toISOString().slice(0, 10);
      const nextKey = new Date(cur.getTime() + DAY_MS).toISOString().slice(0, 10);
      if (allHolidays.has(prevKey) && allHolidays.has(nextKey)) {
        allHolidays.add(curKey);
      }
    }
  }

  holidayYearCache.set(year, allHolidays);
  return allHolidays;
}

/**
 * Returns JST calendar metadata for `offsetDays` from today.
 *
 * @param {number} offsetDays
 */
export function getJstDayMeta(offsetDays) {
  const { year, month, day, dowIdx, dateKey } = getJstParts(offsetDays);
  const isHoliday = getJapaneseHolidaysForYear(year).has(dateKey);
  const holiday = isHoliday ? '祝' : '';

  let dayType = 'weekday';
  if (isHoliday || dowIdx === 0) dayType = 'holiday';
  else if (dowIdx === 6) dayType = 'saturday';

  return {
    dateKey,
    year,
    jpDate: `${month}月${day}日`,
    enDate: `${MONTH_EN[month - 1]} ${day}`,
    shortDate: `${month}/${day}`,
    dow: DOW_JP[dowIdx],
    enDow: DOW_EN[dowIdx],
    holiday,
    dayType,
  };
}

export const CHOICE_PRIORITY = { yes: 3, maybe: 2, no: 1 };
export const LEGACY_PREFIX = 'spacepad_1_3_';

/**
 * Normalizes a voter's response map, stripping legacy Spacepad prefixes and
 * keeping the highest-priority choice (`yes` > `maybe` > `no`) on collisions.
 *
 * @param {Record<string, string> | null | undefined} responses
 * @returns {Record<string, string>}
 */
/**
 * Escapes `%`, `_`, and `\` before passing user-supplied names into Supabase `.ilike()`
 * so special characters are matched literally rather than as SQL wildcards.
 */
export function escapeIlikePattern(value) {
  return String(value || '').replace(/[\\%_]/g, '\\$&');
}

export function normalizeResponsesMap(responses) {
  const normalized = {};
  for (const [rawKey, value] of Object.entries(responses || {})) {
    if (!value) continue;
    const cleanKey = rawKey.startsWith(LEGACY_PREFIX)
      ? rawKey.slice(LEGACY_PREFIX.length)
      : rawKey;

    const existing = normalized[cleanKey];
    if (!existing || (CHOICE_PRIORITY[value] ?? 0) > (CHOICE_PRIORITY[existing] ?? 0)) {
      normalized[cleanKey] = value;
    }
  }
  return normalized;
}

/**
 * Retrieves a voter's merged choice for a given `YYYY-MM-DD_HH:00-HH:00` slot key.
 *
 * @param {Record<string, string> | null | undefined} responses
 * @param {string} slotKey
 * @returns {string | undefined}
 */
export function getMergedVoterChoice(responses, slotKey) {
  if (!responses) return undefined;
  const direct = responses[slotKey];
  const legacy = responses[`${LEGACY_PREFIX}${slotKey}`];
  if (!direct) return legacy;
  if (!legacy) return direct;
  return (CHOICE_PRIORITY[direct] ?? 0) >= (CHOICE_PRIORITY[legacy] ?? 0) ? direct : legacy;
}

/**
 * Ranks available venues for a slot or 2-hour block, strictly prioritizing:
 * 1. Indoor gyms over outdoor courts (`indoor` > `outdoor`)
 * 2. Continuous multi-hour open spans (`isContinuous`)
 * 3. Proximity to Okayama Station (`distanceKm`)
 *
 * @param {Array<object>} candidateVenues
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
  const scored = candidateVenues.map((venue) => {
    let minOpenHour = Math.min(...targetHours);
    let maxOpenHour = Math.max(...targetHours);

    while (minOpenHour > 12) {
      const prevKey = `${dateKey}_${String(minOpenHour - 1).padStart(2, '0')}:00-${String(minOpenHour).padStart(2, '0')}:00`;
      if (openVenuesBySlot[prevKey]?.has(venue.id)) minOpenHour -= 1;
      else break;
    }

    while (maxOpenHour < 21) {
      const nextKey = `${dateKey}_${String(maxOpenHour + 1).padStart(2, '0')}:00-${String(maxOpenHour + 2).padStart(2, '0')}:00`;
      if (openVenuesBySlot[nextKey]?.has(venue.id)) maxOpenHour += 1;
      else break;
    }

    const spanHours = maxOpenHour - minOpenHour + 1;
    const isContinuous = spanHours >= 2;
    const continuousSpan = isContinuous
      ? `${String(minOpenHour).padStart(2, '0')}:00–${String(maxOpenHour + 1).padStart(2, '0')}:00 連続空き`
      : null;

    return {
      ...venue,
      isContinuous,
      spanHours,
      continuousSpan,
    };
  });

  return scored
    .sort((a, b) => {
      const aIndoor = a.courtType === 'indoor' ? 1 : 0;
      const bIndoor = b.courtType === 'indoor' ? 1 : 0;
      if (bIndoor !== aIndoor) return bIndoor - aIndoor;
      if (b.isContinuous !== a.isContinuous) return b.isContinuous - a.isContinuous;
      return a.distanceKm - b.distanceKm;
    })
    .slice(0, limit);
}