import React from 'react';
import { Eye, MessageSquare } from 'lucide-react';

/**
 * Displays active players' notes and name pills; clicking a player opens their
 * submission in read-only view mode (locked while actively editing a vote).
 */
export function VoterList({
  activeVotes,
  viewingVote,
  isNotesLockedForEdit,
  isJa,
  t,
  onSelectVoterToView,
}) {
  return (
    <section className="lg:col-span-5 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
      <div className="px-4 py-3 bg-[#264673] text-white flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <MessageSquare className="w-4 h-4 text-lime-300 shrink-0" />
          <h2 className="font-extrabold text-xs sm:text-sm">{t.notesTitle}</h2>
          {isNotesLockedForEdit && (
            <span className="px-2 py-0.5 rounded bg-amber-300 text-slate-950 text-[10px] font-extrabold shrink-0 whitespace-nowrap">
              {t.notesLockedBadge}
            </span>
          )}
        </div>
        <span
          translate={isJa ? undefined : 'no'}
          className="text-[11px] text-sky-200 whitespace-nowrap shrink-0 tabular-nums"
        >
          {t.playerCountSuffix(activeVotes.length)}
        </span>
      </div>

      <div
        className={`p-3.5 space-y-2.5 max-h-[430px] overflow-y-auto flex-1 transition ${
          isNotesLockedForEdit ? 'bg-slate-100/70' : ''
        }`}
      >
        {!activeVotes.length ? (
          <p className="text-xs text-slate-400 italic py-6 text-center">
            {t.noNotesYet}
          </p>
        ) : (
          <>
            {activeVotes
              .filter((v) => Boolean(String(v.note || '').trim()))
              .map((v) => {
                const isSelected = viewingVote?.id === v.id;
                const previewTitle = isJa ? '投票を見る' : 'View votes';
                return (
                  <button
                    key={v.id}
                    type="button"
                    disabled={isNotesLockedForEdit}
                    aria-disabled={isNotesLockedForEdit}
                    aria-pressed={isSelected}
                    title={previewTitle}
                    onClick={() => onSelectVoterToView(v)}
                    className={`tactile-press w-full p-2.5 rounded-xl border flex items-start justify-between gap-2 text-left ${
                      isNotesLockedForEdit
                        ? 'bg-slate-100/90 border-slate-200/80 opacity-60 cursor-not-allowed'
                        : isSelected
                          ? 'active:scale-[0.97] bg-sky-50 border-sky-500 ring-2 ring-sky-400/40 cursor-pointer'
                          : 'active:scale-[0.97] bg-slate-50 hover-surface-sky border-slate-200 cursor-pointer'
                    }`}
                  >
                    <div className="min-w-0">
                      <div
                        translate="no"
                        className="text-xs font-extrabold text-[#1B365D]"
                      >
                        {v.name}
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5 break-words">
                        {v.note}
                      </p>
                    </div>
                    <span
                      title={previewTitle}
                      className={`p-1 rounded-lg shrink-0 transition-colors ${
                        isSelected
                          ? 'bg-sky-600 text-white'
                          : 'text-slate-400'
                      }`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </span>
                  </button>
                );
              })}

            {activeVotes.some((v) => !String(v.note || '').trim()) && (
              <div
                className={
                  activeVotes.some((v) => Boolean(String(v.note || '').trim()))
                    ? 'pt-2 border-t border-slate-200/80'
                    : ''
                }
              >
                <div className="text-[10px] font-bold text-slate-400 mb-1.5">
                  {t.noNoteText}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {activeVotes
                    .filter((v) => !String(v.note || '').trim())
                    .map((v) => {
                      const isSelected = viewingVote?.id === v.id;
                      const previewTitle = isJa ? '投票を見る' : 'View votes';
                      return (
                        <button
                          key={v.id}
                          type="button"
                          disabled={isNotesLockedForEdit}
                          aria-disabled={isNotesLockedForEdit}
                          aria-pressed={isSelected}
                          title={previewTitle}
                          onClick={() => onSelectVoterToView(v)}
                          className={`tactile-press inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-bold ${
                            isNotesLockedForEdit
                              ? 'bg-slate-100 border-slate-200 text-slate-400 opacity-60 cursor-not-allowed'
                              : isSelected
                                ? 'active:scale-[0.97] bg-sky-100 border-sky-500 text-sky-950 ring-2 ring-sky-400/40 cursor-pointer'
                                : 'active:scale-[0.97] bg-slate-50 hover-surface-sky border-slate-200 text-[#1B365D] cursor-pointer'
                          }`}
                        >
                          <span translate="no">{v.name}</span>
                          <Eye
                            className={`w-3 h-3 shrink-0 ${
                              isSelected ? 'text-sky-700' : 'text-slate-400'
                            }`}
                          />
                        </button>
                      );
                    })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {activeVotes.length > 0 && !isNotesLockedForEdit && (
        <div className="px-3.5 py-2 border-t border-slate-200/80 bg-slate-50/70 text-[11px] text-slate-500 flex items-center gap-1.5">
          <Eye className="w-3 h-3 text-slate-400 shrink-0" />
          <span>{t.notesTapHint}</span>
        </div>
      )}
    </section>
  );
}
