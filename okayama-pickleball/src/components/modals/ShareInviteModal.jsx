import React from 'react';
import { Check, Copy, Edit3, Share2, X } from 'lucide-react';

/**
 * Displays the generated session invite text with JA / EN / JA+EN format toggles,
 * one-tap clipboard copy, and an optional "Edit Booking" shortcut.
 */
export function ShareInviteModal({
  open,
  canEditBooking,
  onOpenEditBooking,
  bookingFormat,
  onChangeFormat,
  confirmedBookingText,
  textareaRef,
  copiedShare,
  onCopyShareText,
  onClose,
  t,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-4 py-3.5 bg-[#1B365D] text-white flex items-center justify-between gap-2">
          <h3 className="font-extrabold text-sm sm:text-base flex items-center gap-2">
            <Share2 className="w-4 h-4 text-lime-300 shrink-0" />
            <span>{t.shareModalTitle}</span>
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
          <div className="flex items-center justify-between gap-2">
            {canEditBooking && (
              <button
                type="button"
                onClick={onOpenEditBooking}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-300 dark:border-white/15 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700/80 text-[#1B365D] dark:text-slate-200 font-extrabold text-[11px] cursor-pointer whitespace-nowrap transition-transform duration-150 ease-out active:scale-[0.97]"
              >
                <Edit3 className="w-3 h-3 shrink-0" />
                <span>{t.editBookingBtn}</span>
              </button>
            )}

            <div className="flex items-center gap-1.5 ml-auto">
              {[
                { id: 'ja', label: 'JA' },
                { id: 'en', label: 'EN' },
                { id: 'bilingual', label: 'JA/EN' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onChangeFormat(item.id)}
                  className={`px-2.5 py-1 rounded-lg border font-extrabold text-[11px] cursor-pointer transition-transform duration-150 ease-out active:scale-[0.97] ${
                    bookingFormat === item.id
                      ? 'bg-[#1B365D] dark:bg-lime-400 text-lime-300 dark:text-slate-950 border-[#1B365D] dark:border-lime-400'
                      : 'bg-white dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-white/15'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-300">{t.sharePrompt}</p>

          <textarea
            ref={textareaRef}
            readOnly
            rows={10}
            value={confirmedBookingText}
            onFocus={(e) => e.target.select()}
            className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-xs font-sans leading-relaxed text-slate-800 dark:text-slate-100 focus:outline-none break-all"
          />

          <button
            type="button"
            onClick={onCopyShareText}
            className="w-full py-3 rounded-xl bg-lime-400 hover:bg-lime-300 text-[#1B365D] font-extrabold text-sm flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
          >
            {copiedShare ? (
              <>
                <Check className="w-4 h-4 shrink-0" />
                <span>{t.copiedBtn}</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 shrink-0" />
                <span>{t.copyBtn}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
