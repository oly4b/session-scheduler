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
 * passed or started relative to the current JST date and hour.
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

  return Number(startHour) <= currentJstHour;
}