import React from 'react';
import { CalendarCheck, Edit3, X } from 'lucide-react';

/**
 * Shared modal shell for both creating a new confirmed session (`mode="create"`)
 * and editing an existing one (`mode="edit"`). Form inputs are passed via `formFields`.
 */
export function BookingFormModal({
  open,
  mode, // 'create' | 'edit'
  onClose,
  onSubmit,
  isSavingBooking,
  canSubmit,
  formFields,
  t,
}) {
  if (!open) return null;

  const isEdit = mode === 'edit';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div
          className={`px-4 py-3.5 text-white flex items-center justify-between gap-2 ${
            isEdit ? 'bg-[#1B365D]' : 'bg-emerald-900'
          }`}
        >
          <h3 className="font-extrabold text-sm sm:text-base flex items-center gap-2">
            {isEdit ? (
              <Edit3 className="w-4 h-4 text-lime-300 shrink-0" />
            ) : (
              <CalendarCheck className="w-4 h-4 text-lime-300 shrink-0" />
            )}
            <span>
              {isEdit ? t.editBookingModalTitle : t.bookModalTitle}
            </span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/15 text-slate-200 cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3 max-h-[85vh] overflow-y-auto text-xs">
          {formFields}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-white/15 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-100 dark:hover:bg-slate-700/80 cursor-pointer whitespace-nowrap transition-transform duration-150 ease-out active:scale-[0.97]"
            >
              {t.cancelBtn}
            </button>
            <button
              type="button"
              disabled={!canSubmit || isSavingBooking}
              onClick={onSubmit}
              className={`px-4 py-2.5 rounded-xl disabled:opacity-50 text-lime-300 font-extrabold cursor-pointer whitespace-nowrap ${
                isEdit
                  ? 'bg-[#1B365D] hover:bg-[#274b7d]'
                  : 'bg-emerald-700 hover:bg-emerald-800'
              }`}
            >
              {isSavingBooking
                ? t.submittingBtn
                : isEdit
                  ? t.saveEditedBookingBtn
                  : t.saveBookedRowBtn}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
