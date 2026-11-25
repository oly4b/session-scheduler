import React from 'react';
import { Award, ExternalLink, X } from 'lucide-react';

/**
 * Detail modal for a time slot or 2-hour block: shows ranked venue recommendations
 * (with direct booking links), an optional 2nd-choice 2h block swapper, and voter breakdown.
 */
export function SlotInspectModal({
  inspectSlot,
  onSelectSlot,
  onClose,
  viewingVote,
  t,
}) {
  if (!inspectSlot) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-4 py-3.5 bg-[#1B365D] text-white flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[11px] text-lime-300 font-bold">
              {t.modalTopTitle}
            </div>
            <h3 translate="no" className="font-extrabold text-sm sm:text-base">
              {inspectSlot.jpDate}({inspectSlot.dow}) {inspectSlot.timeLabel}
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

        <div className="p-4 space-y-3 text-xs max-h-[82vh] overflow-y-auto">
          {inspectSlot.alternativeTwoHourBlock && (
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/35 border border-indigo-200 dark:border-indigo-400/30 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[10px] font-extrabold text-indigo-700 dark:text-indigo-300">
                  {t.altSecondChoice}
                </div>
                <div
                  translate="no"
                  className="font-extrabold text-slate-900 dark:text-white truncate"
                >
                  {inspectSlot.alternativeTwoHourBlock.timeLabel} —{' '}
                  {
                    inspectSlot.alternativeTwoHourBlock.recommendedVenues[0]
                      ?.shortName
                  }
                </div>
                <div translate="no" className="text-[10px] text-slate-600 dark:text-slate-400">
                  2h◯ {inspectSlot.alternativeTwoHourBlock.bothYesCount} /{' '}
                  {inspectSlot.alternativeTwoHourBlock.totalVotes}
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  onSelectSlot({
                    ...inspectSlot.alternativeTwoHourBlock,
                    alternativeTwoHourBlock: {
                      ...inspectSlot,
                      alternativeTwoHourBlock: null,
                    },
                  })
                }
                className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-[11px] shrink-0 cursor-pointer whitespace-nowrap transition-transform duration-150 ease-out active:scale-[0.97]"
              >
                {t.seeDetailsBtn}
              </button>
            </div>
          )}

          <div className="p-3 rounded-xl bg-sky-50 dark:bg-slate-900/70 border border-sky-200 dark:border-white/10 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-extrabold text-[#1B365D] dark:text-white inline-flex items-center gap-1">
                <Award className="w-4 h-4 text-amber-500 shrink-0" />
                <span>
                  {t.recTopHeading(inspectSlot.recommendedVenues?.length || 0)}
                </span>
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                {t.openCountLabel(inspectSlot.openVenues?.length || 0)}
              </span>
            </div>

            {inspectSlot.recommendedVenues?.map((v, idx) => (
              <div
                key={v.id}
                className={`p-2 rounded-lg border flex items-center justify-between gap-2 ${
                  idx === 0
                    ? 'bg-white dark:bg-emerald-950/30 border-lime-400 dark:border-lime-400/60 shadow-2xs'
                    : 'bg-white/80 dark:bg-slate-800/70 border-slate-200 dark:border-white/10'
                }`}
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span
                      translate="no"
                      className={`w-4 h-4 rounded-full text-[10px] font-extrabold flex items-center justify-center shrink-0 ${
                        idx === 0
                          ? 'bg-[#1B365D] dark:bg-lime-400 text-lime-300 dark:text-slate-950'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold shrink-0 whitespace-nowrap ${
                        v.courtType === 'outdoor'
                          ? 'bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300'
                          : 'bg-sky-100 dark:bg-sky-500/15 text-sky-800 dark:text-sky-300'
                      }`}
                    >
                      {v.courtType === 'outdoor'
                        ? v.hasLights
                          ? t.outdoorLights
                          : t.outdoorShort
                        : t.indoorShort}
                    </span>
                    <span className="font-extrabold text-slate-900 dark:text-white truncate">
                      {v.fullName}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 pl-5 text-[10px]">
                    {v.continuousSpan && (
                      <span
                        translate="no"
                        className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 font-bold"
                      >
                        {v.continuousSpan}
                      </span>
                    )}
                    <span className="text-slate-500 dark:text-slate-400">
                      {t.distanceFromOkayama(v.distanceKm)}
                    </span>
                  </div>
                </div>

                <a
                  href={v.bookingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 px-2.5 py-1 rounded bg-[#1B365D] dark:bg-lime-400 text-lime-300 dark:text-slate-950 font-extrabold dark:font-semibold text-[11px] hover:bg-[#274b7d] dark:hover:bg-lime-300 no-underline shrink-0 whitespace-nowrap transition-transform duration-150 ease-out active:scale-[0.97]"
                >
                  <span>{t.bookLink}</span>
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              </div>
            ))}
          </div>

          {[
            {
              label: inspectSlot.isTwoHourBlock
                ? t.twoHourYesGroup(inspectSlot.yesPlayers.length)
                : t.oneHourYesGroup(inspectSlot.yesPlayers.length),
              players: inspectSlot.yesPlayers,
              titleClass: 'text-emerald-700 dark:text-emerald-400',
              badgeClass:
                'bg-emerald-100 dark:bg-emerald-500/15 dark:border dark:border-emerald-400/35 text-emerald-900 dark:text-emerald-200',
            },
            {
              label: inspectSlot.isTwoHourBlock
                ? t.twoHourMaybeGroup(inspectSlot.maybePlayers.length)
                : t.oneHourMaybeGroup(inspectSlot.maybePlayers.length),
              players: inspectSlot.maybePlayers,
              titleClass: 'text-amber-700 dark:text-amber-400',
              badgeClass:
                'bg-amber-100 dark:bg-amber-500/15 dark:border dark:border-amber-400/35 text-amber-900 dark:text-amber-200',
            },
            {
              label: t.noGroup(inspectSlot.noPlayers.length),
              players: inspectSlot.noPlayers,
              titleClass: 'text-rose-700 dark:text-rose-400',
              badgeClass:
                'bg-rose-100 dark:bg-rose-500/15 dark:border dark:border-rose-400/35 text-rose-900 dark:text-rose-200',
            },
          ].map((group) => (
            <div key={group.label}>
              <div className={`font-extrabold ${group.titleClass} mb-1`}>
                {group.label}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {!group.players.length ? (
                  <span className="text-slate-400 dark:text-slate-500">
                    {t.noneLabel}
                  </span>
                ) : (
                  group.players.map((p) => (
                    <span
                      key={p.id}
                      translate="no"
                      className={`px-2.5 py-1 rounded-full ${group.badgeClass} font-bold`}
                    >
                      {p.name}
                    </span>
                  ))
                )}
              </div>
            </div>
          ))}

          <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-200 dark:border-white/10">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {viewingVote ? t.modalViewingNote(viewingVote.name) : null}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-white/15 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-100 dark:hover:bg-slate-700/80 cursor-pointer ml-auto whitespace-nowrap transition-transform duration-150 ease-out active:scale-[0.97]"
            >
              {t.closeBtn}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
