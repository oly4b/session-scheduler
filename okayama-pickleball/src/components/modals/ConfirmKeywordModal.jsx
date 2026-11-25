import React from 'react';
import { ShieldAlert } from 'lucide-react';

/**
 * Destructive-action guard modal requiring the user to type an exact confirmation
 * keyword (e.g. `"DELETE"` or `"CANCEL"`) before unlocking the confirm button.
 */
export function ConfirmKeywordModal({
  open,
  title,
  body,
  keyword,
  keywordHint,
  keywordPlaceholder,
  confirmInput,
  onConfirmInputChange,
  onCancel,
  onConfirm,
  cancelLabel,
  confirmLabel,
  tone = 'rose',
}) {
  if (!open) return null;

  const isMatched = confirmInput.trim() === keyword;
  const isAmber = tone === 'amber';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4">
        <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
          <ShieldAlert
            className={`w-4 h-4 shrink-0 ${isAmber ? 'text-amber-600' : 'text-rose-600'}`}
          />
          <span>{title}</span>
        </h3>
        <p className="text-xs text-slate-600 leading-relaxed">{body}</p>
        <div className="space-y-1">
          <label className="block text-[11px] font-bold text-slate-700">
            {keywordHint}
          </label>
          <input
            type="text"
            value={confirmInput}
            onChange={(e) => onConfirmInputChange(e.target.value)}
            placeholder={keywordPlaceholder}
            className={`w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold text-slate-900 outline-none ${
              isAmber ? 'focus:border-amber-500' : 'focus:border-rose-500'
            }`}
          />
        </div>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 cursor-pointer whitespace-nowrap"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={!isMatched}
            onClick={onConfirm}
            className={`px-4 py-2 rounded-xl disabled:opacity-40 disabled:pointer-events-none text-white text-xs font-bold cursor-pointer whitespace-nowrap ${
              isAmber
                ? 'bg-amber-600 hover:bg-amber-700'
                : 'bg-rose-600 hover:bg-rose-700'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
