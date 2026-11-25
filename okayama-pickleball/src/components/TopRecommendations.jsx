import React from 'react';
import { Trophy } from 'lucide-react';
import { formatDayLabel } from './calendar/calendarUtils';

/**
 * Displays the top 5 ranked 2-hour continuous blocks across unbooked dates
 * (`>= 3` votes) with recommended venue, sweet-spot/double-court badges, and
 * click-to-inspect details.
 */
export function TopRecommendations({
  loadingVotes,
  rankedTwoHourBlocks,
  isJa,
  t,
  onInspectSlot,
}) {
  return (
    <section className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="px-4 py-3 bg-[#1B365D] text-white flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Trophy className="w-4 h-4 text-lime-300 shrink-0" />
          <h2 className="font-extrabold text-xs sm:text-sm">{t.top5Title}</h2>
        </div>
        <span className="text-[11px] text-sky-200 whitespace-nowrap shrink-0">
          {t.top5Subtitle}
        </span>
      </div>

      <div className="p-3.5 space-y-2">
        {loadingVotes ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center">
            {t.loadingVotes}
          </p>
        ) : !rankedTwoHourBlocks.length ? (
          <div className="text-center py-6 text-xs text-slate-500 dark:text-slate-400 space-y-1">
            <p className="font-bold text-slate-700 dark:text-slate-200">
              {t.noRankedBlocksTitle}
            </p>
            <p>{t.noRankedBlocksDesc}</p>
          </div>
        ) : (
          rankedTwoHourBlocks.map((block, index) => {
            const extraParts = [
              block.openVenues.length > 1
                ? t.moreVenues(block.openVenues.length - 1).replace(/^\+/, '')
                : '',
              block.alternativeTwoHourBlock
                ? isJa
                  ? '別時間帯あり'
                  : 'Alt time'
                : '',
            ].filter(Boolean);

            return (
              <div
                key={block.dateKey}
                onClick={() => onInspectSlot(block)}
                className={`tactile-press active:scale-[0.99] p-3 rounded-xl border flex flex-wrap items-center justify-between gap-2 cursor-pointer ${
                  index === 0
                    ? 'bg-emerald-50/70 dark:bg-emerald-950/35 hover-surface-emerald border-emerald-400 dark:border-emerald-600'
                    : 'bg-slate-50 dark:bg-slate-800/75 hover-surface-slate border-slate-200 dark:border-slate-700'
                }`}
              >
                <div className="flex items-start sm:items-center gap-2.5 flex-1 min-w-0">
                  <span
                    translate="no"
                    className={`w-6 h-6 rounded-full text-xs font-extrabold flex items-center justify-center shrink-0 mt-0.5 sm:mt-0 tabular-nums ${
                      index === 0
                        ? 'bg-[#1B365D] text-lime-300'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-slate-100 leading-snug tabular-nums">
                      <span translate="no">
                        {formatDayLabel(block, isJa)}
                        {block.holiday && isJa ? `・${block.holiday}` : ''}
                      </span>{' '}
                      <span
                        translate="no"
                        className="text-[#1B365D] dark:text-lime-300 whitespace-nowrap"
                      >
                        {block.timeLabel}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-300 flex flex-wrap items-center gap-1.5 mt-1">
                      <span
                        translate="no"
                        className="font-bold text-[#1B365D] dark:text-slate-300"
                      >
                        {t.firstChoice(block.recommendedVenues[0]?.shortName)}
                      </span>
                      {extraParts.length > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-200/75 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-semibold text-[10px] whitespace-nowrap tabular-nums">
                          {extraParts.join('・')}
                        </span>
                      )}
                      {block.isSweetSpot && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-200/75 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-[10px] whitespace-nowrap tabular-nums">
                          {t.sweetSpotBadge}
                        </span>
                      )}
                      {block.isDoubleCourt && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-200/75 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-[10px] whitespace-nowrap tabular-nums">
                          {t.doubleCourtBadge}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 tabular-nums">
                  <span
                    translate="no"
                    className="px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-500/15 text-emerald-900 dark:text-emerald-300 font-extrabold text-xs border border-emerald-300 dark:border-emerald-400/40 whitespace-nowrap"
                  >
                    {t.twoHourYesPill(block.bothYesCount)}
                  </span>
                  {block.flexBothCount + block.partialYesCount > 0 && (
                    <span
                      translate="no"
                      className="px-2 py-1 rounded-lg bg-amber-100 dark:bg-amber-500/15 text-amber-900 dark:text-amber-300 font-bold text-xs border border-amber-300 dark:border-amber-400/40 whitespace-nowrap"
                    >
                      {t.flexPill(block.flexBothCount + block.partialYesCount)}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
