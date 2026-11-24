export const ALLOWED_START_HOURS = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
export const ALLOWED_HOURS_SET = new Set(ALLOWED_START_HOURS);

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