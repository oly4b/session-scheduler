import React from 'react';

/**
 * Renders the `◯` / `△` / `✕` / empty voting circle inside a grid cell; suppresses
 * hover feedback when `isViewing` is true (read-only voter inspection).
 */
export function SlotChoiceCircle({ choice, isViewing }) {
  const hoverCls = isViewing ? '' : 'slot-circle-hover';
  if (choice === 'yes') {
    return (
      <span
        className={`tactile-press ${hoverCls} w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-emerald-600 text-white font-extrabold text-lg sm:text-xl flex items-center justify-center shadow-xs shrink-0`}
      >
        ◯
      </span>
    );
  }
  if (choice === 'maybe') {
    return (
      <span
        className={`tactile-press ${hoverCls} w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-amber-500 text-white font-extrabold text-lg sm:text-xl flex items-center justify-center shadow-xs shrink-0`}
      >
        △
      </span>
    );
  }
  if (choice === 'no') {
    return (
      <span
        className={`tactile-press ${hoverCls} w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-rose-600 text-white font-extrabold text-lg sm:text-xl flex items-center justify-center shadow-xs shrink-0`}
      >
        ✕
      </span>
    );
  }

  return (
    <span
      className={`tactile-press ${hoverCls} w-8 h-8 sm:w-9 sm:h-9 rounded-full border-2 border-dashed font-extrabold text-lg sm:text-xl flex items-center justify-center bg-white shrink-0 ${
        isViewing
          ? 'border-slate-300 text-slate-300'
          : 'border-[#1B365D]/40 text-[#1B365D]'
      }`}
    >
      {isViewing ? '–' : '◯'}
    </span>
  );
}
