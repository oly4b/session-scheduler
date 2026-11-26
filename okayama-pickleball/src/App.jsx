import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  ChevronDown,
  ExternalLink,
  Info,
  Languages,
  MapPin,
  Moon,
  RefreshCw,
  Share2,
  Sun,
  Trophy,
} from 'lucide-react';
import { VENUES } from './config/venues';
import {
  getCurrentJstHour,
  getMinStartHourForDate,
  getTodayJstIsoDate,
} from './utils/jst';
import {
  buildCalendarWeeks,
  computeRankedTwoHourBlocks,
  computeSlotTallies,
  computeTwoHourHighlights,
  filterActiveVotes,
} from './domain/schedule';
import { useSchedulerData } from './hooks/useSchedulerData';
import { useBookingForm } from './hooks/useBookingForm';
import { useVoterForm } from './hooks/useVoterForm';
import { useLanguage } from './i18n/useLanguage';
import { useTheme } from './hooks/useTheme';
import { FloatingStepReminderBanner } from './components/calendar/FloatingStepReminderBanner';
import { CalendarGrid } from './components/calendar/CalendarGrid';
import { TopRecommendations } from './components/TopRecommendations';
import { VoterForm } from './components/VoterForm';
import { VoterList } from './components/VoterList';
import { ConfirmKeywordModal } from './components/modals/ConfirmKeywordModal';
import { GoingTallyModal } from './components/modals/GoingTallyModal';
import { SlotInspectModal } from './components/modals/SlotInspectModal';
import { EditPickerModal } from './components/modals/EditPickerModal';
import { ShareInviteModal } from './components/modals/ShareInviteModal';
import { BookingFormModal } from './components/modals/BookingFormModal';
import { BookingFormFields } from './components/modals/BookingFormFields';

const SCORING_APP_URL =
  import.meta.env.VITE_SCORING_APP_URL || 'https://sideout-pb-scoring.vercel.app';

function PickleballIcon() {
  return (
    <span
      role="img"
      aria-label="Peach"
      translate="no"
      className="w-7 h-7 inline-flex items-center justify-center text-[26px] leading-none select-none"
    >
      🍑
    </span>
  );
}

/**
 * Top-level coordinator for the 桃dinks pickleball availability scheduler:
 * wires data/realtime hooks, booking & voter form hooks, and extracted UI sections.
 *
 * @returns {JSX.Element}
 */
export default function App() {
  // === 1. Localization, Theme & Clock ===
  const { isJa, t, setLang } = useLanguage();
  const { isDark, toggleTheme } = useTheme();
  const todayJstDateKey = useMemo(() => getTodayJstIsoDate(), []);
  const currentJstHour = useMemo(() => getCurrentJstHour(), []);
  const minTodayStartHour = useMemo(
    () =>
      getMinStartHourForDate(todayJstDateKey, todayJstDateKey, currentJstHour),
    [todayJstDateKey, currentJstHour]
  );

  // === 2. Remote Scheduler Data & Realtime Sync ===
  const {
    votes,
    loadingVotes,
    errorMsg,
    openVenuesBySlot,
    bookedVenuesBySlot,
    lastSyncedAt,
    bookedSessionsByDate,
    setBookedSessionsByDate,
    attendeesByDate,
    setAttendeesByDate,
    refreshVotesAndAttendees,
  } = useSchedulerData(t.supabaseError);

  // === 3. Layout, Inspection & Toast State ===
  const [activeWeekIdx, setActiveWeekIdx] = useState(0);
  const [showVenueList, setShowVenueList] = useState(false);
  const [gridViewMode, setGridViewMode] = useState('vote');
  const [isSwitchingToScoring, setIsSwitchingToScoring] = useState(false);
  const [tableViewportWidth, setTableViewportWidth] = useState(0);
  const [inspectSlot, setInspectSlot] = useState(null);
  const [inspectGoingSession, setInspectGoingSession] = useState(null);
  const [toastMessage, setToastMessage] = useState('');

  const calendarSectionRef = useRef(null);
  const tableScrollRef = useRef(null);
  const voterBarRef = useRef(null);

  useEffect(() => {
    const el = tableScrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;

    const updateWidth = () => setTableViewportWidth(el.clientWidth);
    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const triggerToast = useCallback((msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? '' : prev));
    }, 3200);
  }, []);

  const { okayamaCount, kurashikiCount } = useMemo(() => {
    let okayama = 0;
    let kurashiki = 0;
    for (const venue of VENUES) {
      if (venue.area === 'okayama') okayama += 1;
      else if (venue.area === 'kurashiki') kurashiki += 1;
    }
    return { okayamaCount: okayama, kurashikiCount: kurashiki };
  }, []);

  // === 4. Derived Calendar, Highlights, Tallies & Top 2h Blocks ===
  const { calendarWeeks, allOpenSlots, hasLiveAvailability } = useMemo(
    () =>
      buildCalendarWeeks({
        openVenuesBySlot,
        bookedVenuesBySlot,
        bookedSessionsByDate,
        isJa,
      }),
    [openVenuesBySlot, bookedVenuesBySlot, bookedSessionsByDate, isJa]
  );

  // Keep RSVP-only and note-only voters visible alongside open-slot voters.
  const activeVotes = useMemo(
    () => filterActiveVotes({ votes, allOpenSlots, attendeesByDate }),
    [votes, allOpenSlots, attendeesByDate]
  );

  const { twoHourHighlightMap, twoHourEligibleSlotKeys } = useMemo(
    () => computeTwoHourHighlights({ calendarWeeks, openVenuesBySlot }),
    [calendarWeeks, openVenuesBySlot]
  );

  const slotTallies = useMemo(
    () => computeSlotTallies({ allOpenSlots, votes, openVenuesBySlot }),
    [allOpenSlots, votes, openVenuesBySlot]
  );

  const rankedTwoHourBlocks = useMemo(
    () =>
      computeRankedTwoHourBlocks({
        calendarWeeks,
        openVenuesBySlot,
        votes,
        bookedSessionsByDate,
      }),
    [calendarWeeks, openVenuesBySlot, votes, bookedSessionsByDate]
  );

  // === 5. Voter & Booking Form Hooks ===
  const voterForm = useVoterForm({
    activeWeekIdx,
    calendarWeeks,
    allOpenSlots,
    slotTallies,
    twoHourEligibleSlotKeys,
    bookedSessionsByDate,
    attendeesByDate,
    setAttendeesByDate,
    activeVotes,
    gridViewMode,
    setGridViewMode,
    setInspectSlot,
    refreshVotesAndAttendees,
    calendarSectionRef,
    triggerToast,
    t,
  });

  const bookingForm = useBookingForm({
    todayJstDateKey,
    currentJstHour,
    minTodayStartHour,
    bookedSessionsByDate,
    setBookedSessionsByDate,
    setAttendeesByDate,
    setPendingRsvpByDate: voterForm.setPendingRsvpByDate,
    votes,
    refreshVotesAndAttendees,
    calendarSectionRef,
    triggerToast,
    t,
  });

  const currentWeek = calendarWeeks[activeWeekIdx];
  const inspectedAttendees = inspectGoingSession
    ? attendeesByDate[inspectGoingSession.day.dateKey] || []
    : [];
  const inspectedYesList = inspectedAttendees.filter(
    (row) => row.status !== 'maybe'
  );
  const inspectedMaybeList = inspectedAttendees.filter(
    (row) => row.status === 'maybe'
  );

  const sharedBookingFieldProps = {
    bookingDate: bookingForm.bookingDate,
    todayJstDateKey,
    selectedStartHour: bookingForm.selectedStartHour,
    selectedEndHour: bookingForm.selectedEndHour,
    activeStartHour: bookingForm.activeStartHour,
    minStartForSelectedDate: bookingForm.minStartForSelectedDate,
    isSelectedDateClosedForNew: bookingForm.isSelectedDateClosedForNew,
    hasBookingForSelectedDate: bookingForm.hasBookingForSelectedDate,
    selectedBookingVenueId: bookingForm.selectedBookingVenueId,
    isOtherVenue: bookingForm.isOtherVenue,
    customBookingVenue: bookingForm.customBookingVenue,
    setCustomBookingVenue: bookingForm.setCustomBookingVenue,
    customBookingMapUrl: bookingForm.customBookingMapUrl,
    setCustomBookingMapUrl: bookingForm.setCustomBookingMapUrl,
    bookingCourtType: bookingForm.bookingCourtType,
    setBookingCourtType: bookingForm.setBookingCourtType,
    setHasCustomizedBooking: bookingForm.setHasCustomizedBooking,
    onBookingDateChange: bookingForm.handleBookingDateChange,
    onStartTimeChange: bookingForm.handleStartTimeChange,
    onEndTimeChange: bookingForm.handleEndTimeChange,
    onBookingVenueSelect: bookingForm.handleBookingVenueSelect,
    isJa,
    t,
  };

  return (
    <div className="min-h-screen bg-[#eef2f6] dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-16 font-sans selection:bg-lime-300 selection:text-slate-950 transition-colors">
      {!voterForm.viewingVote && voterForm.hasSelectionProgress && (
        <FloatingStepReminderBanner
          message={voterForm.reminderMessage}
          stepCount={voterForm.reminderStepCount}
          totalSteps={3}
        />
      )}

      {toastMessage && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-[#1B365D] text-white px-4 py-3 rounded-2xl shadow-2xl border border-lime-400/60 flex items-center gap-2.5 text-xs sm:text-sm font-bold max-w-[92vw]">
          <Check className="w-4 h-4 shrink-0 text-lime-300" />
          <span>{toastMessage}</span>
        </div>
      )}

      <header className="bg-[#1B365D] text-white shadow-md border-b-4 border-[#2B547E]">
        <div className="max-w-6xl mx-auto px-3.5 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 bg-white/10 rounded-xl border border-white/20 shrink-0">
                <PickleballIcon />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div
                    role="navigation"
                    aria-label="App switcher"
                    className="relative inline-grid grid-cols-2 rounded-full bg-slate-900/70 p-0.5 border border-white/15 overflow-hidden"
                  >
                    <span
                      aria-hidden="true"
                      className={`segmented-thumb pointer-events-none absolute top-0.5 bottom-0.5 left-0.5 w-[calc(50%-2px)] rounded-full bg-lime-400 shadow-xs ${
                        isSwitchingToScoring ? 'translate-x-full' : 'translate-x-0'
                      }`}
                    />
                    <span
                      aria-current="page"
                      className={`relative z-10 inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[11px] font-extrabold tracking-tight whitespace-nowrap transition-colors ${
                        isSwitchingToScoring ? 'text-slate-300' : 'text-slate-950'
                      }`}
                    >
                      {t.badgeIntegrated(VENUES.length)}
                    </span>
                    <a
                      href={SCORING_APP_URL}
                      onClick={(e) => {
                        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
                          return;
                        }
                        e.preventDefault();
                        setIsSwitchingToScoring(true);
                        setTimeout(() => {
                          window.location.assign(SCORING_APP_URL);
                          setTimeout(() => setIsSwitchingToScoring(false), 500);
                        }, 180);
                      }}
                      className={`relative z-10 inline-flex items-center justify-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold tracking-tight whitespace-nowrap no-underline transition-colors cursor-pointer ${
                        isSwitchingToScoring
                          ? 'text-slate-950'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      <Trophy className="w-3 h-3 shrink-0" />
                      <span>{t.scoringOsBtn}</span>
                    </a>
                  </div>
                  {hasLiveAvailability ? (
                    <span
                      translate={isJa ? undefined : 'no'}
                      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/10 text-[10px] text-lime-200 font-semibold whitespace-nowrap"
                    >
                      <RefreshCw className="w-2.5 h-2.5 shrink-0" />
                      <span>
                        yoyacool({lastSyncedAt.yoyacool || '同期済'}) /
                        Spacepad({lastSyncedAt.spacepad || '同期済'})
                      </span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-400/20 border border-amber-300/20 text-[10px] text-amber-200 font-semibold">
                      {t.syncedWaiting}
                    </span>
                  )}
                </div>

                <h1 className="text-base sm:text-xl font-extrabold tracking-tight text-white mt-0.5">
                  {t.appTitle.startsWith('桃dinks') ? (
                    <>
                      <span translate="no">
                        <span className="text-[#FF8A80]">桃</span>
                        <span className="text-white">dinks</span>
                      </span>
                      {t.appTitle.slice('桃dinks'.length)}
                    </>
                  ) : (
                    t.appTitle
                  )}
                </h1>

                <p className="text-[11px] sm:text-xs text-sky-200 flex items-center gap-1.5 mt-1">
                  <MapPin className="w-3.5 h-3.5 text-lime-300 shrink-0" />
                  <span>
                    {t.venuesSummary(
                      VENUES.length,
                      okayamaCount,
                      kurashikiCount
                    )}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
              <div
                translate="no"
                className="inline-flex rounded-full bg-slate-900/70 p-0.5 border border-white/10 text-xs font-bold whitespace-nowrap"
                title="Synced with browser language; toggle JA or EN to override"
              >
                <button
                  type="button"
                  onClick={() => setLang('ja')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full transition-transform duration-150 ease-out active:scale-[0.97] cursor-pointer ${
                    isJa
                      ? 'bg-lime-400 text-slate-950 font-bold shadow-xs'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Languages className="w-3.5 h-3.5 shrink-0" />
                  <span>JA</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLang('en')}
                  className={`px-2.5 py-1 rounded-full transition-transform duration-150 ease-out active:scale-[0.97] cursor-pointer ${
                    !isJa
                      ? 'bg-lime-400 text-slate-950 font-bold shadow-xs'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  EN
                </button>
              </div>

              <button
                type="button"
                onClick={toggleTheme}
                aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                title={isDark ? 'Day mode' : 'Night mode'}
                className="w-9 h-9 rounded-full bg-slate-800/80 border border-white/15 hover:border-white/30 text-lime-300 flex items-center justify-center transition-transform duration-150 ease-out active:scale-[0.97] cursor-pointer shrink-0"
              >
                {isDark ? (
                  <Sun className="w-4 h-4 shrink-0" />
                ) : (
                  <Moon className="w-4 h-4 shrink-0" />
                )}
              </button>

              <button
                type="button"
                onClick={bookingForm.handleOpenShareModal}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-lime-400 hover:bg-lime-300 text-slate-950 text-xs sm:text-sm font-semibold shadow transition-transform duration-150 ease-out active:scale-[0.97] cursor-pointer whitespace-nowrap"
              >
                <Share2 className="w-4 h-4 shrink-0" />
                <span>{t.shareToSns}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-2.5 sm:px-5 pt-4 space-y-4">
        {errorMsg && (
          <div className="bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 px-4 py-3 rounded-xl flex items-center gap-2 text-xs sm:text-sm">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <CalendarGrid
          calendarSectionRef={calendarSectionRef}
          tableScrollRef={tableScrollRef}
          tableViewportWidth={tableViewportWidth}
          calendarWeeks={calendarWeeks}
          activeWeekIdx={activeWeekIdx}
          setActiveWeekIdx={setActiveWeekIdx}
          currentWeek={currentWeek}
          todayJstDateKey={todayJstDateKey}
          bookedSessionsByDate={bookedSessionsByDate}
          attendeesByDate={attendeesByDate}
          pendingRsvpByDate={voterForm.pendingRsvpByDate}
          trimmedVoterName={voterForm.trimmedVoterName}
          viewingVote={voterForm.viewingVote}
          setViewingVote={voterForm.setViewingVote}
          editingVoteId={voterForm.editingVoteId}
          gridViewMode={gridViewMode}
          setGridViewMode={setGridViewMode}
          activeVotes={activeVotes}
          dayWindowByDate={voterForm.dayWindowByDate}
          twoHourEligibleSlotKeys={twoHourEligibleSlotKeys}
          twoHourHighlightMap={twoHourHighlightMap}
          slotTallies={slotTallies}
          activeMap={voterForm.activeMap}
          isJa={isJa}
          t={t}
          onOpenBookingModal={bookingForm.handleOpenBookingModal}
          onFillActiveWeekAll={voterForm.handleFillActiveWeekAll}
          onClearActiveWeek={voterForm.handleClearActiveWeek}
          onResetVoterForm={voterForm.resetVoterForm}
          onSelectVoterToView={voterForm.handleSelectVoterToView}
          onSelectVoterToEdit={voterForm.handleSelectVoterToEdit}
          onToggleBookingAttendee={voterForm.handleToggleBookingAttendee}
          onInspectGoingTally={setInspectGoingSession}
          onShareBookingCard={bookingForm.handleShareBookingCard}
          onRequestClearBooking={bookingForm.openUnmarkBookingGuard}
          onSelectDayWindow={voterForm.handleSelectDayWindow}
          onCycleSlot={voterForm.handleCycleSlot}
          onInspectSlot={setInspectSlot}
        />

        <VoterForm
          voterBarRef={voterBarRef}
          editingVoteId={voterForm.editingVoteId}
          viewingVote={voterForm.viewingVote}
          setViewingVote={voterForm.setViewingVote}
          voterName={voterForm.voterName}
          setVoterName={voterForm.setVoterName}
          voterNote={voterForm.voterNote}
          setVoterNote={voterForm.setVoterNote}
          showEditExistingButton={voterForm.showEditExistingButton}
          isSubmitting={voterForm.isSubmitting}
          selectedSlotCount={voterForm.selectedSlotCount}
          t={t}
          onSubmit={voterForm.handleSubmitVote}
          onOpenEditPicker={() => voterForm.setShowEditPickerModal(true)}
          onOpenDeleteVoteGuard={voterForm.openDeleteVoteGuard}
          onResetVoterForm={voterForm.resetVoterForm}
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          <TopRecommendations
            loadingVotes={loadingVotes}
            rankedTwoHourBlocks={rankedTwoHourBlocks}
            isJa={isJa}
            t={t}
            onInspectSlot={setInspectSlot}
          />
          <VoterList
            activeVotes={activeVotes}
            viewingVote={voterForm.viewingVote}
            isNotesLockedForEdit={voterForm.isNotesLockedForEdit}
            isJa={isJa}
            t={t}
            onSelectVoterToView={voterForm.handleSelectVoterToView}
          />
        </div>

        <footer className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-3.5 text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 space-y-2.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-extrabold text-slate-800 dark:text-slate-100 inline-flex items-center gap-1.5 tabular-nums">
                <Info className="w-4 h-4 text-[#1B365D] dark:text-lime-300 shrink-0" />
                <span>{t.directoryTitle(VENUES.length)}</span>
              </span>
              <button
                type="button"
                onClick={() => setShowVenueList((prev) => !prev)}
                aria-expanded={showVenueList}
                className="transition-transform duration-150 ease-out active:scale-[0.97] inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover-surface-slate-200 text-[#1B365D] dark:text-lime-300 font-extrabold text-xs border border-slate-300 dark:border-slate-600 cursor-pointer whitespace-nowrap"
              >
                <span>{showVenueList ? t.hideVenueList : t.showVenueList}</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 shrink-0 transition-transform ${
                    showVenueList ? 'rotate-180' : ''
                  }`}
                />
              </button>
            </div>
            <span>{t.footwearNote}</span>
          </div>

          {showVenueList && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {VENUES.map((v) => (
                <div
                  key={v.id}
                  className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold shrink-0 whitespace-nowrap ${
                        v.courtType === 'outdoor'
                          ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300'
                          : 'bg-sky-100 dark:bg-sky-950/70 text-sky-800 dark:text-sky-300'
                      }`}
                    >
                      {v.courtType === 'outdoor'
                        ? t.outdoorShort
                        : t.indoorShort}
                    </span>
                    <a
                      href={v.mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold text-slate-800 dark:text-slate-100 no-underline hover:text-sky-600 dark:hover:text-lime-300 transition-colors truncate"
                    >
                      {v.fullName}
                    </a>
                  </div>
                  <a
                    href={v.bookingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 text-[#1B365D] dark:text-lime-300 font-extrabold no-underline hover:opacity-80 transition-opacity shrink-0 whitespace-nowrap"
                  >
                    <span>{t.bookLink}</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                </div>
              ))}
            </div>
          )}
        </footer>
      </main>

      <GoingTallyModal
        session={inspectGoingSession}
        yesList={inspectedYesList}
        maybeList={inspectedMaybeList}
        onClose={() => setInspectGoingSession(null)}
        t={t}
      />

      <BookingFormModal
        open={bookingForm.showBookingModal}
        mode="create"
        onClose={() => bookingForm.setShowBookingModal(false)}
        onSubmit={bookingForm.handleSaveBookedSessionRow}
        isSavingBooking={bookingForm.isSavingBooking}
        canSubmit={
          !bookingForm.hasBookingForSelectedDate &&
          Boolean(bookingForm.selectedBookingVenueId) &&
          !bookingForm.isSelectedDateClosedForNew &&
          !bookingForm.isSelectedStartPast
        }
        formFields={
          <BookingFormFields
            {...sharedBookingFieldProps}
            showDuplicateWarning
            includePlaceholderOption
            enforcePastTimeGuard
          />
        }
        t={t}
      />

      <BookingFormModal
        open={bookingForm.showEditBookingModal}
        mode="edit"
        onClose={() => {
          bookingForm.setShowEditBookingModal(false);
          bookingForm.setEditingBookingDateKey('');
        }}
        onSubmit={bookingForm.handleSaveEditedBooking}
        isSavingBooking={bookingForm.isSavingBooking}
        canSubmit={Boolean(bookingForm.selectedBookingVenueId)}
        formFields={<BookingFormFields {...sharedBookingFieldProps} lockDateField />}
        t={t}
      />

      <SlotInspectModal
        inspectSlot={inspectSlot}
        onSelectSlot={setInspectSlot}
        onClose={() => setInspectSlot(null)}
        viewingVote={voterForm.viewingVote}
        t={t}
      />

      <EditPickerModal
        open={voterForm.showEditPickerModal}
        activeVotes={activeVotes}
        onSelectVoter={voterForm.handleSelectVoterToEdit}
        onClose={() => voterForm.setShowEditPickerModal(false)}
        t={t}
      />

      <ShareInviteModal
        open={bookingForm.showShareModal}
        canEditBooking={Boolean(
          bookingForm.shareModalBooking || bookingForm.closestBookedSession
        )}
        onOpenEditBooking={bookingForm.handleOpenEditBookingFromShare}
        bookingFormat={bookingForm.bookingFormat}
        onChangeFormat={(nextFormat) => {
          bookingForm.setHasCustomizedBooking(true);
          bookingForm.setBookingFormat(nextFormat);
        }}
        confirmedBookingText={bookingForm.confirmedBookingText}
        textareaRef={bookingForm.textareaRef}
        copiedShare={bookingForm.copiedShare}
        onCopyShareText={bookingForm.handleCopyShareText}
        onClose={() => bookingForm.setShowShareModal(false)}
        t={t}
      />

      <ConfirmKeywordModal
        open={Boolean(bookingForm.bookingToUnmark)}
        title={t.unmarkModalTitle}
        body={
          bookingForm.bookingToUnmark
            ? t.unmarkModalBody(
                bookingForm.bookingToUnmark.label,
                bookingForm.bookingToUnmark.venueLabel
              )
            : ''
        }
        keyword={t.deleteKeyword}
        keywordHint={t.deleteKeywordHint(t.deleteKeyword)}
        keywordPlaceholder={t.deleteKeywordPlaceholder(t.deleteKeyword)}
        confirmInput={bookingForm.unmarkConfirmInput}
        onConfirmInputChange={bookingForm.setUnmarkConfirmInput}
        onCancel={() => {
          bookingForm.setBookingToUnmark(null);
          bookingForm.setUnmarkConfirmInput('');
        }}
        onConfirm={bookingForm.handleConfirmClearBooking}
        cancelLabel={t.cancelBtn}
        confirmLabel={t.confirmUnmarkBtn}
        tone="amber"
      />

      <ConfirmKeywordModal
        open={Boolean(voterForm.voteToDelete)}
        title={t.deleteModalTitle}
        body={
          voterForm.voteToDelete
            ? t.deleteModalBody(voterForm.voteToDelete.name)
            : ''
        }
        keyword={t.deleteKeyword}
        keywordHint={t.deleteKeywordHint(t.deleteKeyword)}
        keywordPlaceholder={t.deleteKeywordPlaceholder(t.deleteKeyword)}
        confirmInput={voterForm.deleteConfirmInput}
        onConfirmInputChange={voterForm.setDeleteConfirmInput}
        onCancel={() => {
          voterForm.setVoteToDelete(null);
          voterForm.setDeleteConfirmInput('');
        }}
        onConfirm={voterForm.handleConfirmDeleteVote}
        cancelLabel={t.cancelBtn}
        confirmLabel={t.confirmDeleteBtn}
        tone="rose"
      />
    </div>
  );
}
