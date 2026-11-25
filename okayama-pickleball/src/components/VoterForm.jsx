import React from 'react';
import {
  Check,
  Edit3,
  Eye,
  RotateCcw,
  Trash2,
  UserCheck,
} from 'lucide-react';

/**
 * Voter name/note submission bar with dynamic status header (default, editing,
 * or read-only viewing) and Edit Existing / Submit / Update / Delete actions.
 */
export function VoterForm({
  voterBarRef,
  editingVoteId,
  viewingVote,
  setViewingVote,
  voterName,
  setVoterName,
  voterNote,
  setVoterNote,
  showEditExistingButton,
  isSubmitting,
  selectedSlotCount,
  t,
  onSubmit,
  onOpenEditPicker,
  onOpenDeleteVoteGuard,
  onResetVoterForm,
}) {
  return (
    <section
      ref={voterBarRef}
      className={`rounded-2xl shadow-sm border-2 transition overflow-hidden ${
        editingVoteId
          ? 'bg-amber-50/90 border-amber-400'
          : viewingVote
            ? 'bg-sky-50/90 border-sky-400'
            : 'bg-white border-[#1B365D]/20'
      }`}
    >
      <div
        className={`px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs font-extrabold ${
          editingVoteId
            ? 'bg-amber-400 text-slate-950'
            : viewingVote
              ? 'bg-sky-700 text-white'
              : 'bg-[#264673] text-white'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {viewingVote ? (
            <Eye className="w-3.5 h-3.5 text-lime-300 shrink-0" />
          ) : (
            <Edit3
              className={`w-3.5 h-3.5 shrink-0 ${
                editingVoteId ? 'text-slate-950' : 'text-lime-300'
              }`}
            />
          )}
          <span>
            {editingVoteId
              ? t.editingBanner(voterName)
              : viewingVote
                ? t.viewingBanner(viewingVote.name)
                : t.defaultBanner()}
          </span>
        </div>

        {editingVoteId && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() =>
                onOpenDeleteVoteGuard({ id: editingVoteId, name: voterName })
              }
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-rose-600 text-white hover:bg-rose-700 cursor-pointer whitespace-nowrap"
            >
              <Trash2 className="w-3 h-3 shrink-0" />
              <span>{t.deleteBtn}</span>
            </button>
            <button
              type="button"
              onClick={onResetVoterForm}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white text-slate-800 border border-slate-300 hover:bg-slate-100 cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3 h-3 shrink-0" />
              <span>{t.cancelBtn}</span>
            </button>
          </div>
        )}
      </div>

      <form onSubmit={onSubmit} className="p-3.5 sm:p-4">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
          <div className="sm:col-span-4">
            <label className="block text-[11px] font-extrabold text-slate-600 mb-1">
              {t.nameLabel} <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              required
              pattern=".*\S+.*"
              title={t.nameTitle}
              value={voterName}
              onChange={(e) => {
                if (viewingVote) setViewingVote(null);
                setVoterName(e.target.value.replace(/^\s+/, ''));
              }}
              onBlur={(e) => setVoterName(e.target.value.trim())}
              placeholder={t.namePlaceholder}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white focus:border-[#1B365D] focus:ring-2 focus:ring-[#1B365D]/20 outline-none text-sm font-bold"
            />
          </div>

          <div className="sm:col-span-5">
            <label className="block text-[11px] font-extrabold text-slate-600 mb-1">
              {t.noteLabel}
            </label>
            <input
              type="text"
              value={voterNote}
              onChange={(e) => {
                if (viewingVote) setViewingVote(null);
                setVoterNote(e.target.value);
              }}
              placeholder={t.notePlaceholder}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white focus:border-[#1B365D] focus:ring-2 focus:ring-[#1B365D]/20 outline-none text-sm"
            />
          </div>

          <div className="sm:col-span-3 flex items-end">
            {showEditExistingButton ? (
              <button
                type="button"
                onClick={onOpenEditPicker}
                className="tactile-press active:scale-[0.97] w-full py-2.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs sm:text-sm shadow border border-amber-500 flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <UserCheck className="w-4 h-4 shrink-0" />
                <span>{t.editExistingBtn}</span>
              </button>
            ) : (
              <button
                type="submit"
                disabled={isSubmitting}
                className="tactile-press active:scale-[0.97] w-full py-2.5 px-4 rounded-xl bg-[#1B365D] hover:bg-[#274b7d] text-lime-300 font-extrabold text-xs sm:text-sm shadow flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                <Check className="w-4 h-4 shrink-0" />
                <span>
                  {isSubmitting
                    ? t.submittingBtn
                    : editingVoteId
                      ? t.updateVoteBtn
                      : t.submitVoteBtn(selectedSlotCount)}
                </span>
              </button>
            )}
          </div>
        </div>
      </form>
    </section>
  );
}
