import React from 'react';
import { X } from 'lucide-react';

/**
 * Displays the attendee roster (`◯` Going and `△` Maybe chips) for a confirmed
 * booked session when clicking its `Going: ◯N` pill.
 */
export function GoingTallyModal({
  session,
  yesList,
  maybeList,
  onClose,
  t,
}) {
  if (!session) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-4 py-3.5 bg-emerald-900 text-white flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[11px] text-lime-300 font-bold">
              {t.goingTallyModalTitle}
            </div>
            <h3
              translate="no"
              className="font-extrabold text-sm sm:text-base truncate"
            >
              {session.day.jpDate}({session.day.dow}) {session.timeRangeLabel}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/15 text-slate-200 cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3 text-xs max-h-[80vh] overflow-y-auto">
          <div className="flex items-center justify-between gap-2 text-slate-700 dark:text-slate-200 font-bold">
            <span className="truncate">{session.venueLabel}</span>
            <span
              translate="no"
              className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-500/15 dark:border dark:border-emerald-400/35 text-emerald-900 dark:text-emerald-200 font-extrabold shrink-0"
            >
              {t.goingCountSummary(yesList.length, maybeList.length)}
            </span>
          </div>

          {!yesList.length && !maybeList.length ? (
            <p className="text-slate-500 dark:text-slate-400 py-3 text-center">
              {t.noGoingAttendees}
            </p>
          ) : (
            <div className="space-y-2.5">
              <div>
                <div className="font-extrabold text-emerald-800 dark:text-emerald-400 mb-1">
                  ◯ {t.goingLabel} ({yesList.length})
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {!yesList.length ? (
                    <span className="text-slate-400 dark:text-slate-500">
                      {t.noneLabel}
                    </span>
                  ) : (
                    yesList.map((row) => (
                      <span
                        key={row.attendeeName}
                        translate="no"
                        className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-500/15 dark:border dark:border-emerald-400/35 text-emerald-950 dark:text-emerald-200 font-bold"
                      >
                        {row.attendeeName}
                      </span>
                    ))
                  )}
                </div>
              </div>

              {maybeList.length > 0 && (
                <div>
                  <div className="font-extrabold text-amber-800 dark:text-amber-400 mb-1">
                    △ ({maybeList.length})
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {maybeList.map((row) => (
                      <span
                        key={row.attendeeName}
                        translate="no"
                        className="px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-500/15 dark:border dark:border-amber-400/35 text-amber-950 dark:text-amber-200 font-bold"
                      >
                        {row.attendeeName}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="pt-2 flex justify-end border-t border-slate-200 dark:border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-white/15 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-100 dark:hover:bg-slate-700/80 cursor-pointer whitespace-nowrap transition-transform duration-150 ease-out active:scale-[0.97]"
            >
              {t.closeBtn}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
