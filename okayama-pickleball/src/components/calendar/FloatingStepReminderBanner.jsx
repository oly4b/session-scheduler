import React from 'react';
import { Info } from 'lucide-react';

/**
 * Sticky top progress banner shown while the user is filling out a vote or
 * editing an existing submission (`stepCount / totalSteps`).
 */
export function FloatingStepReminderBanner({ message, stepCount, totalSteps }) {
  const progressPercent = Math.max(
    0,
    Math.min(100, (stepCount / totalSteps) * 100)
  );

  return (
    <div className="sticky top-0 z-40 w-full bg-[#1B365D]/95 backdrop-blur-xs text-white shadow-md border-b border-lime-400/50">
      <div className="max-w-6xl mx-auto px-3.5 sm:px-6 py-2 flex items-center justify-between gap-3 text-xs font-extrabold">
        <div className="flex items-center gap-2 min-w-0">
          <Info className="w-4 h-4 text-lime-300 shrink-0" />
          <span className="truncate sm:whitespace-normal">{message}</span>
        </div>
        <span
          translate="no"
          className="px-2 py-0.5 rounded bg-white/15 text-lime-300 text-[11px] shrink-0 whitespace-nowrap"
        >
          {stepCount}/{totalSteps}
        </span>
      </div>
      <div className="w-full h-1 bg-slate-800/80">
        <div
          style={{ width: `${progressPercent}%` }}
          className="h-full bg-lime-400 transition-all duration-300"
        />
      </div>
    </div>
  );
}
