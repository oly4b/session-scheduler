export const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;
export const DOW_JP = ['日', '月', '火', '水', '木', '金', '土'];
export const DOW_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Returns a JST calendar date string (`YYYY-MM-DD`) offset from today.
 *
 * @param {number} [offsetDays=0]
 * @returns {string}
 */
export function getJstDateString(offsetDays = 0) {
  const timestamp = Date.now() + JST_OFFSET_MS + offsetDays * DAY_MS;
  return new Date(timestamp).toISOString().slice(0, 10);
}

/**
 * Returns today's date in JST as `YYYY-MM-DD`.
 *
 * @returns {string}
 */
export function getTodayJstIsoDate() {
  return getJstDateString(0);
}

/**
 * Returns calendar components and ISO keys for a JST date offset from today.
 *
 * @param {number} [offsetDays=0]
 * @returns {{
 *   year: number,
 *   month: number,
 *   day: number,
 *   monthPrefix: string,
 *   dateKey: string,
 *   dowIdx: number,
 * }}
 */
export function getJstParts(offsetDays = 0) {
  const jst = new Date(Date.now() + JST_OFFSET_MS + offsetDays * DAY_MS);
  const year = jst.getUTCFullYear();
  const month = jst.getUTCMonth() + 1;
  const day = jst.getUTCDate();

  return {
    year,
    month,
    day,
    dowIdx: jst.getUTCDay(),
    monthPrefix: `${year}-${String(month).padStart(2, '0')}`,
    dateKey: jst.toISOString().slice(0, 10),
  };
}

/**
 * Returns the current hour (`0`–`23`) in `Asia/Tokyo` (JST).
 *
 * @returns {number}
 */
export function getCurrentJstHour() {
  const jstHour = new Date(Date.now() + JST_OFFSET_MS).getUTCHours();
  return Number.isFinite(jstHour) ? jstHour : 0;
}

/**
 * Returns whether a slot on `dateKey` starting at `startHour` has already
 * started or passed relative to the current JST date and hour.
 *
 * @param {string} dateKey
 * @param {number} startHour
 * @param {string} todayDateKey
 * @param {number} currentJstHour
 * @returns {boolean}
 */
export function isSlotPastCurrentJst(
  dateKey,
  startHour,
  todayDateKey,
  currentJstHour
) {
  if (!dateKey) return true;
  if (dateKey < todayDateKey) return true;
  if (dateKey > todayDateKey) return false;

  const parsedStartHour = Number(startHour);
  if (!Number.isFinite(parsedStartHour)) return false;

  return parsedStartHour <= currentJstHour;
}

/**
 * Formats an ISO timestamp string into `MM/DD HH:mm` in JST.
 *
 * @param {string | null | undefined} isoString
 * @returns {string}
 */
export function formatJstTimestamp(isoString) {
  if (!isoString) return '';
  const d = new Date(new Date(isoString).getTime() + JST_OFFSET_MS);
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const min = String(d.getUTCMinutes()).padStart(2, '0');
  return `${mm}/${dd} ${hh}:${min}`;
}

/** Extracts the 2-digit hour integer from `"HH:00"` or `"HH:00-HH:00"`. */
export function parseHourValue(timeSlot) {
  return Number(String(timeSlot || '').slice(0, 2));
}

/** Formats an integer hour (`14`) as `"14:00"`. */
export function formatHourSlot(hourValue) {
  return `${String(hourValue).padStart(2, '0')}:00`;
}

/** Normalizes ISO timestamps or date strings to a `YYYY-MM-DD` key. */
export function normalizeSessionDateKey(rawDate) {
  const trimmed = String(rawDate || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  return trimmed.slice(0, 10);
}

/** Returns the earliest bookable hour (`12` for future dates, or `currentJstHour + 1` for today). */
export function getMinStartHourForDate(dateKey, todayKey, currentJstHour) {
  if (!dateKey || dateKey !== todayKey) return 12;
  return currentJstHour + 1;
}
