import React from 'react';
import { Award, ExternalLink, X } from 'lucide-react';

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
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
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
            <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[10px] font-extrabold text-indigo-700">
                  {t.altSecondChoice}
                </div>
                <div
                  translate="no"
                  className="font-extrabold text-slate-900 truncate"
                >
                  {inspectSlot.alternativeTwoHourBlock.timeLabel} —{' '}
                  {
                    inspectSlot.alternativeTwoHourBlock.recommendedVenues[0]
                      ?.shortName
                  }
                </div>
                <div translate="no" className="text-[10px] text-slate-600">
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
                className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-[11px] shrink-0 cursor-pointer whitespace-nowrap"
              >
                {t.seeDetailsBtn}
              </button>
            </div>
          )}

          <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-extrabold text-[#1B365D] inline-flex items-center gap-1">
                <Award className="w-4 h-4 text-amber-500 shrink-0" />
                <span>
                  {t.recTopHeading(inspectSlot.recommendedVenues?.length || 0)}
                </span>
              </span>
              <span className="text-[10px] text-slate-500 whitespace-nowrap">
                {t.openCountLabel(inspectSlot.openVenues?.length || 0)}
              </span>
            </div>

            {inspectSlot.recommendedVenues?.map((v, idx) => (
              <div
                key={v.id}
                className={`p-2 rounded-lg border flex items-center justify-between gap-2 ${
                  idx === 0
                    ? 'bg-white border-lime-400 shadow-2xs'
                    : 'bg-white/80 border-slate-200'
                }`}
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span
                      translate="no"
                      className={`w-4 h-4 rounded-full text-[10px] font-extrabold flex items-center justify-center shrink-0 ${
                        idx === 0
                          ? 'bg-[#1B365D] text-lime-300'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold shrink-0 whitespace-nowrap ${
                        v.courtType === 'outdoor'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-sky-100 text-sky-800'
                      }`}
                    >
                      {v.courtType === 'outdoor'
                        ? v.hasLights
                          ? t.outdoorLights
                          : t.outdoorShort
                        : t.indoorShort}
                    </span>
                    <span className="font-extrabold text-slate-900 truncate">
                      {v.fullName}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 pl-5 text-[10px]">
                    {v.continuousSpan && (
                      <span
                        translate="no"
                        className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold"
                      >
                        {v.continuousSpan}
                      </span>
                    )}
                    <span className="text-slate-500">
                      {t.distanceFromOkayama(v.distanceKm)}
                    </span>
                  </div>
                </div>

                <a
                  href={v.bookingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 px-2 py-1 rounded bg-[#1B365D] text-lime-300 font-extrabold text-[11px] hover:bg-[#274b7d] shrink-0 whitespace-nowrap"
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
              titleClass: 'text-emerald-700',
              badgeClass: 'bg-emerald-100 text-emerald-900',
            },
            {
              label: inspectSlot.isTwoHourBlock
                ? t.twoHourMaybeGroup(inspectSlot.maybePlayers.length)
                : t.oneHourMaybeGroup(inspectSlot.maybePlayers.length),
              players: inspectSlot.maybePlayers,
              titleClass: 'text-amber-700',
              badgeClass: 'bg-amber-100 text-amber-900',
            },
            {
              label: t.noGroup(inspectSlot.noPlayers.length),
              players: inspectSlot.noPlayers,
              titleClass: 'text-rose-700',
              badgeClass: 'bg-rose-100 text-rose-900',
            },
          ].map((group) => (
            <div key={group.label}>
              <div className={`font-extrabold ${group.titleClass} mb-1`}>
                {group.label}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {!group.players.length ? (
                  <span className="text-slate-400">{t.noneLabel}</span>
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

          <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-200">
            <span className="text-[11px] text-slate-500">
              {viewingVote ? t.modalViewingNote(viewingVote.name) : null}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 cursor-pointer ml-auto whitespace-nowrap"
            >
              {t.closeBtn}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
