import React from 'react';
import {
  CalendarCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Eye,
  Grid,
  Info,
  RotateCcw,
  X,
} from 'lucide-react';
import { TIME_BLOCKS } from '../../utils/scheduler';
import { BookedSessionFullRowCard } from './BookedSessionFullRowCard';
import { NoBookingsTodayRowCard } from './NoBookingsTodayRowCard';
import { DayVotingRow } from './DayVotingRow';

/**
 * Renders the 4-week selector, quick-fill/view-mode toolbar, legend, and
 * horizontally scrolling 1-hour availability/tally table shell.
 */
export function CalendarGrid({
  calendarSectionRef,
  tableScrollRef,
  tableViewportWidth,
  calendarWeeks,
  activeWeekIdx,
  setActiveWeekIdx,
  currentWeek,
  todayJstDateKey,
  bookedSessionsByDate,
  attendeesByDate,
  pendingRsvpByDate,
  trimmedVoterName,
  viewingVote,
  setViewingVote,
  editingVoteId,
  gridViewMode,
  setGridViewMode,
  activeVotes,
  dayWindowByDate,
  twoHourEligibleSlotKeys,
  twoHourHighlightMap,
  slotTallies,
  activeMap,
  isJa,
  t,
  onOpenBookingModal,
  onFillActiveWeekAll,
  onClearActiveWeek,
  onResetVoterForm,
  onSelectVoterToView,
  onSelectVoterToEdit,
  onToggleBookingAttendee,
  onInspectGoingTally,
  onShareBookingCard,
  onRequestClearBooking,
  onSelectDayWindow,
  onCycleSlot,
  onInspectSlot,
}) {
  return (
    <section
      ref={calendarSectionRef}
      className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-300 dark:border-slate-700 overflow-hidden"
    >
      <div className="bg-[#1B365D] px-3 py-2.5 flex flex-wrap items-center justify-between gap-2 text-white">
        <button
          type="button"
          disabled={activeWeekIdx === 0}
          onClick={() => setActiveWeekIdx((i) => Math.max(0, i - 1))}
          className="tactile-press active:scale-[0.97] inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#2B547E] hover:bg-[#366799] disabled:opacity-40 disabled:pointer-events-none text-xs font-extrabold border border-white/20 cursor-pointer whitespace-nowrap shrink-0"
        >
          <ChevronLeft className="w-4 h-4 shrink-0" />
        </button>

        <div className="text-center min-w-0">
          <div className="inline-block px-2.5 py-0.5 rounded-full bg-white/10 text-white/80 text-[11px] font-medium tracking-wide mb-0.5 whitespace-nowrap">
            {t.oneHourSubLabel}
          </div>
          <div
            translate={isJa ? undefined : 'no'}
            className="text-sm sm:text-base font-extrabold tracking-tight text-white tabular-nums"
          >
            {currentWeek.rangeLabel}
          </div>
        </div>

        <button
          type="button"
          disabled={activeWeekIdx === calendarWeeks.length - 1}
          onClick={() =>
            setActiveWeekIdx((i) => Math.min(calendarWeeks.length - 1, i + 1))
          }
          className="tactile-press active:scale-[0.97] inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#2B547E] hover:bg-[#366799] disabled:opacity-40 disabled:pointer-events-none text-xs font-extrabold border border-white/20 cursor-pointer whitespace-nowrap shrink-0"
        >
          <ChevronRight className="w-4 h-4 shrink-0" />
        </button>
      </div>

      <div className="bg-[#f4f6f9] dark:bg-slate-800/90 px-3 py-2.5 border-b border-slate-300 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {calendarWeeks.map((w, idx) => (
            <button
              key={w.id}
              type="button"
              onClick={() => setActiveWeekIdx(idx)}
              className={`tactile-press active:scale-[0.97] px-3 py-1.5 rounded-lg text-xs font-extrabold cursor-pointer border whitespace-nowrap tabular-nums ${
                activeWeekIdx === idx
                  ? 'bg-[#1B365D] text-lime-300 border-[#1B365D] dark:border-lime-400/50 shadow-xs'
                  : 'bg-white dark:bg-slate-900/70 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <span translate={isJa ? undefined : 'no'}>{w.shortTitle}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={onOpenBookingModal}
            className="tactile-press active:scale-[0.97] inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-lime-300 font-extrabold text-xs border border-emerald-900 cursor-pointer whitespace-nowrap"
          >
            <CalendarCheck className="w-3.5 h-3.5 shrink-0" />
            <span>{t.bookSessionBtn}</span>
          </button>
          <button
            type="button"
            onClick={onFillActiveWeekAll}
            className="tactile-press active:scale-[0.97] px-2.5 py-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/70 hover:bg-emerald-200 dark:hover:bg-emerald-900 text-emerald-900 dark:text-emerald-200 font-extrabold text-xs border border-emerald-300 dark:border-emerald-700 cursor-pointer whitespace-nowrap"
          >
            {t.weekFillAll}
          </button>
          <button
            type="button"
            onClick={onClearActiveWeek}
            className="tactile-press active:scale-[0.97] px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-extrabold text-xs border border-slate-300 dark:border-slate-600 cursor-pointer whitespace-nowrap"
          >
            {t.weekClearAll}
          </button>

          <div className="relative grid grid-cols-2 rounded-xl bg-slate-200 dark:bg-slate-900/70 p-0.5 border border-slate-300 dark:border-white/10 ml-1 overflow-hidden">
            <span
              aria-hidden="true"
              className={`segmented-thumb pointer-events-none absolute top-0.5 bottom-0.5 left-0.5 w-[calc(50%-2px)] rounded-lg shadow-xs ${
                viewingVote
                  ? 'opacity-0'
                  : gridViewMode === 'heatmap'
                    ? 'translate-x-full bg-[#1B365D]'
                    : 'translate-x-0 bg-white dark:bg-slate-700'
              }`}
            />
            <button
              type="button"
              onClick={() => {
                setViewingVote(null);
                setGridViewMode('vote');
              }}
              className={`relative z-10 tactile-press active:scale-[0.97] inline-flex items-center justify-center gap-1 px-3 py-1 rounded-lg text-xs font-extrabold cursor-pointer whitespace-nowrap transition-colors ${
                gridViewMode === 'vote' && !viewingVote
                  ? 'text-[#1B365D] dark:text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Grid className="w-3.5 h-3.5 shrink-0" />
              <span>{t.myVoteTab(null)}</span>
            </button>
            <button
              type="button"
              title={t.legendHint}
              onClick={() => {
                setViewingVote(null);
                setGridViewMode('heatmap');
              }}
              className={`relative z-10 tactile-press active:scale-[0.97] inline-flex items-center justify-center gap-1 px-3 py-1 rounded-lg text-xs font-extrabold cursor-pointer whitespace-nowrap transition-colors ${
                gridViewMode === 'heatmap' && !viewingVote
                  ? 'text-lime-300'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Eye className="w-3.5 h-3.5 shrink-0" />
              <span>{t.tallyTab}</span>
            </button>
          </div>

          {viewingVote ? (
            <div className="inline-flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onSelectVoterToEdit(viewingVote)}
                className="tactile-press active:scale-[0.97] inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold border border-amber-500 shadow-xs cursor-pointer whitespace-nowrap"
              >
                <Edit3 className="w-3.5 h-3.5 shrink-0" />
                <span>{t.editThisBtn}</span>
              </button>
              <button
                type="button"
                onClick={() => setViewingVote(null)}
                className="tactile-press active:scale-[0.97] inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-xs font-extrabold border border-sky-900 shadow-xs cursor-pointer whitespace-nowrap"
              >
                <X className="w-3.5 h-3.5 shrink-0" />
                <span>{t.exitViewBtn}</span>
              </button>
            </div>
          ) : editingVoteId ? (
            <button
              type="button"
              onClick={onResetVoterForm}
              className="tactile-press active:scale-[0.97] inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-800 text-xs font-extrabold border border-slate-300 shadow-xs cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5 shrink-0" />
              <span>{t.cancelBtn}</span>
            </button>
          ) : (
            <div className="relative">
              <select
                aria-label="Select player response to view"
                disabled={!activeVotes.length}
                value=""
                onChange={(e) => {
                  const chosen = activeVotes.find(
                    (v) => String(v.id) === e.target.value
                  );
                  if (chosen) onSelectVoterToView(chosen);
                }}
                className="appearance-none px-3 py-1.5 pr-8 rounded-lg bg-white dark:bg-slate-900 disabled:opacity-50 border border-slate-300 dark:border-slate-600 text-xs font-extrabold text-[#1B365D] dark:text-slate-100 focus:border-[#1B365D] dark:focus:border-lime-400 outline-none cursor-pointer max-w-[200px]"
              >
                <option value="">
                  {activeVotes.length ? t.viewPlayerPlaceholder : t.noVotesYet}
                </option>
                {activeVotes.map((v) => (
                  <option key={v.id} value={String(v.id)}>
                    {v.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
            </div>
          )}
        </div>
      </div>

      <div className="px-3.5 py-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-slate-300">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
            <span
              translate="no"
              className="w-4 h-4 rounded-full bg-emerald-100 dark:bg-emerald-950 border border-emerald-400 dark:border-emerald-600 inline-flex items-center justify-center text-[10px] shrink-0"
            >
              ◯
            </span>
            <span>{t.legendYes}</span>
          </span>
          <span className="inline-flex items-center gap-1 font-bold text-amber-700 dark:text-amber-400 whitespace-nowrap">
            <span
              translate="no"
              className="w-4 h-4 rounded-full bg-amber-100 dark:bg-amber-950 border border-amber-400 dark:border-amber-600 inline-flex items-center justify-center text-[10px] shrink-0"
            >
              △
            </span>
            <span>{t.legendMaybe}</span>
          </span>
          <span className="inline-flex items-center gap-1 font-bold text-rose-700 dark:text-rose-400 whitespace-nowrap">
            <span
              translate="no"
              className="w-4 h-4 rounded-full bg-rose-100 dark:bg-rose-950 border border-rose-400 dark:border-rose-600 inline-flex items-center justify-center text-[10px] shrink-0"
            >
              ✕
            </span>
            <span>{t.legendNo}</span>
          </span>
          <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400 whitespace-nowrap">
            <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-[10px]">
              {t.legendFull}
            </span>
            <span>{t.legendFullDesc}</span>
          </span>
          <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300 whitespace-nowrap">
            <span className="px-1.5 py-0.5 rounded bg-slate-300/80 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-[10px]">
              {t.legendNo2h}
            </span>
            <span>{t.legendNo2hDesc}</span>
          </span>
          <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400 whitespace-nowrap">
            <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 font-bold text-[10px]">
              {t.legendClosed}
            </span>
            <span>{t.legendClosedDesc}</span>
          </span>
          <span className="inline-flex items-center gap-1 font-bold text-indigo-800 dark:text-indigo-300 whitespace-nowrap">
            <span className="w-3.5 h-3.5 rounded bg-indigo-50 dark:bg-indigo-950 border-2 border-indigo-400 inline-block shrink-0" />
            <span>{t.legendRec2h}</span>
          </span>
          <span className="inline-flex items-center gap-1 text-amber-800 dark:text-amber-300 font-bold whitespace-nowrap">
            <span className="w-3.5 h-3.5 rounded bg-amber-100 dark:bg-amber-950 border border-amber-400 dark:border-amber-600 inline-block shrink-0" />
            <span>{t.legendPrime}</span>
          </span>
        </div>
        {gridViewMode === 'heatmap' && !viewingVote && (
          <span className="font-bold text-[#1B365D] dark:text-lime-300 inline-flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>{t.legendHint}</span>
          </span>
        )}
      </div>

      <div ref={tableScrollRef} className="overflow-x-auto">
        <table className="w-full border-collapse text-center">
          <thead>
            <tr className="bg-[#eef3f8] dark:bg-slate-800 border-b-2 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100">
              {/* Sticky column z-index hierarchy:
                  z-30 sticky header > z-20 opaque date cells > z-10 interactive buttons
                  > z-[6] 2h capsule cell-hover > z-[5] 2h spanning capsule */}
              <th className="sticky left-0 z-30 bg-[#dce5f0] dark:bg-slate-800 py-2.5 px-2 min-w-[116px] sm:min-w-[140px] text-left text-xs font-extrabold text-[#1B365D] dark:text-slate-100 border-r border-slate-300 dark:border-slate-700 shadow-[4px_0_8px_-4px_rgba(15,23,42,0.08)] whitespace-nowrap">
                {t.dateColHeader}
              </th>
              {TIME_BLOCKS.map((block) => (
                <th
                  key={block.id}
                  title={block.label}
                  className={`py-2.5 px-1 min-w-[54px] sm:min-w-[78px] border-r border-slate-300 dark:border-slate-700 last:border-r-0 transition ${
                    block.isStudentPrime
                      ? 'bg-amber-100/90 dark:bg-amber-400/[0.06] border-b-2 border-b-amber-400 dark:border-b-amber-400/60'
                      : ''
                  }`}
                >
                  <div
                    translate="no"
                    className="text-[11px] sm:text-xs font-extrabold text-[#1B365D] dark:text-slate-100 tracking-tight whitespace-nowrap tabular-nums"
                  >
                    {block.shortLabel}~
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-300 dark:divide-slate-700">
            {currentWeek.days.map((day) => {
              const bookedEntry = bookedSessionsByDate[day.dateKey];
              if (bookedEntry) {
                return (
                  <BookedSessionFullRowCard
                    key={day.dateKey}
                    day={day}
                    booking={bookedEntry}
                    attendees={attendeesByDate[day.dateKey] || []}
                    pendingRsvpByDate={pendingRsvpByDate}
                    activeAttendeeName={trimmedVoterName}
                    viewingVote={viewingVote}
                    viewportWidth={tableViewportWidth}
                    isJa={isJa}
                    t={t}
                    onToggleBookingAttendee={onToggleBookingAttendee}
                    onInspectGoingTally={onInspectGoingTally}
                    onShareBooking={onShareBookingCard}
                    onRequestClearBooking={onRequestClearBooking}
                  />
                );
              }

              // Block out the current JST date when unbooked using the same
              // full-row sticky geometry as a confirmed session card.
              if (day.dateKey === todayJstDateKey) {
                return (
                  <NoBookingsTodayRowCard
                    key={day.dateKey}
                    day={day}
                    colSpan={TIME_BLOCKS.length + 1}
                    viewportWidth={tableViewportWidth}
                    isJa={isJa}
                    labelText={t.noBookingsTodayLabel}
                  />
                );
              }

              return (
                <DayVotingRow
                  key={day.dateKey}
                  day={day}
                  dayWindowByDate={dayWindowByDate}
                  twoHourEligibleSlotKeys={twoHourEligibleSlotKeys}
                  twoHourHighlightMap={twoHourHighlightMap}
                  slotTallies={slotTallies}
                  activeMap={activeMap}
                  gridViewMode={gridViewMode}
                  viewingVote={viewingVote}
                  isJa={isJa}
                  t={t}
                  onSelectDayWindow={onSelectDayWindow}
                  onCycleSlot={onCycleSlot}
                  onInspectSlot={onInspectSlot}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
