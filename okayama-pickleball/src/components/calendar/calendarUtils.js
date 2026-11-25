/**
 * Formats a day object into a localized date label (`"4月2日(水)"` or `"Apr 2 (Wed)"`).
 *
 * @param {{ jpDate: string, dow: string, enDate?: string, enDow?: string } | null | undefined} day
 * @param {boolean} isJa
 * @returns {string}
 */
export function formatDayLabel(day, isJa) {
  if (!day) return '';
  if (isJa) return `${day.jpDate}(${day.dow})`;
  return day.enDate && day.enDow
    ? `${day.enDate} (${day.enDow})`
    : `${day.jpDate}(${day.dow})`;
}
