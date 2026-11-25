import React from 'react';
import { Edit3, UserCheck, X } from 'lucide-react';
import { normalizeResponsesMap } from '../../utils/scheduler';

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
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
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
          <p className="text-slate-600">{t.pickVoterPrompt}</p>

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
                  className="w-full p-2.5 rounded-xl bg-slate-50 hover:bg-amber-50 border border-slate-200 hover:border-amber-400 flex items-center justify-between gap-2 text-left transition cursor-pointer"
                >
                  <div className="min-w-0">
                    <div
                      translate="no"
                      className="font-extrabold text-slate-900 text-sm"
                    >
                      {v.name}
                    </div>
                    {v.note && (
                      <div className="text-[11px] text-slate-500 truncate">
                        {v.note}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-bold text-[11px] whitespace-nowrap">
                      {t.answeredSlotsCount(count)}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#1B365D] text-lime-300 font-extrabold whitespace-nowrap">
                      <Edit3 className="w-3 h-3 shrink-0" />
                      <span>{t.editAction}</span>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="pt-2 flex justify-end border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 cursor-pointer whitespace-nowrap"
            >
              {t.closeBtn}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
