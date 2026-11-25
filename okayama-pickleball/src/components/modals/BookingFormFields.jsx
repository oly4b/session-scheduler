import React from 'react';
import { ChevronDown } from 'lucide-react';
import { VENUES } from '../../config/venues';
import { OTHER_VENUE_OPTION } from '../../utils/confirmedInvite';
import { parseHourValue } from '../../utils/jst';
import { END_HOUR_OPTIONS, START_HOUR_OPTIONS } from '../../domain/bookingForm';

/**
 * Shared form body rendered inside `BookingFormModal` for both creating and
 * editing a confirmed session.
 */
export function BookingFormFields({
  bookingDate,
  todayJstDateKey,
  selectedStartHour,
  selectedEndHour,
  activeStartHour,
  minStartForSelectedDate,
  isSelectedDateClosedForNew,
  hasBookingForSelectedDate,
  selectedBookingVenueId,
  isOtherVenue,
  customBookingVenue,
  setCustomBookingVenue,
  customBookingMapUrl,
  setCustomBookingMapUrl,
  bookingCourtType,
  setBookingCourtType,
  setHasCustomizedBooking,
  onBookingDateChange,
  onStartTimeChange,
  onEndTimeChange,
  onBookingVenueSelect,
  showDuplicateWarning = false,
  includePlaceholderOption = false,
  lockDateField = false,
  enforcePastTimeGuard = false,
  isJa,
  t,
}) {
  return (
    <div className="space-y-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="min-w-0 overflow-hidden">
        <label className="block text-[11px] font-extrabold text-slate-600 dark:text-slate-300 mb-1">
          {isJa ? '日付' : 'Date'}
        </label>
        <input
          type="date"
          value={bookingDate}
          min={enforcePastTimeGuard ? todayJstDateKey : undefined}
          disabled={lockDateField}
          onChange={(e) => onBookingDateChange(e.target.value)}
          className="block w-full max-w-full min-w-0 box-border px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 disabled:bg-slate-100 dark:disabled:bg-slate-800 font-bold text-slate-800 dark:text-slate-100 text-xs appearance-none"
        />
        {enforcePastTimeGuard && isSelectedDateClosedForNew && (
          <p className="mt-1 text-[11px] font-bold text-rose-700">
            {t.todayClosedForBooking}
          </p>
        )}
        {showDuplicateWarning && hasBookingForSelectedDate && (
          <p className="mt-1 text-[11px] font-bold text-amber-800">
            {t.toastDuplicateDateBooking(bookingDate)}
          </p>
        )}
      </div>

      <div className="min-w-0">
        <label className="block text-[11px] font-extrabold text-slate-600 dark:text-slate-300 mb-1">
          {isJa ? '時間' : 'Time'}
        </label>
        <div className="flex items-center gap-1.5 min-w-0">
          <select
            aria-label="Start time"
            value={selectedStartHour || '17:00'}
            onChange={(e) => onStartTimeChange(e.target.value)}
            translate="no"
            className="flex-1 min-w-0 px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-bold text-slate-800 dark:text-slate-100 text-xs cursor-pointer"
          >
            {START_HOUR_OPTIONS.map((slot) => {
              const slotHour = parseHourValue(slot);
              const isPastHour =
                enforcePastTimeGuard && slotHour < minStartForSelectedDate;
              return (
                <option
                  key={`start-${slot}`}
                  value={slot}
                  disabled={isPastHour}
                >
                  {slot}
                </option>
              );
            })}
          </select>

          <span
            translate="no"
            className="text-xs font-extrabold text-slate-500 shrink-0 px-0.5"
          >
            ~
          </span>

          <select
            aria-label="End time"
            value={selectedEndHour || '19:00'}
            onChange={(e) => onEndTimeChange(e.target.value)}
            translate="no"
            className="flex-1 min-w-0 px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-bold text-slate-800 dark:text-slate-100 text-xs cursor-pointer"
          >
            {END_HOUR_OPTIONS.map((slot) => (
              <option
                key={`end-${slot}`}
                value={slot}
                disabled={parseHourValue(slot) <= activeStartHour}
              >
                {slot}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="min-w-0">
        <label
          htmlFor="confirmed-venue-select"
          className="block text-[11px] font-extrabold text-slate-600 dark:text-slate-300 mb-1"
        >
          {isJa ? '会場' : 'Venue'}
        </label>
        <div className="relative">
          <select
            id="confirmed-venue-select"
            value={selectedBookingVenueId}
            onChange={(e) => onBookingVenueSelect(e.target.value)}
            className="w-full appearance-none box-border px-3 py-2 pr-8 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-bold text-slate-800 dark:text-slate-100 text-xs cursor-pointer"
          >
            {includePlaceholderOption && (
              <option value="">{t.selectVenuePlaceholder}</option>
            )}
            {VENUES.map((venue) => (
              <option key={venue.id} value={venue.id}>
                [
                {venue.courtType === 'outdoor'
                  ? t.outdoorShort
                  : t.indoorShort}
                ] {venue.fullName}
              </option>
            ))}
            <option value={OTHER_VENUE_OPTION}>{t.otherVenueOption}</option>
          </select>
          <ChevronDown className="w-4 h-4 text-slate-500 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
        </div>
      </div>

      {isOtherVenue && (
        <>
          <div className="min-w-0">
            <label className="block text-[11px] font-extrabold text-slate-600 dark:text-slate-300 mb-1">
              {t.customVenueLabel}
            </label>
            <input
              type="text"
              value={customBookingVenue}
              onChange={(e) => {
                setHasCustomizedBooking(true);
                setCustomBookingVenue(e.target.value);
              }}
              placeholder={t.customVenuePlaceholder}
              className="w-full min-w-0 box-border px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-bold text-slate-800 dark:text-slate-100 text-xs"
            />
          </div>

          <div className="min-w-0">
            <label className="block text-[11px] font-extrabold text-slate-600 dark:text-slate-300 mb-1">
              {t.customMapLabel}
            </label>
            <input
              type="url"
              value={customBookingMapUrl}
              onChange={(e) => {
                setHasCustomizedBooking(true);
                setCustomBookingMapUrl(e.target.value);
              }}
              placeholder="https://maps.google.com/?q=..."
              className="w-full min-w-0 box-border px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-xs"
            />
          </div>

          <div className="flex items-center justify-start pt-1">
            <div className="inline-flex rounded-lg bg-white dark:bg-slate-900 p-0.5 border border-slate-300 dark:border-slate-600 font-extrabold text-[11px] shrink-0">
              <button
                type="button"
                onClick={() => {
                  setHasCustomizedBooking(true);
                  setBookingCourtType('indoor');
                }}
                className={`px-2.5 py-1 rounded cursor-pointer ${
                  bookingCourtType === 'indoor'
                    ? 'bg-sky-100 dark:bg-sky-500/20 text-sky-900 dark:text-sky-300'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {isJa ? '屋内' : 'Indoor'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setHasCustomizedBooking(true);
                  setBookingCourtType('outdoor');
                }}
                className={`px-2.5 py-1 rounded cursor-pointer ${
                  bookingCourtType === 'outdoor'
                    ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {isJa ? '屋外' : 'Outdoor'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
