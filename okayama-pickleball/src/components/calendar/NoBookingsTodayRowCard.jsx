import React from 'react';
import { formatDayLabel } from './calendarUtils';

/**
 * Full-width sticky row shown for the current JST date when no session is booked,
 * preventing same-day voting while keeping the row aligned with the horizontal scroll viewport.
 */
export function NoBookingsTodayRowCard({
  day,
  colSpan,
  viewportWidth,
  isJa,
  labelText,
}) {
  const innerBarWidthPx =
    viewportWidth > 0 ? Math.max(240, viewportWidth - 16) : null;
  const todayBadgeText = isJa ? '本日' : 'TODAY';

  return (
    <tr className="h-[96px] bg-slate-100/85 dark:bg-slate-900/80 select-none">
      <td
        colSpan={colSpan}
        className="h-[96px] p-1.5 sm:p-2 align-middle text-left"
      >
        <div
          style={innerBarWidthPx ? { width: `${innerBarWidthPx}px` } : undefined}
          className="sticky left-2 max-w-full h-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/95 dark:bg-slate-800/95 px-3 sm:px-4 py-1.5 flex items-center justify-between gap-3 overflow-hidden text-slate-700 dark:text-slate-200"
        >
          <div className="flex items-center gap-2.5 shrink-0">
            <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-[#1B365D] text-lime-300 text-xs sm:text-sm font-extrabold whitespace-nowrap">
              {todayBadgeText}
            </span>
            <span
              translate={isJa ? undefined : 'no'}
              className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100 whitespace-nowrap tabular-nums"
            >
              {formatDayLabel(day, isJa)}
            </span>
          </div>
          <span className="text-sm sm:text-base font-extrabold text-slate-700 dark:text-slate-300 truncate">
            {labelText}
          </span>
        </div>
      </td>
    </tr>
  );
}
