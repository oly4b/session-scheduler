import React from 'react';
import { TIME_BLOCKS } from '../../utils/scheduler';
import { SlotChoiceCircle } from './SlotChoiceCircle';
import { formatDayLabel } from './calendarUtils';

/**
 * Renders a single unbooked day row in the calendar table, including the sticky
 * `Date / Day` column (with `終日` / `昼のみ` / `夜のみ` quick-select presets)
 * and all 1-hour slot cells (closed, booked-out, 2h-ineligible, or interactive
 * Vote / Group Tally cells with Top 2h Block spanning capsules).
 */
export function DayVotingRow({
  day,
  dayWindowByDate,
  twoHourEligibleSlotKeys,
  twoHourHighlightMap,
  slotTallies,
  activeMap,
  gridViewMode,
  viewingVote,
  isJa,
  t,
  onSelectDayWindow,
  onCycleSlot,
  onInspectSlot,
}) {
  const dateTextColor =
    day.dayType === 'saturday'
      ? 'text-blue-700'
      : day.dayType === 'sunday' || day.dayType === 'holiday'
        ? 'text-red-600'
        : 'text-slate-900';
  const dateBgColor =
    day.dayType === 'saturday'
      ? 'bg-[#EFF5FF]'
      : day.dayType === 'sunday' || day.dayType === 'holiday'
        ? 'bg-[#FFF5F5]'
        : 'bg-white';
  const activeWindowMode = dayWindowByDate[day.dateKey] || null;
  const isFullyClosedDay =
    day.allBooked &&
    TIME_BLOCKS.every(
      (b) => !day.slots[b.id]?.isOpen && !day.slots[b.id]?.isFullyBooked
    );

  const dayLabel = formatDayLabel(day, isJa);

  return (
    <tr className="h-[96px] divide-x divide-slate-200">
      <td
        className={`sticky left-0 z-20 ${dateBgColor} h-[96px] px-2 py-1.5 text-left border-r border-slate-200 shadow-[4px_0_8px_-4px_rgba(15,23,42,0.08)] align-middle`}
      >
        <div className="flex items-center gap-1 flex-wrap">
          <span
            translate={isJa ? undefined : 'no'}
            className={`text-sm sm:text-base font-extrabold underline decoration-slate-300 whitespace-nowrap tabular-nums ${dateTextColor}`}
          >
            {dayLabel}
          </span>
          {day.holiday && (
            <span
              translate="no"
              className="inline-flex items-center justify-center w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-red-600 text-white text-[10px] sm:text-[11px] font-extrabold shrink-0"
            >
              {day.holiday}
            </span>
          )}
        </div>
        {day.allBooked ? (
          <span className="inline-block mt-0.5 text-[10px] font-bold text-slate-400 leading-tight">
            {isFullyClosedDay ? t.legendClosed : t.allBookedDay}
          </span>
        ) : (
          <div
            role="group"
            aria-label={`${dayLabel} ${t.dateColHeader}`}
            className="mt-1 inline-flex rounded-lg bg-white/95 border border-slate-300 divide-x divide-slate-300 text-[10px] font-extrabold overflow-hidden"
          >
            {[
              { id: 'all', label: t.dayAllFree },
              { id: 'afternoon', label: t.dayAfternoonOnly },
              { id: 'evening', label: t.dayEveningOnly },
            ].map((opt) => {
              const hasEligible = TIME_BLOCKS.some((b) => {
                const key = `${day.dateKey}_${b.id}`;
                if (!twoHourEligibleSlotKeys.has(key)) return false;
                if (opt.id === 'afternoon') return b.startHour < 18;
                if (opt.id === 'evening') return b.startHour >= 18;
                return true;
              });
              const isDisabled = Boolean(viewingVote) || !hasEligible;

              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => onSelectDayWindow(day, opt.id)}
                  className={`tactile-press px-2 py-1 whitespace-nowrap ${
                    isDisabled
                      ? 'opacity-35 cursor-not-allowed'
                      : 'active:scale-[0.97] hover-surface-slate cursor-pointer'
                  } ${
                    activeWindowMode === opt.id
                      ? 'bg-[#1B365D] text-lime-300'
                      : 'text-slate-600'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        )}
      </td>

      {isFullyClosedDay ? (
        <td
          colSpan={TIME_BLOCKS.length}
          title={t.closedTitle}
          className="h-[96px] bg-slate-100/75 px-4 align-middle text-left select-none cursor-not-allowed"
        >
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400">
            <span translate="no">—</span>
            <span>{t.closedDayRow}</span>
          </div>
        </td>
      ) : (
        TIME_BLOCKS.map((block) => {
          const cellData = day.slots[block.id];

          if (!cellData?.isOpen) {
            const isBooked = Boolean(cellData?.isFullyBooked);
            return (
              <td
                key={block.id}
                title={isBooked ? t.bookedTitle : t.closedTitle}
                className={`${
                  isBooked ? 'bg-slate-100/75' : 'bg-slate-100/90'
                } h-[96px] px-0.5 align-middle select-none cursor-not-allowed`}
              >
                <div className="h-full flex flex-col items-center justify-center gap-0.5 max-w-[74px] mx-auto leading-tight text-slate-400">
                  <span
                    translate="no"
                    className="text-xs font-extrabold leading-none"
                  >
                    {isBooked ? '✕' : '—'}
                  </span>
                  <span
                    className={`text-[10px] text-center break-words line-clamp-2 ${
                      isBooked ? 'font-semibold' : 'font-medium'
                    }`}
                  >
                    {isBooked ? t.legendFull : t.legendClosed}
                  </span>
                </div>
              </td>
            );
          }

          const slotKey = `${day.dateKey}_${block.id}`;

          if (!twoHourEligibleSlotKeys.has(slotKey)) {
            return (
              <td
                key={block.id}
                onClick={() => onCycleSlot(slotKey)}
                title={t.no2hTitle}
                className="bg-slate-200/70 h-[96px] px-0.5 align-middle select-none cursor-not-allowed"
              >
                <div className="h-full flex flex-col items-center justify-center gap-0.5 text-slate-500 max-w-[74px] mx-auto leading-tight">
                  <span
                    translate="no"
                    className="text-xs font-extrabold leading-none"
                  >
                    —
                  </span>
                  <span className="text-[10px] font-bold text-center break-words line-clamp-2">
                    {t.legendNo2h}
                  </span>
                </div>
              </td>
            );
          }

          const activeChoice = activeMap[slotKey];
          const twoHourInfo = twoHourHighlightMap[slotKey];
          const tally = slotTallies[slotKey] || {
            yesCount: 0,
            maybeCount: 0,
            noCount: 0,
            isTopPick: false,
          };
          const showTallyDetails = gridViewMode === 'heatmap' && !viewingVote;

          const isPrioritySpan = Boolean(twoHourInfo?.isPriorityTwoHour);
          const isPriorityCapsule =
            isPrioritySpan && !(showTallyDetails && tally.isTopPick);
          const isPriorityStart =
            isPriorityCapsule && twoHourInfo.priorityPosition === 'start';

          // Omit <td> background on Top 2h capsule cells so both halves
          // share the uniform z-[5] spanning capsule fill without splitting.
          let cellBg = isPriorityCapsule
            ? ''
            : block.isStudentPrime
              ? 'bg-amber-50/45 [--slot-hover-bg:rgb(254_243_199_/_0.8)]'
              : 'bg-white [--slot-hover-bg:rgb(240_249_255)]';

          if (!isPriorityCapsule && showTallyDetails) {
            if (tally.yesCount >= 6) {
              cellBg = 'bg-emerald-200/90 [--slot-hover-bg:rgb(167_243_208)]';
            } else if (tally.yesCount >= 3) {
              cellBg = 'bg-emerald-100/80 [--slot-hover-bg:rgb(209_250_229)]';
            } else if (tally.yesCount >= 1) {
              cellBg = 'bg-lime-50 [--slot-hover-bg:rgb(236_252_203)]';
            } else {
              cellBg = 'bg-slate-50/70 [--slot-hover-bg:rgb(241_245_249)]';
            }
          } else if (!isPriorityCapsule && activeChoice === 'yes') {
            cellBg = 'bg-emerald-50/90 [--slot-hover-bg:rgb(209_250_229_/_0.8)]';
          } else if (!isPriorityCapsule && activeChoice === 'maybe') {
            cellBg = 'bg-amber-50/90 [--slot-hover-bg:rgb(254_243_199_/_0.8)]';
          } else if (!isPriorityCapsule && activeChoice === 'no') {
            cellBg = 'bg-rose-50/80 [--slot-hover-bg:rgb(255_228_230_/_0.7)]';
          }

          const topPickRing =
            showTallyDetails && tally.isTopPick
              ? 'ring-2 ring-inset ring-amber-400'
              : '';

          return (
            <td
              key={block.id}
              className={`relative p-1 h-[96px] align-middle transition-colors ${
                isPriorityCapsule ? 'priority-cell' : 'slot-cell-hover'
              } ${cellBg} ${topPickRing}`}
            >
              {isPriorityStart && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute top-[3px] bottom-[3px] left-[3px] w-[calc(200%-6px)] rounded-lg border-[1.5px] border-indigo-400/90 bg-indigo-500/[0.06] z-[5]"
                />
              )}
              {isPriorityCapsule && (
                <div
                  aria-hidden="true"
                  className={`priority-cell-hover-layer pointer-events-none absolute top-[3px] bottom-[3px] z-[6] transition-colors duration-150 ease-out ${
                    twoHourInfo.priorityPosition === 'start'
                      ? 'left-[3px] right-0 rounded-l-lg'
                      : 'left-0 right-[3px] rounded-r-lg'
                  }`}
                />
              )}
              <div
                className={`relative z-10 h-full w-full flex flex-col items-center justify-center gap-1 ${
                  showTallyDetails ? 'px-1.5 py-2' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => onCycleSlot(slotKey)}
                  className={`tactile-press w-full max-w-full px-0.5 rounded-xl flex items-center justify-center ${
                    showTallyDetails
                      ? 'flex-1 min-h-0'
                      : 'h-full min-h-[34px] sm:min-h-[38px]'
                  } ${
                    viewingVote
                      ? 'cursor-default'
                      : 'active:scale-[0.97] cursor-pointer'
                  }`}
                  title={
                    viewingVote
                      ? t.viewingCellTitle(viewingVote.name)
                      : `${dayLabel} ${block.label} · ${cellData.summaryText}`
                  }
                >
                  {showTallyDetails ? (
                    <div
                      translate="no"
                      className="flex flex-col items-center justify-center leading-tight whitespace-nowrap tabular-nums"
                    >
                      <div
                        className={`text-xs sm:text-sm tabular-nums ${
                          tally.yesCount >= 1
                            ? 'font-semibold text-[#1B365D]'
                            : 'opacity-30 font-normal text-slate-500'
                        }`}
                      >
                        ◯ {tally.yesCount}
                      </div>
                      <div
                        className={`text-xs sm:text-sm tabular-nums ${
                          tally.maybeCount >= 1
                            ? 'font-semibold text-amber-700'
                            : 'opacity-30 font-normal text-slate-500'
                        }`}
                      >
                        △ {tally.maybeCount}
                      </div>
                    </div>
                  ) : (
                    <span
                      translate="no"
                      className="w-full h-full flex items-center justify-center"
                    >
                      <SlotChoiceCircle
                        choice={activeChoice}
                        isViewing={Boolean(viewingVote)}
                      />
                    </span>
                  )}
                </button>

                {showTallyDetails && (
                  <button
                    type="button"
                    onClick={() => onInspectSlot(tally)}
                    className="relative z-10 tactile-press active:scale-[0.97] w-full py-0.5 px-1.5 rounded-md bg-white/85 hover:bg-[#1B365D] hover:text-white text-[10px] sm:text-[11px] font-bold text-slate-600 flex items-center justify-center gap-1 border border-slate-200/90 cursor-pointer whitespace-nowrap"
                    title={cellData.summaryText}
                  >
                    <span>{t.detailsLabel}</span>
                  </button>
                )}
              </div>
            </td>
          );
        })
      )}
    </tr>
  );
}
