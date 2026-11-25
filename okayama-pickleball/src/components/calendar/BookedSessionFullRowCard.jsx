import React from 'react';
import { CalendarCheck, Check, Clock, MapPin, Share2 } from 'lucide-react';
import { TIME_BLOCKS } from '../../utils/scheduler';
import { formatHourSlot } from '../../utils/jst';
import { resolveBookingVenueLabel } from '../../services/schedulerRepository';
import { formatDayLabel } from './calendarUtils';

/**
 * Full-row confirmed-session card rendered inside the calendar table when a date
 * is booked. Uses `sticky left-2` + `viewportWidth` so the card stays centered and
 * readable even as the underlying table scrolls horizontally.
 */
export function BookedSessionFullRowCard({
  day,
  booking,
  attendees,
  pendingRsvpByDate,
  activeAttendeeName,
  viewingVote,
  viewportWidth,
  isJa,
  t,
  onToggleBookingAttendee,
  onInspectGoingTally,
  onShareBooking,
  onRequestClearBooking,
}) {
  const venueLabel = resolveBookingVenueLabel(booking, t.venueTbd);
  const yesAttendees = attendees.filter((row) => row.status !== 'maybe');
  const maybeAttendees = attendees.filter((row) => row.status === 'maybe');
  const viewedName = String(viewingVote?.name || '').trim();
  const pendingChoice = pendingRsvpByDate[day.dateKey];
  const isGoing = viewingVote
    ? yesAttendees.some((row) => row.attendeeName === viewedName)
    : pendingChoice !== undefined
      ? pendingChoice === 'yes'
      : Boolean(
          activeAttendeeName &&
            yesAttendees.some((row) => row.attendeeName === activeAttendeeName)
        );

  const timeRangeLabel =
    `${formatHourSlot(booking.startHour)}–${formatHourSlot(booking.endHour)}`;

  const badge = isGoing
    ? { symbol: '◯', cls: 'bg-emerald-600 text-white' }
    : {
        symbol: '◯',
        cls:
          'bg-white text-[#1B365D] border border-dashed border-[#1B365D]/40',
      };

  const innerBarWidthPx =
    viewportWidth > 0 ? Math.max(240, viewportWidth - 16) : null;

  return (
    <tr className="h-[96px] bg-emerald-50/85">
      <td
        colSpan={TIME_BLOCKS.length + 1}
        className="h-[96px] p-1.5 sm:p-2 align-middle text-left"
      >
        <div
          style={innerBarWidthPx ? { width: `${innerBarWidthPx}px` } : undefined}
          className={`sticky left-2 max-w-full h-full rounded-xl border-2 px-2.5 sm:px-3.5 py-1.5 shadow-2xs flex items-center justify-between gap-2 overflow-hidden transition ${
            isGoing
              ? 'bg-emerald-50/60 border-emerald-500'
              : 'bg-white border-emerald-400'
          }`}
        >
          <div className="min-w-0 flex-1 space-y-1 text-left">
            <div className="flex items-center gap-1.5 overflow-hidden">
              <span className="inline-flex items-center justify-center p-1 rounded bg-emerald-700 text-lime-300 shrink-0">
                <CalendarCheck className="w-3.5 h-3.5 shrink-0" />
              </span>
              <span
                translate={isJa ? undefined : 'no'}
                className="text-xs sm:text-sm font-extrabold text-slate-900 shrink-0 whitespace-nowrap tabular-nums"
              >
                {formatDayLabel(day, isJa)}
              </span>
              <span
                translate="no"
                className="inline-flex items-center gap-1 text-xs sm:text-sm font-extrabold text-[#1B365D] shrink-0 whitespace-nowrap tabular-nums"
              >
                <Clock className="w-3 h-3 text-emerald-700 shrink-0 hidden sm:inline" />
                <span>{timeRangeLabel}</span>
              </span>
            </div>

            <div className="flex items-center gap-2 text-[11px] sm:text-xs text-slate-700 overflow-hidden">
              <span className="inline-flex items-center gap-1 font-extrabold text-emerald-900 min-w-0 truncate">
                <MapPin className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <span className="truncate">{venueLabel}</span>
              </span>
              <button
                type="button"
                onClick={() =>
                  onInspectGoingTally({
                    day,
                    booking,
                    venueLabel,
                    timeRangeLabel,
                  })
                }
                className="tactile-press active:scale-[0.97] inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-100/90 hover:bg-emerald-200 text-emerald-950 text-[10px] sm:text-[11px] font-extrabold border border-emerald-300 shrink-0 whitespace-nowrap cursor-pointer tabular-nums"
              >
                <Check className="w-3 h-3 text-emerald-700 shrink-0" />
                <span>
                  {t.goingLabel}: ◯{yesAttendees.length}
                  {maybeAttendees.length > 0
                    ? ` / △${maybeAttendees.length}`
                    : ''}
                </span>
              </button>
            </div>
          </div>

          <div
            aria-hidden="true"
            className="hidden md:flex flex-col items-center gap-1 px-3 shrink-0 w-44 lg:w-56"
          >
            <div className="w-full grid grid-cols-10 gap-0.5">
              {TIME_BLOCKS.map((block) => {
                const inSpan =
                  block.startHour >= booking.startHour &&
                  block.startHour < booking.endHour;
                return (
                  <span
                    key={block.id}
                    className={`h-2 rounded-xs transition-colors ${
                      inSpan
                        ? 'bg-emerald-600'
                        : 'bg-slate-200/80'
                    }`}
                  />
                );
              })}
            </div>
            <span
              translate="no"
              className="text-[10px] font-bold text-emerald-800/80 tabular-nums"
            >
              {timeRangeLabel}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onShareBooking(booking)}
              className="tactile-press active:scale-[0.97] inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-lime-400 hover:bg-lime-300 text-[#1B365D] text-[10px] sm:text-[11px] font-extrabold border border-lime-500 cursor-pointer whitespace-nowrap"
            >
              <Share2 className="w-3 h-3 shrink-0" />
            </button>

            <button
              type="button"
              disabled={Boolean(viewingVote)}
              onClick={() => onToggleBookingAttendee(booking, isGoing)}
              className={`tactile-press inline-flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-extrabold border whitespace-nowrap ${
                viewingVote
                  ? isGoing
                    ? 'cursor-default bg-emerald-100/80 border-emerald-400 text-emerald-950'
                    : 'opacity-60 cursor-default bg-slate-100 border-slate-300 text-slate-500'
                  : isGoing
                    ? 'active:scale-[0.97] bg-emerald-100 hover:bg-emerald-200 border-emerald-400 text-emerald-950 cursor-pointer'
                    : 'active:scale-[0.97] bg-emerald-50 hover:bg-emerald-100 border-emerald-300 text-emerald-900 cursor-pointer'
              }`}
            >
              <span
                translate="no"
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full text-lg sm:text-xl font-extrabold inline-flex items-center justify-center shrink-0 ${badge.cls}`}
              >
                {badge.symbol}
              </span>
            </button>

            {!viewingVote && (
              <>
                <span
                  aria-hidden="true"
                  className="h-6 w-px bg-emerald-300/80 mx-0.5 shrink-0"
                />
                <button
                  type="button"
                  onClick={() =>
                    onRequestClearBooking({
                      dateKey: day.dateKey,
                      label: `${day.jpDate}(${day.dow})`,
                      venueLabel,
                    })
                  }
                  aria-label={t.unmarkBookingBtn}
                  className="tactile-press active:scale-[0.97] px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-rose-100 hover:text-rose-700 hover:border-rose-300 text-slate-600 text-[10px] sm:text-[11px] font-extrabold border border-slate-300 cursor-pointer whitespace-nowrap"
                >
                  {t.unmarkBookingBtn}
                </button>
              </>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}
