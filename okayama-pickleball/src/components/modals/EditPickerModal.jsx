import React from 'react';
import { Edit3, UserCheck, X } from 'lucide-react';
import { normalizeResponsesMap } from '../../utils/scheduler';

/**
 * Lists active voters so a user can pick whose submission to load into the grid
 * for editing (since the app uses open group polling without user accounts).
 */
export function EditPickerModal({
  open,
  activeVotes,
  onSelectVoter,
  onClose,
  t,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-4 py-3.5 bg-[#1B365D] text-white flex items-center justify-between gap-2">
          <h3 className="font-extrabold text-sm sm:text-base flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-lime-300 shrink-0" />
            <span>{t.pickVoterTitle}</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/15 text-slate-200 cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-2.5 text-xs">
          <p className="text-slate-600 dark:text-slate-300">{t.pickVoterPrompt}</p>

          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {activeVotes.map((v) => {
              const count = Object.keys(
                normalizeResponsesMap(v.responses)
              ).length;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => onSelectVoter(v)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-950/40 border border-slate-200 dark:border-slate-700 hover:border-amber-400 flex items-center justify-between gap-2 text-left transition cursor-pointer"
                >
                  <div className="min-w-0">
                    <div
                      translate="no"
                      className="font-extrabold text-slate-900 dark:text-slate-100 text-sm"
                    >
                      {v.name}
                    </div>
                    {v.note && (
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {v.note}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-[11px] whitespace-nowrap">
                      {t.answeredSlotsCount(count)}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#1B365D] dark:bg-lime-400 text-lime-300 dark:text-slate-950 font-extrabold dark:font-semibold whitespace-nowrap">
                      <Edit3 className="w-3 h-3 shrink-0" />
                      <span>{t.editAction}</span>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

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
