import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  MapPin,
  Trash2,
  Share2,
  Check,
  Edit3,
  Trophy,
  MessageSquare,
  X,
  RotateCcw,
  Info,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Eye,
  Grid,
  RefreshCw,
  ExternalLink,
  UserCheck,
  Languages,
  CalendarCheck,
  Clock,
} from 'lucide-react';
import { VENUES, VENUE_BY_ID } from './config/venues';
import {
  TIME_BLOCKS,
  normalizeResponsesMap,
} from './utils/scheduler';
import {
  formatHourSlot,
  getCurrentJstHour,
  getMinStartHourForDate,
  getTodayJstIsoDate,
  parseHourValue,
} from './utils/jst';
import {
  MANUAL_VENUE_ID,
  OTHER_VENUE_OPTION,
  formatConfirmedSessionInvite,
  normalizeCourtType,
} from './utils/confirmedInvite';
import {
  applyDayWindowToResponses,
  buildCalendarWeeks,
  clearWeekResponses,
  computeRankedTwoHourBlocks,
  computeSlotTallies,
  computeTwoHourHighlights,
  cycleSlotChoice,
  fillWeekAllResponses,
  filterActiveVotes,
  findAttendeesAvailableForSession,
} from './domain/schedule';
import {
  END_HOUR_OPTIONS,
  START_HOUR_OPTIONS,
  adjustBookingEndForStart,
  buildBookingPayloadFromForm,
  clampBookingEndTime,
  clampBookingTimeForDate,
} from './domain/bookingForm';
import {
  clearBookedSessionCascade,
  createBookedSession,
  deleteVoteCascade,
  resolveBookingVenueLabel,
  saveVoteWithRsvps,
  updateBookedSession,
} from './services/schedulerRepository';
import { useSchedulerData } from './hooks/useSchedulerData';
import { useLanguage } from './i18n/useLanguage';
import { ConfirmKeywordModal } from './components/modals/ConfirmKeywordModal';
import { GoingTallyModal } from './components/modals/GoingTallyModal';
import { SlotInspectModal } from './components/modals/SlotInspectModal';
import { EditPickerModal } from './components/modals/EditPickerModal';
import { ShareInviteModal } from './components/modals/ShareInviteModal';
import { BookingFormModal } from './components/modals/BookingFormModal';

function isoDateToUtcMs(dateKey) {
  return Date.parse(`${dateKey}T00:00:00Z`);
}

function formatDayLabel(day, isJa) {
  if (!day) return '';
  if (isJa) return `${day.jpDate}(${day.dow})`;
  return day.enDate && day.enDow
    ? `${day.enDate} (${day.enDow})`
    : `${day.jpDate}(${day.dow})`;
}

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

function FloatingStepReminderBanner({ message, stepCount, totalSteps }) {
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

function NoBookingsTodayRowCard({
  day,
  colSpan,
  viewportWidth,
  isJa,
  labelText,
}) {
  const innerBarWidthPx =
    viewportWidth > 0 ? Math.max(240, viewportWidth - 16) : null;
  const todayBadgeText = isJa ? '本日' : 'TODAY';

  return (
    <tr className="h-[96px] bg-slate-100/85 select-none">
      <td
        colSpan={colSpan}
        className="h-[96px] p-1.5 sm:p-2 align-middle text-left"
      >
        <div
          style={innerBarWidthPx ? { width: `${innerBarWidthPx}px` } : undefined}
          className="sticky left-2 max-w-full h-full rounded-xl border border-slate-300 bg-slate-50/95 px-3 sm:px-4 py-1.5 flex items-center justify-between gap-3 overflow-hidden text-slate-700"
        >
          <div className="flex items-center gap-2.5 shrink-0">
            <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-[#1B365D] text-lime-300 text-xs sm:text-sm font-extrabold whitespace-nowrap">
              {todayBadgeText}
            </span>
            <span
              translate={isJa ? undefined : 'no'}
              className="text-base sm:text-lg font-extrabold text-slate-900 whitespace-nowrap tabular-nums"
            >
              {formatDayLabel(day, isJa)}
            </span>
          </div>
          <span className="text-sm sm:text-base font-extrabold text-slate-700 truncate">
            {labelText}
          </span>
        </div>
      </td>
    </tr>
  );
}

function BookedSessionFullRowCard({
  day,
  booking,
  attendees,
  pendingRsvpByDate,
  activeAttendeeName,
  viewingVote,
  viewportWidth,
  isJa,
  t,
  onToggleBookingAttendee,
  onInspectGoingTally,
  onShareBooking,
  onRequestClearBooking,
}) {
  const venueLabel = resolveBookingVenueLabel(booking, t.venueTbd);
  const yesAttendees = attendees.filter((row) => row.status !== 'maybe');
  const maybeAttendees = attendees.filter((row) => row.status === 'maybe');
  const viewedName = String(viewingVote?.name || '').trim();
  const pendingChoice = pendingRsvpByDate[day.dateKey];
  const isGoing = viewingVote
    ? yesAttendees.some((row) => row.attendeeName === viewedName)
    : pendingChoice !== undefined
      ? pendingChoice === 'yes'
      : Boolean(
          activeAttendeeName &&
            yesAttendees.some((row) => row.attendeeName === activeAttendeeName)
        );

  const timeRangeLabel =
    `${formatHourSlot(booking.startHour)}–${formatHourSlot(booking.endHour)}`;

  const badge = isGoing
    ? { symbol: '◯', cls: 'bg-emerald-600 text-white' }
    : {
        symbol: '◯',
        cls:
          'bg-white text-[#1B365D] border border-dashed border-[#1B365D]/40',
      };

  const innerBarWidthPx =
    viewportWidth > 0 ? Math.max(240, viewportWidth - 16) : null;

  return (
    <tr className="h-[96px] bg-emerald-50/85">
      <td
        colSpan={TIME_BLOCKS.length + 1}
        className="h-[96px] p-1.5 sm:p-2 align-middle text-left"
      >
        <div
          style={innerBarWidthPx ? { width: `${innerBarWidthPx}px` } : undefined}
          className={`sticky left-2 max-w-full h-full rounded-xl border-2 px-2.5 sm:px-3.5 py-1.5 shadow-2xs flex items-center justify-between gap-2 overflow-hidden transition ${
            isGoing
              ? 'bg-emerald-50/60 border-emerald-500'
              : 'bg-white border-emerald-400'
          }`}
        >
          <div className="min-w-0 flex-1 space-y-1 text-left">
            <div className="flex items-center gap-1.5 overflow-hidden">
              <span className="inline-flex items-center justify-center p-1 rounded bg-emerald-700 text-lime-300 shrink-0">
                <CalendarCheck className="w-3.5 h-3.5 shrink-0" />
              </span>
              <span
                translate={isJa ? undefined : 'no'}
                className="text-xs sm:text-sm font-extrabold text-slate-900 shrink-0 whitespace-nowrap tabular-nums"
              >
                {formatDayLabel(day, isJa)}
              </span>
              <span
                translate="no"
                className="inline-flex items-center gap-1 text-xs sm:text-sm font-extrabold text-[#1B365D] shrink-0 whitespace-nowrap tabular-nums"
              >
                <Clock className="w-3 h-3 text-emerald-700 shrink-0 hidden sm:inline" />
                <span>{timeRangeLabel}</span>
              </span>
            </div>

            <div className="flex items-center gap-2 text-[11px] sm:text-xs text-slate-700 overflow-hidden">
              <span className="inline-flex items-center gap-1 font-extrabold text-emerald-900 min-w-0 truncate">
                <MapPin className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <span className="truncate">{venueLabel}</span>
              </span>
              <button
                type="button"
                onClick={() =>
                  onInspectGoingTally({
                    day,
                    booking,
                    venueLabel,
                    timeRangeLabel,
                  })
                }
                className="tactile-press active:scale-[0.97] inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-100/90 hover:bg-emerald-200 text-emerald-950 text-[10px] sm:text-[11px] font-extrabold border border-emerald-300 shrink-0 whitespace-nowrap cursor-pointer tabular-nums"
              >
                <Check className="w-3 h-3 text-emerald-700 shrink-0" />
                <span>
                  {t.goingLabel}: ◯{yesAttendees.length}
                  {maybeAttendees.length > 0
                    ? ` / △${maybeAttendees.length}`
                    : ''}
                </span>
              </button>
            </div>
          </div>

          <div
            aria-hidden="true"
            className="hidden md:flex flex-col items-center gap-1 px-3 shrink-0 w-44 lg:w-56"
          >
            <div className="w-full grid grid-cols-10 gap-0.5">
              {TIME_BLOCKS.map((block) => {
                const inSpan =
                  block.startHour >= booking.startHour &&
                  block.startHour < booking.endHour;
                return (
                  <span
                    key={block.id}
                    className={`h-2 rounded-xs transition-colors ${
                      inSpan
                        ? 'bg-emerald-600'
                        : 'bg-slate-200/80'
                    }`}
                  />
                );
              })}
            </div>
            <span
              translate="no"
              className="text-[10px] font-bold text-emerald-800/80 tabular-nums"
            >
              {timeRangeLabel}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onShareBooking(booking)}
              className="tactile-press active:scale-[0.97] inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-lime-400 hover:bg-lime-300 text-[#1B365D] text-[10px] sm:text-[11px] font-extrabold border border-lime-500 cursor-pointer whitespace-nowrap"
            >
              <Share2 className="w-3 h-3 shrink-0" />
            </button>

            <button
              type="button"
              disabled={Boolean(viewingVote)}
              onClick={() => onToggleBookingAttendee(booking, isGoing)}
              className={`tactile-press inline-flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-extrabold border whitespace-nowrap ${
                viewingVote
                  ? isGoing
                    ? 'cursor-default bg-emerald-100/80 border-emerald-400 text-emerald-950'
                    : 'opacity-60 cursor-default bg-slate-100 border-slate-300 text-slate-500'
                  : isGoing
                    ? 'active:scale-[0.97] bg-emerald-100 hover:bg-emerald-200 border-emerald-400 text-emerald-950 cursor-pointer'
                    : 'active:scale-[0.97] bg-emerald-50 hover:bg-emerald-100 border-emerald-300 text-emerald-900 cursor-pointer'
              }`}
            >
              <span
                translate="no"
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full text-lg sm:text-xl font-extrabold inline-flex items-center justify-center shrink-0 ${badge.cls}`}
              >
                {badge.symbol}
              </span>
            </button>

            {!viewingVote && (
              <>
                <span
                  aria-hidden="true"
                  className="h-6 w-px bg-emerald-300/80 mx-0.5 shrink-0"
                />
                <button
                  type="button"
                  onClick={() =>
                    onRequestClearBooking({
                      dateKey: day.dateKey,
                      label: `${day.jpDate}(${day.dow})`,
                      venueLabel,
                    })
                  }
                  aria-label={t.unmarkBookingBtn}
                  className="tactile-press active:scale-[0.97] px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-rose-100 hover:text-rose-700 hover:border-rose-300 text-slate-600 text-[10px] sm:text-[11px] font-extrabold border border-slate-300 cursor-pointer whitespace-nowrap"
                >
                  {t.unmarkBookingBtn}
                </button>
              </>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

function SlotChoiceCircle({ choice, isViewing }) {
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

/**
 * Renders the 桃dinks pickleball availability scheduler with real-time
 * Supabase persistence and browser-locale language synchronization.
 *
 * @returns {JSX.Element}
 */
export default function App() {
  const { isJa, t, setLang } = useLanguage();

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

  const [activeWeekIdx, setActiveWeekIdx] = useState(0);
  const [showVenueList, setShowVenueList] = useState(false);
  const [gridViewMode, setGridViewMode] = useState('vote');
  const [dayWindowByDate, setDayWindowByDate] = useState({});
  const [pendingRsvpByDate, setPendingRsvpByDate] = useState({});
  const [tableViewportWidth, setTableViewportWidth] = useState(0);

  const [voterName, setVoterName] = useState('');
  const [voterNote, setVoterNote] = useState('');
  const [responses, setResponses] = useState({});
  const [editingVoteId, setEditingVoteId] = useState(null);
  const [viewingVote, setViewingVote] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingBooking, setIsSavingBooking] = useState(false);

  const [inspectSlot, setInspectSlot] = useState(null);
  const [inspectGoingSession, setInspectGoingSession] = useState(null);
  const [showEditPickerModal, setShowEditPickerModal] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareModalBooking, setShareModalBooking] = useState(null);
  const [showEditBookingModal, setShowEditBookingModal] = useState(false);
  const [editingBookingDateKey, setEditingBookingDateKey] = useState('');

  const todayJstDateKey = useMemo(() => getTodayJstIsoDate(), []);
  const currentJstHour = useMemo(() => getCurrentJstHour(), []);
  const minTodayStartHour = useMemo(
    () =>
      getMinStartHourForDate(todayJstDateKey, todayJstDateKey, currentJstHour),
    [todayJstDateKey, currentJstHour]
  );

  const [bookingDate, setBookingDate] = useState(() => todayJstDateKey);
  const [bookingTime, setBookingTime] = useState('17:00-19:00');
  const [selectedBookingVenueId, setSelectedBookingVenueId] = useState('');
  const [customBookingVenue, setCustomBookingVenue] = useState('');
  const [customBookingMapUrl, setCustomBookingMapUrl] = useState('');
  const [bookingCourtType, setBookingCourtType] = useState('indoor');
  const [bookingFormat, setBookingFormat] = useState('bilingual');
  const [, setHasCustomizedBooking] = useState(false);

  const [bookingToUnmark, setBookingToUnmark] = useState(null);
  const [unmarkConfirmInput, setUnmarkConfirmInput] = useState('');
  const [voteToDelete, setVoteToDelete] = useState(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [copiedShare, setCopiedShare] = useState(false);

  const calendarSectionRef = useRef(null);
  const tableScrollRef = useRef(null);
  const voterBarRef = useRef(null);
  const textareaRef = useRef(null);

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

  const viewingResponsesMap = useMemo(
    () => (viewingVote ? normalizeResponsesMap(viewingVote.responses) : null),
    [viewingVote]
  );

  const closestBookedSession = useMemo(() => {
    const entries = Object.values(bookedSessionsByDate);
    if (!entries.length) return null;
    const todayMs = isoDateToUtcMs(todayJstDateKey);

    return [...entries].sort((a, b) => {
      const distA = Math.abs(isoDateToUtcMs(a.dateKey) - todayMs);
      const distB = Math.abs(isoDateToUtcMs(b.dateKey) - todayMs);
      if (distA !== distB) return distA - distB;
      return a.dateKey.localeCompare(b.dateKey);
    })[0];
  }, [bookedSessionsByDate, todayJstDateKey]);

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

  const applyBookingToForm = useCallback((booking) => {
    const hasCustomVenue = Boolean(booking.venueName?.trim());
    const isManual =
      booking.venueId === MANUAL_VENUE_ID ||
      (hasCustomVenue && !VENUE_BY_ID.has(booking.venueId));
    const matchedVenue =
      !isManual && booking.venueId ? VENUE_BY_ID.get(booking.venueId) : null;

    setHasCustomizedBooking(true);
    setBookingDate(booking.dateKey);
    setBookingTime(
      `${formatHourSlot(booking.startHour)}-${formatHourSlot(booking.endHour)}`
    );
    setSelectedBookingVenueId(
      matchedVenue ? matchedVenue.id : OTHER_VENUE_OPTION
    );
    setCustomBookingVenue(hasCustomVenue ? booking.venueName.trim() : '');
    setCustomBookingMapUrl(String(booking.mapUrl || '').trim());
    setBookingCourtType(
      matchedVenue
        ? normalizeCourtType(matchedVenue.courtType, 'indoor')
        : normalizeCourtType(booking.courtType, 'indoor')
    );
  }, []);

  const buildBookingPayload = useCallback(
    () =>
      buildBookingPayloadFromForm({
        bookingTime,
        selectedBookingVenueId,
        customBookingVenue,
        customBookingMapUrl,
        bookingCourtType,
      }),
    [
      bookingTime,
      selectedBookingVenueId,
      customBookingVenue,
      customBookingMapUrl,
      bookingCourtType,
    ]
  );

  const handleOpenBookingModal = () => {
    setHasCustomizedBooking(true);
    setBookingDate(todayJstDateKey);
    const defaultStart = Math.max(17, minTodayStartHour);
    const clampedStart = Math.min(20, defaultStart);
    setBookingTime(
      `${formatHourSlot(clampedStart)}-${formatHourSlot(Math.min(22, clampedStart + 2))}`
    );
    setSelectedBookingVenueId('');
    setCustomBookingVenue('');
    setCustomBookingMapUrl('');
    setBookingCourtType('indoor');
    setShowBookingModal(true);
  };

  const handleOpenShareModal = () => {
    setCopiedShare(false);

    if (closestBookedSession) {
      applyBookingToForm(closestBookedSession);
      setShareModalBooking(closestBookedSession);
    } else {
      setHasCustomizedBooking(true);
      setBookingDate(todayJstDateKey);
      setBookingTime('18:00-20:00');
      setSelectedBookingVenueId(OTHER_VENUE_OPTION);
      setCustomBookingVenue('');
      setCustomBookingMapUrl('');
      setBookingCourtType('indoor');
      setShareModalBooking(null);
    }

    setShowShareModal(true);
  };

  const handleShareBookingCard = useCallback(
    (booking) => {
      setCopiedShare(false);
      applyBookingToForm(booking);
      setShareModalBooking(booking);
      setShowShareModal(true);
    },
    [applyBookingToForm]
  );

  const handleOpenEditBookingFromShare = () => {
    const target = shareModalBooking || closestBookedSession;
    if (!target) return;
    applyBookingToForm(target);
    setEditingBookingDateKey(target.dateKey);
    setShowShareModal(false);
    setShowEditBookingModal(true);
  };

  const handleSaveEditedBooking = async () => {
    if (!editingBookingDateKey || isSavingBooking) return;

    const { dbRow, stateEntry } = buildBookingPayload();
    const autoAttendeeNames = findAttendeesAvailableForSession({
      votes,
      dateKey: editingBookingDateKey,
      startHour: stateEntry.startHour,
      endHour: stateEntry.endHour,
    });
    const resolvedVenueName = resolveBookingVenueLabel(stateEntry, t.venueTbd);

    setIsSavingBooking(true);
    try {
      await updateBookedSession({
        dateKey: editingBookingDateKey,
        dbRow,
        autoAttendeeNames,
        venueName: resolvedVenueName,
      });

      setBookedSessionsByDate((prev) => ({
        ...prev,
        [editingBookingDateKey]: {
          dateKey: editingBookingDateKey,
          ...stateEntry,
        },
      }));
      await refreshVotesAndAttendees();
      setShowEditBookingModal(false);
      setEditingBookingDateKey('');
      triggerToast(t.toastUpdatedBooking(editingBookingDateKey));
    } catch (err) {
      console.error('Supabase booking update error:', err);
      triggerToast(t.toastBookingUpdateError);
    } finally {
      setIsSavingBooking(false);
    }
  };

  const handleSaveBookedSessionRow = async () => {
    if (!bookingDate || !selectedBookingVenueId || isSavingBooking) return;

    if (bookedSessionsByDate[bookingDate]) {
      triggerToast(t.toastDuplicateDateBooking(bookingDate));
      return;
    }

    const minAllowedStart = getMinStartHourForDate(
      bookingDate,
      todayJstDateKey,
      currentJstHour
    );
    const chosenStart = parseHourValue(bookingTime.split('-')[0] || '17:00');
    if (chosenStart < minAllowedStart) {
      triggerToast(t.pastTodayTimeToast);
      return;
    }

    const { dbRow, stateEntry } = buildBookingPayload();
    const autoAttendeeNames = findAttendeesAvailableForSession({
      votes,
      dateKey: bookingDate,
      startHour: stateEntry.startHour,
      endHour: stateEntry.endHour,
    });
    const resolvedVenueName = resolveBookingVenueLabel(stateEntry, t.venueTbd);

    setIsSavingBooking(true);
    try {
      const result = await createBookedSession({
        dateKey: bookingDate,
        dbRow,
        autoAttendeeNames,
        venueName: resolvedVenueName,
      });
      if (result.isDuplicate) {
        triggerToast(t.toastDuplicateDateBooking(bookingDate));
        return;
      }
      if (!result.ok) throw result.error;

      setBookedSessionsByDate((prev) => ({
        ...prev,
        [bookingDate]: {
          dateKey: bookingDate,
          ...stateEntry,
        },
      }));
      if (autoAttendeeNames.length > 0) {
        await refreshVotesAndAttendees();
      }
      setShowBookingModal(false);
      calendarSectionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
      triggerToast(t.toastMarkedBooked(bookingDate));
    } catch (err) {
      console.error('Supabase booking save error:', err);
      triggerToast(t.toastBookingSaveError);
    } finally {
      setIsSavingBooking(false);
    }
  };

  const openUnmarkBookingGuard = (targetBooking) => {
    setUnmarkConfirmInput('');
    setBookingToUnmark(targetBooking);
  };

  const handleConfirmClearBooking = useCallback(async () => {
    if (!bookingToUnmark || unmarkConfirmInput.trim() !== t.deleteKeyword) {
      return;
    }

    const { dateKey } = bookingToUnmark;
    try {
      await clearBookedSessionCascade({ dateKey });

      setBookedSessionsByDate((prev) => {
        const next = { ...prev };
        delete next[dateKey];
        return next;
      });
      setAttendeesByDate((prev) => {
        const next = { ...prev };
        delete next[dateKey];
        return next;
      });
      setPendingRsvpByDate((prev) => {
        const next = { ...prev };
        delete next[dateKey];
        return next;
      });
      setBookingToUnmark(null);
      setUnmarkConfirmInput('');
      triggerToast(t.toastUnmarkedBooked(dateKey));
    } catch (err) {
      console.error('Supabase booking delete error:', err);
      triggerToast(t.toastBookingDeleteError);
    }
  }, [
    bookingToUnmark,
    unmarkConfirmInput,
    t,
    triggerToast,
    setBookedSessionsByDate,
    setAttendeesByDate,
  ]);

  const handleToggleBookingAttendee = useCallback(
    (booking, currentlyGoing) => {
      if (viewingVote) {
        triggerToast(t.viewingBanner(viewingVote.name));
        return;
      }

      // Defer attendee persistence until submit so toggles stay reversible.
      setPendingRsvpByDate((prev) => ({
        ...prev,
        [booking.dateKey]: currentlyGoing ? 'no' : 'yes',
      }));
    },
    [viewingVote, t, triggerToast]
  );

  const handleCycleSlot = (slotKey) => {
    if (!slotTallies[slotKey]) return;

    if (!twoHourEligibleSlotKeys.has(slotKey)) {
      triggerToast(t.no2hTitle);
      return;
    }

    if (viewingVote) {
      triggerToast(t.viewingBanner(viewingVote.name));
      return;
    }

    if (gridViewMode === 'heatmap') {
      setInspectSlot(slotTallies[slotKey]);
      return;
    }

    setResponses((prev) => cycleSlotChoice(prev, slotKey));
  };

  const handleSelectDayWindow = (day, windowMode) => {
    if (viewingVote) {
      triggerToast(t.viewingBanner(viewingVote.name));
      return;
    }

    const currentMode = dayWindowByDate[day.dateKey];
    const nextMode = currentMode === windowMode ? null : windowMode;

    setDayWindowByDate((prev) => {
      const next = { ...prev };
      if (nextMode) next[day.dateKey] = nextMode;
      else delete next[day.dateKey];
      return next;
    });

    setResponses((prev) =>
      applyDayWindowToResponses(prev, day, nextMode, twoHourEligibleSlotKeys)
    );
  };

  const handleFillActiveWeekAll = () => {
    if (viewingVote) {
      triggerToast(t.viewingBanner(viewingVote.name));
      return;
    }

    const week = calendarWeeks[activeWeekIdx];
    const { responses: nextResponses, dayWindows } = fillWeekAllResponses(
      responses,
      week,
      bookedSessionsByDate,
      twoHourEligibleSlotKeys
    );

    setResponses(nextResponses);
    setDayWindowByDate((prev) => ({ ...prev, ...dayWindows }));
    triggerToast(`${week.shortTitle}: ${t.weekFillAll}`);
  };

  const handleClearActiveWeek = () => {
    if (viewingVote) {
      triggerToast(t.viewingBanner(viewingVote.name));
      return;
    }

    const week = calendarWeeks[activeWeekIdx];
    const weekDateKeys = new Set(week.days.map((day) => day.dateKey));

    setDayWindowByDate((prev) => {
      const next = { ...prev };
      for (const dateKey of weekDateKeys) {
        delete next[dateKey];
      }
      return next;
    });

    setResponses((prev) => clearWeekResponses(prev, allOpenSlots, activeWeekIdx));

    triggerToast(`${t.weekClearAll}: ${week.shortTitle}`);
  };

  const resetVoterForm = useCallback(() => {
    setVoterName('');
    setVoterNote('');
    setResponses({});
    setPendingRsvpByDate({});
    setDayWindowByDate({});
    setEditingVoteId(null);
    setViewingVote(null);
  }, []);

  const handleSelectVoterToView = useCallback(
    (vote) => {
      if (!vote || editingVoteId === vote.id) return;
      if (editingVoteId) {
        triggerToast(t.editingBanner(voterName));
        return;
      }
      setViewingVote(vote);
      setGridViewMode('vote');
      calendarSectionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
      triggerToast(t.viewingBanner(vote.name));
    },
    [editingVoteId, voterName, t, triggerToast]
  );

  const handleSelectVoterToEdit = useCallback(
    (vote) => {
      if (!vote) return;
      const cleanName = String(vote.name || '').trim();
      const prefilledRsvp = {};
      for (const [dateKey, rows] of Object.entries(attendeesByDate)) {
        if ((rows || []).some((row) => row.attendeeName === cleanName)) {
          prefilledRsvp[dateKey] = 'yes';
        }
      }

      setViewingVote(null);
      setEditingVoteId(vote.id);
      setVoterName(vote.name || '');
      setVoterNote(vote.note || '');
      setResponses(normalizeResponsesMap(vote.responses));
      setPendingRsvpByDate(prefilledRsvp);
      setGridViewMode('vote');
      setShowEditPickerModal(false);
      calendarSectionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
      triggerToast(t.editingBanner(vote.name));
    },
    [attendeesByDate, t, triggerToast]
  );

  const handleBookingDateChange = (nextDate) => {
    setHasCustomizedBooking(true);
    setBookingDate(nextDate);
    setBookingTime((prev) =>
      clampBookingTimeForDate(nextDate, prev, todayJstDateKey, currentJstHour)
    );
  };

  const handleStartTimeChange = (nextStart) => {
    setHasCustomizedBooking(true);
    setBookingTime((prev) => adjustBookingEndForStart(nextStart, prev));
  };

  const handleEndTimeChange = (nextEnd) => {
    setHasCustomizedBooking(true);
    setBookingTime((prev) => clampBookingEndTime(nextEnd, prev));
  };

  const handleBookingVenueSelect = (nextId) => {
    setHasCustomizedBooking(true);
    setSelectedBookingVenueId(nextId);
    const presetVenue = VENUE_BY_ID.get(nextId);
    if (presetVenue?.courtType) {
      setBookingCourtType(presetVenue.courtType);
    }
  };

  const handleSubmitVote = async (e) => {
    e.preventDefault();
    const trimmedName = voterName.trim().replace(/\s+/g, ' ');
    if (!trimmedName) {
      setVoterName('');
      triggerToast(t.toastEnterName);
      return;
    }

    const cleanResponses = normalizeResponsesMap(responses);
    const hasSlotVotes = Object.keys(cleanResponses).length > 0;
    const hasGoingRsvp = Object.values(pendingRsvpByDate).some(
      (choice) => choice === 'yes'
    );
    const hasPendingRsvp = Object.keys(pendingRsvpByDate).length > 0;

    if (!hasSlotVotes && !hasGoingRsvp) {
      triggerToast(
        editingVoteId ? t.toastEmptyEditSelection : t.toastSelectSlot
      );
      return;
    }

    setIsSubmitting(true);
    try {
      // Save calendar_votes even for RSVP-only entries so notes and edits stay linked.
      await saveVoteWithRsvps({
        editingVoteId,
        payload: {
          name: trimmedName,
          note: voterNote.trim(),
          responses: cleanResponses,
        },
        pendingRsvpByDate,
        bookedSessionsByDate,
        attendeeName: trimmedName,
        fallbackVenueLabel: t.venueTbd,
      });

      triggerToast(
        editingVoteId
          ? t.toastUpdatedVote(trimmedName)
          : t.toastSubmittedVote(trimmedName)
      );
      await refreshVotesAndAttendees();
      resetVoterForm();
    } catch (err) {
      console.error('Supabase save error:', err);
      triggerToast(
        hasPendingRsvp ? t.toastAttendeeSaveError : t.toastSaveError
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const openDeleteVoteGuard = (targetVote) => {
    setDeleteConfirmInput('');
    setVoteToDelete(targetVote);
  };

  const handleConfirmDeleteVote = async () => {
    if (!voteToDelete || deleteConfirmInput.trim() !== t.deleteKeyword) {
      return;
    }

    const targetName = String(voteToDelete.name || '').trim();
    const targetNameLower = targetName.toLowerCase();

    try {
      await deleteVoteCascade({ voteId: voteToDelete.id, targetName });

      if (targetName) {
        setAttendeesByDate((prev) => {
          const next = {};
          for (const [dateKey, rows] of Object.entries(prev)) {
            next[dateKey] = (rows || []).filter(
              (row) => row.attendeeName.toLowerCase() !== targetNameLower
            );
          }
          return next;
        });
      }

      if (
        editingVoteId === voteToDelete.id ||
        viewingVote?.id === voteToDelete.id
      ) {
        resetVoterForm();
      }
      await refreshVotesAndAttendees();
      triggerToast(t.toastDeletedVote(voteToDelete.name));
    } catch (err) {
      console.error('Supabase delete error:', err);
      triggerToast(t.toastDeleteError);
    } finally {
      setVoteToDelete(null);
      setDeleteConfirmInput('');
    }
  };

  const isOtherVenue = selectedBookingVenueId === OTHER_VENUE_OPTION;

  const confirmedBookingText = useMemo(
    () =>
      formatConfirmedSessionInvite({
        origin: window.location.origin,
        dateIso: bookingDate,
        timeRangeText: bookingTime,
        venueId: selectedBookingVenueId,
        customVenueName: customBookingVenue,
        customMapUrl: customBookingMapUrl,
        courtType: bookingCourtType,
        format: bookingFormat,
      }),
    [
      bookingDate,
      bookingTime,
      selectedBookingVenueId,
      customBookingVenue,
      customBookingMapUrl,
      bookingCourtType,
      bookingFormat,
    ]
  );

  const handleCopyShareText = async () => {
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(confirmedBookingText);
        setCopiedShare(true);
        triggerToast(t.toastCopiedShare);
        setTimeout(() => setCopiedShare(false), 2500);
        return;
      } catch {
        // Fallback to manual text selection when clipboard API is blocked.
      }
    }

    textareaRef.current?.focus();
    textareaRef.current?.select();
    triggerToast(t.toastSelectManual);
  };

  const currentWeek = calendarWeeks[activeWeekIdx];
  const selectedSlotCount = Object.keys(responses).length;
  const trimmedVoterName = voterName.trim();
  const hasAnyRsvpSelected = Object.values(pendingRsvpByDate).some(
    (choice) => choice === 'yes'
  );
  const hasSelectionProgress =
    Boolean(trimmedVoterName) || selectedSlotCount > 0 || hasAnyRsvpSelected;
  const isNotesLockedForEdit = Boolean(editingVoteId);
  const showEditExistingButton =
    !editingVoteId &&
    activeVotes.length > 0 &&
    !trimmedVoterName &&
    selectedSlotCount === 0 &&
    !hasAnyRsvpSelected;

  const { reminderMessage, reminderStepCount } = useMemo(() => {
    const hasName = Boolean(trimmedVoterName);
    const hasSlots = selectedSlotCount > 0;
    const stepsCompleted =
      (hasName ? 1 : 0) + (hasSlots || hasAnyRsvpSelected ? 1 : 0);

    if (hasAnyRsvpSelected && !hasName) {
      return {
        reminderMessage: t.rsvpWithoutNameBanner(),
        reminderStepCount: stepsCompleted,
      };
    }
    if (hasName && !hasSlots && !hasAnyRsvpSelected) {
      return {
        reminderMessage: t.nameWithoutSlotsBanner(),
        reminderStepCount: 1,
      };
    }
    if (!hasName && hasSlots) {
      return {
        reminderMessage: t.rsvpWithoutNameBanner(),
        reminderStepCount: 1,
      };
    }
    return {
      reminderMessage: t.readyToSubmitBanner(),
      reminderStepCount: 2,
    };
  }, [trimmedVoterName, selectedSlotCount, hasAnyRsvpSelected, t]);

  const [selectedStartHour, selectedEndHour] = bookingTime.split('-');
  const activeStartHour = parseHourValue(selectedStartHour || '17:00');
  const minStartForSelectedDate = getMinStartHourForDate(
    bookingDate,
    todayJstDateKey,
    currentJstHour
  );
  const isSelectedDateClosedForNew =
    bookingDate === todayJstDateKey && minStartForSelectedDate >= 21;
  const isSelectedStartPast = activeStartHour < minStartForSelectedDate;
  const activeMap = viewingResponsesMap || responses;
  const hasBookingForSelectedDate = Boolean(
    bookingDate && bookedSessionsByDate[bookingDate]
  );
  const inspectedAttendees = inspectGoingSession
    ? attendeesByDate[inspectGoingSession.day.dateKey] || []
    : [];
  const inspectedYesList = inspectedAttendees.filter(
    (row) => row.status !== 'maybe'
  );
  const inspectedMaybeList = inspectedAttendees.filter(
    (row) => row.status === 'maybe'
  );

  const renderBookingFormFields = ({
    showDuplicateWarning = false,
    includePlaceholderOption = false,
    lockDateField = false,
    enforcePastTimeGuard = false,
  } = {}) => (
    <div className="space-y-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 overflow-hidden">
      <div className="min-w-0 overflow-hidden">
        <label className="block text-[11px] font-extrabold text-slate-600 mb-1">
          {isJa ? '日付' : 'Date'}
        </label>
        <input
          type="date"
          value={bookingDate}
          min={enforcePastTimeGuard ? todayJstDateKey : undefined}
          disabled={lockDateField}
          onChange={(e) => handleBookingDateChange(e.target.value)}
          className="block w-full max-w-full min-w-0 box-border px-2.5 py-2 rounded-lg border border-slate-300 bg-white disabled:bg-slate-100 font-bold text-slate-800 text-xs appearance-none"
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
        <label className="block text-[11px] font-extrabold text-slate-600 mb-1">
          {isJa ? '時間' : 'Time'}
        </label>
        <div className="flex items-center gap-1.5 min-w-0">
          <select
            aria-label="Start time"
            value={selectedStartHour || '17:00'}
            onChange={(e) => handleStartTimeChange(e.target.value)}
            translate="no"
            className="flex-1 min-w-0 px-2.5 py-2 rounded-lg border border-slate-300 bg-white font-bold text-slate-800 text-xs cursor-pointer"
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
            onChange={(e) => handleEndTimeChange(e.target.value)}
            translate="no"
            className="flex-1 min-w-0 px-2.5 py-2 rounded-lg border border-slate-300 bg-white font-bold text-slate-800 text-xs cursor-pointer"
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
          className="block text-[11px] font-extrabold text-slate-600 mb-1"
        >
          {isJa ? '会場' : 'Venue'}
        </label>
        <div className="relative">
          <select
            id="confirmed-venue-select"
            value={selectedBookingVenueId}
            onChange={(e) => handleBookingVenueSelect(e.target.value)}
            className="w-full appearance-none box-border px-3 py-2 pr-8 rounded-lg border border-slate-300 bg-white font-bold text-slate-800 text-xs cursor-pointer"
          >
            {includePlaceholderOption && (
              <option value="">{t.selectVenuePlaceholder}</option>
            )}
            {VENUES.map((venue) => (
              <option key={venue.id} value={venue.id}>
                [{venue.courtType === 'outdoor'
                  ? t.outdoorShort
                  : t.indoorShort}] {venue.fullName}
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
            <label className="block text-[11px] font-extrabold text-slate-600 mb-1">
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
              className="w-full min-w-0 box-border px-3 py-2 rounded-lg border border-slate-300 bg-white font-bold text-slate-800 text-xs"
            />
          </div>

          <div className="min-w-0">
            <label className="block text-[11px] font-extrabold text-slate-600 mb-1">
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
              className="w-full min-w-0 box-border px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs"
            />
          </div>
        </>
      )}

      {isOtherVenue && (
        <div className="flex items-center justify-start pt-1">
          <div className="inline-flex rounded-lg bg-white p-0.5 border border-slate-300 font-extrabold text-[11px] shrink-0">
            <button
              type="button"
              onClick={() => {
                setHasCustomizedBooking(true);
                setBookingCourtType('indoor');
              }}
              className={`px-2.5 py-1 rounded cursor-pointer ${
                bookingCourtType === 'indoor'
                  ? 'bg-sky-100 text-sky-900'
                  : 'text-slate-500'
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
                  ? 'bg-amber-100 text-amber-900'
                  : 'text-slate-500'
              }`}
            >
              {isJa ? '屋外' : 'Outdoor'}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#eef2f6] text-slate-900 pb-16 font-sans selection:bg-lime-300 selection:text-slate-950">
      {!viewingVote && hasSelectionProgress && (
        <FloatingStepReminderBanner
          message={reminderMessage}
          stepCount={reminderStepCount}
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
                  <span className="px-2 py-0.5 rounded bg-lime-400 text-[#1B365D] text-[11px] font-extrabold tracking-tight whitespace-nowrap">
                    {t.badgeIntegrated(VENUES.length)}
                  </span>
                  {hasLiveAvailability ? (
                    <span
                      translate={isJa ? undefined : 'no'}
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/10 text-[10px] text-lime-200 font-semibold whitespace-nowrap"
                    >
                      <RefreshCw className="w-2.5 h-2.5 shrink-0" />
                      <span>
                        yoyacool({lastSyncedAt.yoyacool || '同期済'}) /
                        Spacepad({lastSyncedAt.spacepad || '同期済'})
                      </span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-400/20 text-[10px] text-amber-200 font-semibold">
                      {t.syncedWaiting}
                    </span>
                  )}
                </div>

                <h1 className="text-base sm:text-xl font-extrabold tracking-tight text-white mt-0.5">
                  {t.appTitle}
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
                className="inline-flex rounded-xl bg-white/10 p-0.5 border border-white/20 text-xs font-extrabold whitespace-nowrap"
                title="Synced with browser language; toggle JA or EN to override"
              >
                <button
                  type="button"
                  onClick={() => setLang('ja')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition cursor-pointer ${
                    isJa
                      ? 'bg-lime-400 text-[#1B365D] shadow-xs'
                      : 'text-sky-100 hover:text-white'
                  }`}
                >
                  <Languages className="w-3.5 h-3.5 shrink-0" />
                  <span>JA</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLang('en')}
                  className={`px-2.5 py-1.5 rounded-lg transition cursor-pointer ${
                    !isJa
                      ? 'bg-white text-[#1B365D] shadow-xs'
                      : 'text-sky-100 hover:text-white'
                  }`}
                >
                  EN
                </button>
              </div>

              <button
                type="button"
                onClick={handleOpenShareModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-lime-400 hover:bg-lime-300 active:scale-95 text-[#1B365D] text-xs sm:text-sm font-extrabold shadow transition cursor-pointer whitespace-nowrap"
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
          <div className="bg-rose-50 border border-rose-300 text-rose-800 px-4 py-3 rounded-xl flex items-center gap-2 text-xs sm:text-sm">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <section
          ref={calendarSectionRef}
          className="bg-white rounded-2xl shadow-sm border border-slate-300 overflow-hidden"
        >
          <div className="bg-[#1B365D] px-3 py-2.5 flex flex-wrap items-center justify-between gap-2 text-white">
            <button
              type="button"
              disabled={activeWeekIdx === 0}
              onClick={() => setActiveWeekIdx((i) => Math.max(0, i - 1))}
              className="tactile-press active:scale-[0.97] inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#2B547E] hover:bg-[#366799] disabled:opacity-40 disabled:pointer-events-none text-xs font-extrabold border border-white/20 cursor-pointer whitespace-nowrap shrink-0"
            >
              <ChevronLeft className="w-4 h-4 shrink-0" />
            </button>

            <div className="text-center min-w-0">
              <div className="inline-block px-2.5 py-0.5 rounded-full bg-white/10 text-white/80 text-[11px] font-medium tracking-wide mb-0.5 whitespace-nowrap">
                {t.oneHourSubLabel}
              </div>
              <div
                translate={isJa ? undefined : 'no'}
                className="text-sm sm:text-base font-extrabold tracking-tight text-white tabular-nums"
              >
                {currentWeek.rangeLabel}
              </div>
            </div>

            <button
              type="button"
              disabled={activeWeekIdx === calendarWeeks.length - 1}
              onClick={() =>
                setActiveWeekIdx((i) =>
                  Math.min(calendarWeeks.length - 1, i + 1)
                )
              }
              className="tactile-press active:scale-[0.97] inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#2B547E] hover:bg-[#366799] disabled:opacity-40 disabled:pointer-events-none text-xs font-extrabold border border-white/20 cursor-pointer whitespace-nowrap shrink-0"
            >
              <ChevronRight className="w-4 h-4 shrink-0" />
            </button>
          </div>

          <div className="bg-[#f4f6f9] px-3 py-2.5 border-b border-slate-300 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {calendarWeeks.map((w, idx) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setActiveWeekIdx(idx)}
                  className={`tactile-press active:scale-[0.97] px-3 py-1.5 rounded-lg text-xs font-extrabold cursor-pointer border whitespace-nowrap tabular-nums ${
                    activeWeekIdx === idx
                      ? 'bg-[#1B365D] text-lime-300 border-[#1B365D] shadow-xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  <span translate={isJa ? undefined : 'no'}>
                    {w.shortTitle}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={handleOpenBookingModal}
                className="tactile-press active:scale-[0.97] inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-lime-300 font-extrabold text-xs border border-emerald-900 cursor-pointer whitespace-nowrap"
              >
                <CalendarCheck className="w-3.5 h-3.5 shrink-0" />
                <span>{t.bookSessionBtn}</span>
              </button>
              <button
                type="button"
                onClick={handleFillActiveWeekAll}
                className="tactile-press active:scale-[0.97] px-2.5 py-1.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-900 font-extrabold text-xs border border-emerald-300 cursor-pointer whitespace-nowrap"
              >
                {t.weekFillAll}
              </button>
              <button
                type="button"
                onClick={handleClearActiveWeek}
                className="tactile-press active:scale-[0.97] px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 font-extrabold text-xs border border-slate-300 cursor-pointer whitespace-nowrap"
              >
                {t.weekClearAll}
              </button>

              <div className="relative grid grid-cols-2 rounded-xl bg-slate-200 p-0.5 border border-slate-300 ml-1 overflow-hidden">
                <span
                  aria-hidden="true"
                  className={`segmented-thumb pointer-events-none absolute top-0.5 bottom-0.5 left-0.5 w-[calc(50%-2px)] rounded-lg shadow-xs ${
                    viewingVote
                      ? 'opacity-0'
                      : gridViewMode === 'heatmap'
                        ? 'translate-x-full bg-[#1B365D]'
                        : 'translate-x-0 bg-white'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => {
                    setViewingVote(null);
                    setGridViewMode('vote');
                  }}
                  className={`relative z-10 tactile-press active:scale-[0.97] inline-flex items-center justify-center gap-1 px-3 py-1 rounded-lg text-xs font-extrabold cursor-pointer whitespace-nowrap transition-colors ${
                    gridViewMode === 'vote' && !viewingVote
                      ? 'text-[#1B365D]'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Grid className="w-3.5 h-3.5 shrink-0" />
                  <span>{t.myVoteTab(null)}</span>
                </button>
                <button
                  type="button"
                  title={t.legendHint}
                  onClick={() => {
                    setViewingVote(null);
                    setGridViewMode('heatmap');
                  }}
                  className={`relative z-10 tactile-press active:scale-[0.97] inline-flex items-center justify-center gap-1 px-3 py-1 rounded-lg text-xs font-extrabold cursor-pointer whitespace-nowrap transition-colors ${
                    gridViewMode === 'heatmap' && !viewingVote
                      ? 'text-lime-300'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5 shrink-0" />
                  <span>{t.tallyTab}</span>
                </button>
              </div>

              {viewingVote ? (
                <div className="inline-flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleSelectVoterToEdit(viewingVote)}
                    className="tactile-press active:scale-[0.97] inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold border border-amber-500 shadow-xs cursor-pointer whitespace-nowrap"
                  >
                    <Edit3 className="w-3.5 h-3.5 shrink-0" />
                    <span>{t.editThisBtn}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewingVote(null)}
                    className="tactile-press active:scale-[0.97] inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-xs font-extrabold border border-sky-900 shadow-xs cursor-pointer whitespace-nowrap"
                  >
                    <X className="w-3.5 h-3.5 shrink-0" />
                    <span>{t.exitViewBtn}</span>
                  </button>
                </div>
              ) : editingVoteId ? (
                <button
                  type="button"
                  onClick={resetVoterForm}
                  className="tactile-press active:scale-[0.97] inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-800 text-xs font-extrabold border border-slate-300 shadow-xs cursor-pointer whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                  <span>{t.cancelBtn}</span>
                </button>
              ) : (
                <div className="relative">
                  <select
                    aria-label="Select player response to view"
                    disabled={!activeVotes.length}
                    value=""
                    onChange={(e) => {
                      const chosen = activeVotes.find(
                        (v) => String(v.id) === e.target.value
                      );
                      if (chosen) handleSelectVoterToView(chosen);
                    }}
                    className="appearance-none px-3 py-1.5 pr-8 rounded-lg bg-white disabled:opacity-50 border border-slate-300 text-xs font-extrabold text-[#1B365D] focus:border-[#1B365D] outline-none cursor-pointer max-w-[200px]"
                  >
                    <option value="">
                      {activeVotes.length
                        ? t.viewPlayerPlaceholder
                        : t.noVotesYet}
                    </option>
                    {activeVotes.map((v) => (
                      <option key={v.id} value={String(v.id)}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
                </div>
              )}
            </div>
          </div>

          <div className="px-3.5 py-2 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="inline-flex items-center gap-1 font-bold text-emerald-700 whitespace-nowrap">
                <span
                  translate="no"
                  className="w-4 h-4 rounded-full bg-emerald-100 border border-emerald-400 inline-flex items-center justify-center text-[10px] shrink-0"
                >
                  ◯
                </span>
                <span>{t.legendYes}</span>
              </span>
              <span className="inline-flex items-center gap-1 font-bold text-amber-700 whitespace-nowrap">
                <span
                  translate="no"
                  className="w-4 h-4 rounded-full bg-amber-100 border border-amber-400 inline-flex items-center justify-center text-[10px] shrink-0"
                >
                  △
                </span>
                <span>{t.legendMaybe}</span>
              </span>
              <span className="inline-flex items-center gap-1 font-bold text-rose-700 whitespace-nowrap">
                <span
                  translate="no"
                  className="w-4 h-4 rounded-full bg-rose-100 border border-rose-400 inline-flex items-center justify-center text-[10px] shrink-0"
                >
                  ✕
                </span>
                <span>{t.legendNo}</span>
              </span>
              <span className="inline-flex items-center gap-1 text-slate-500 whitespace-nowrap">
                <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 font-bold text-[10px]">
                  {t.legendFull}
                </span>
                <span>{t.legendFullDesc}</span>
              </span>
              <span className="inline-flex items-center gap-1 text-slate-600 whitespace-nowrap">
                <span className="px-1.5 py-0.5 rounded bg-slate-300/80 text-slate-700 font-bold text-[10px]">
                  {t.legendNo2h}
                </span>
                <span>{t.legendNo2hDesc}</span>
              </span>
              <span className="inline-flex items-center gap-1 text-slate-500 whitespace-nowrap">
                <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-300 text-slate-500 font-bold text-[10px]">
                  {t.legendClosed}
                </span>
                <span>{t.legendClosedDesc}</span>
              </span>
              <span className="inline-flex items-center gap-1 font-bold text-indigo-800 whitespace-nowrap">
                <span className="w-3.5 h-3.5 rounded bg-indigo-50 border-2 border-indigo-400 inline-block shrink-0" />
                <span>{t.legendRec2h}</span>
              </span>
              <span className="inline-flex items-center gap-1 text-amber-800 font-bold whitespace-nowrap">
                <span className="w-3.5 h-3.5 rounded bg-amber-100 border border-amber-400 inline-block shrink-0" />
                <span>{t.legendPrime}</span>
              </span>
            </div>
            {gridViewMode === 'heatmap' && !viewingVote && (
              <span className="font-bold text-[#1B365D] inline-flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span>{t.legendHint}</span>
              </span>
            )}
          </div>

          <div ref={tableScrollRef} className="overflow-x-auto">
            <table className="w-full border-collapse text-center">
              <thead>
                <tr className="bg-[#eef3f8] border-b-2 border-slate-300 text-slate-800">
                  <th className="sticky left-0 z-30 bg-[#dce5f0] py-2.5 px-2 min-w-[116px] sm:min-w-[140px] text-left text-xs font-extrabold text-[#1B365D] border-r border-slate-300 shadow-[4px_0_8px_-4px_rgba(15,23,42,0.08)] whitespace-nowrap">
                    {t.dateColHeader}
                  </th>
                  {TIME_BLOCKS.map((block) => (
                    <th
                      key={block.id}
                      title={block.label}
                      className={`py-2.5 px-1 min-w-[54px] sm:min-w-[78px] border-r border-slate-300 last:border-r-0 transition ${
                        block.isStudentPrime
                          ? 'bg-amber-100/90 border-b-2 border-b-amber-400'
                          : ''
                      }`}
                    >
                      <div
                        translate="no"
                        className="text-[11px] sm:text-xs font-extrabold text-[#1B365D] tracking-tight whitespace-nowrap tabular-nums"
                      >
                        {block.shortLabel}~
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-300">
                {currentWeek.days.map((day) => {
                  const bookedEntry = bookedSessionsByDate[day.dateKey];
                  if (bookedEntry) {
                    return (
                      <BookedSessionFullRowCard
                        key={day.dateKey}
                        day={day}
                        booking={bookedEntry}
                        attendees={attendeesByDate[day.dateKey] || []}
                        pendingRsvpByDate={pendingRsvpByDate}
                        activeAttendeeName={trimmedVoterName}
                        viewingVote={viewingVote}
                        viewportWidth={tableViewportWidth}
                        isJa={isJa}
                        t={t}
                        onToggleBookingAttendee={handleToggleBookingAttendee}
                        onInspectGoingTally={setInspectGoingSession}
                        onShareBooking={handleShareBookingCard}
                        onRequestClearBooking={openUnmarkBookingGuard}
                      />
                    );
                  }

                  // Block out the current JST date when unbooked using the same
                  // full-row sticky geometry as a confirmed session card.
                  if (day.dateKey === todayJstDateKey) {
                    return (
                      <NoBookingsTodayRowCard
                        key={day.dateKey}
                        day={day}
                        colSpan={TIME_BLOCKS.length + 1}
                        viewportWidth={tableViewportWidth}
                        isJa={isJa}
                        labelText={t.noBookingsTodayLabel}
                      />
                    );
                  }

                  const dateTextColor =
                    day.dayType === 'saturday'
                      ? 'text-blue-700'
                      : day.dayType === 'sunday' || day.dayType === 'holiday'
                        ? 'text-red-600'
                        : 'text-slate-900';
                  const dateBgColor =
                    day.dayType === 'saturday'
                      ? 'bg-[#EFF5FF]'
                      : day.dayType === 'sunday' || day.dayType === 'holiday'
                        ? 'bg-[#FFF5F5]'
                        : 'bg-white';
                  const activeWindowMode = dayWindowByDate[day.dateKey] || null;
                  const isFullyClosedDay =
                    day.allBooked &&
                    TIME_BLOCKS.every(
                      (b) =>
                        !day.slots[b.id]?.isOpen &&
                        !day.slots[b.id]?.isFullyBooked
                    );

                  const dayLabel = formatDayLabel(day, isJa);

                  return (
                    <tr
                      key={day.dateKey}
                      className="h-[96px] divide-x divide-slate-200"
                    >
                      <td
                        className={`sticky left-0 z-20 ${dateBgColor} h-[96px] px-2 py-1.5 text-left border-r border-slate-200 shadow-[4px_0_8px_-4px_rgba(15,23,42,0.08)] align-middle`}
                      >
                        <div className="flex items-center gap-1 flex-wrap">
                          <span
                            translate={isJa ? undefined : 'no'}
                            className={`text-sm sm:text-base font-extrabold underline decoration-slate-300 whitespace-nowrap tabular-nums ${dateTextColor}`}
                          >
                            {dayLabel}
                          </span>
                          {day.holiday && (
                            <span
                              translate="no"
                              className="inline-flex items-center justify-center w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-red-600 text-white text-[10px] sm:text-[11px] font-extrabold shrink-0"
                            >
                              {day.holiday}
                            </span>
                          )}
                        </div>
                        {day.allBooked ? (
                          <span className="inline-block mt-0.5 text-[10px] font-bold text-slate-400 leading-tight">
                            {isFullyClosedDay ? t.legendClosed : t.allBookedDay}
                          </span>
                        ) : (
                          <div
                            role="group"
                            aria-label={`${dayLabel} ${t.dateColHeader}`}
                            className="mt-1 inline-flex rounded-lg bg-white/95 border border-slate-300 divide-x divide-slate-300 text-[10px] font-extrabold overflow-hidden"
                          >
                            {[
                              { id: 'all', label: t.dayAllFree },
                              { id: 'afternoon', label: t.dayAfternoonOnly },
                              { id: 'evening', label: t.dayEveningOnly },
                            ].map((opt) => {
                              const hasEligible = TIME_BLOCKS.some((b) => {
                                const key = `${day.dateKey}_${b.id}`;
                                if (!twoHourEligibleSlotKeys.has(key)) {
                                  return false;
                                }
                                if (opt.id === 'afternoon') {
                                  return b.startHour < 18;
                                }
                                if (opt.id === 'evening') {
                                  return b.startHour >= 18;
                                }
                                return true;
                              });
                              const isDisabled =
                                Boolean(viewingVote) || !hasEligible;

                              return (
                                <button
                                  key={opt.id}
                                  type="button"
                                  disabled={isDisabled}
                                  onClick={() =>
                                    handleSelectDayWindow(day, opt.id)
                                  }
                                  className={`tactile-press px-2 py-1 whitespace-nowrap ${
                                    isDisabled
                                      ? 'opacity-35 cursor-not-allowed'
                                      : 'active:scale-[0.97] hover-surface-slate cursor-pointer'
                                  } ${
                                    activeWindowMode === opt.id
                                      ? 'bg-[#1B365D] text-lime-300'
                                      : 'text-slate-600'
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </td>

                      {isFullyClosedDay ? (
                        <td
                          colSpan={TIME_BLOCKS.length}
                          title={t.closedTitle}
                          className="h-[96px] bg-slate-100/75 px-4 align-middle text-left select-none cursor-not-allowed"
                        >
                          <div className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400">
                            <span translate="no">—</span>
                            <span>{t.closedDayRow}</span>
                          </div>
                        </td>
                      ) : (
                        TIME_BLOCKS.map((block) => {
                          const cellData = day.slots[block.id];

                          if (!cellData?.isOpen) {
                            const isBooked = Boolean(cellData?.isFullyBooked);
                            return (
                              <td
                                key={block.id}
                                title={isBooked ? t.bookedTitle : t.closedTitle}
                                className={`${
                                  isBooked
                                    ? 'bg-slate-100/75'
                                    : 'bg-slate-100/90'
                                } h-[96px] px-0.5 align-middle select-none cursor-not-allowed`}
                              >
                                <div className="h-full flex flex-col items-center justify-center gap-0.5 max-w-[74px] mx-auto leading-tight text-slate-400">
                                  <span
                                    translate="no"
                                    className="text-xs font-extrabold leading-none"
                                  >
                                    {isBooked ? '✕' : '—'}
                                  </span>
                                  <span
                                    className={`text-[10px] text-center break-words line-clamp-2 ${
                                      isBooked ? 'font-semibold' : 'font-medium'
                                    }`}
                                  >
                                    {isBooked ? t.legendFull : t.legendClosed}
                                  </span>
                                </div>
                              </td>
                            );
                          }

                          const slotKey = `${day.dateKey}_${block.id}`;

                          if (!twoHourEligibleSlotKeys.has(slotKey)) {
                            return (
                              <td
                                key={block.id}
                                onClick={() => handleCycleSlot(slotKey)}
                                title={t.no2hTitle}
                                className="bg-slate-200/70 h-[96px] px-0.5 align-middle select-none cursor-not-allowed"
                              >
                                <div className="h-full flex flex-col items-center justify-center gap-0.5 text-slate-500 max-w-[74px] mx-auto leading-tight">
                                  <span
                                    translate="no"
                                    className="text-xs font-extrabold leading-none"
                                  >
                                    —
                                  </span>
                                  <span className="text-[10px] font-bold text-center break-words line-clamp-2">
                                    {t.legendNo2h}
                                  </span>
                                </div>
                              </td>
                            );
                          }

                          const activeChoice = activeMap[slotKey];
                          const twoHourInfo = twoHourHighlightMap[slotKey];
                          const tally = slotTallies[slotKey] || {
                            yesCount: 0,
                            maybeCount: 0,
                            noCount: 0,
                            isTopPick: false,
                          };
                          const showTallyDetails =
                            gridViewMode === 'heatmap' && !viewingVote;

                          const isPrioritySpan = Boolean(
                            twoHourInfo?.isPriorityTwoHour
                          );
                          const isPriorityCapsule =
                            isPrioritySpan &&
                            !(showTallyDetails && tally.isTopPick);
                          const isPriorityStart =
                            isPriorityCapsule &&
                            twoHourInfo.priorityPosition === 'start';

                          let cellBg = isPriorityCapsule
                            ? ''
                            : block.isStudentPrime
                              ? 'bg-amber-50/45 [--slot-hover-bg:rgb(254_243_199_/_0.8)]'
                              : 'bg-white [--slot-hover-bg:rgb(240_249_255)]';

                          if (showTallyDetails) {
                            if (tally.yesCount >= 6) {
                              cellBg =
                                'bg-emerald-200/90 [--slot-hover-bg:rgb(167_243_208)]';
                            } else if (tally.yesCount >= 3) {
                              cellBg =
                                'bg-emerald-100/80 [--slot-hover-bg:rgb(209_250_229)]';
                            } else if (tally.yesCount >= 1) {
                              cellBg =
                                'bg-lime-50 [--slot-hover-bg:rgb(236_252_203)]';
                            } else {
                              cellBg =
                                'bg-slate-50/70 [--slot-hover-bg:rgb(241_245_249)]';
                            }
                          } else if (!isPriorityCapsule && activeChoice === 'yes') {
                            cellBg =
                              'bg-emerald-50/90 [--slot-hover-bg:rgb(209_250_229_/_0.8)]';
                          } else if (!isPriorityCapsule && activeChoice === 'maybe') {
                            cellBg =
                              'bg-amber-50/90 [--slot-hover-bg:rgb(254_243_199_/_0.8)]';
                          } else if (!isPriorityCapsule && activeChoice === 'no') {
                            cellBg =
                              'bg-rose-50/80 [--slot-hover-bg:rgb(255_228_230_/_0.7)]';
                          }

                          const topPickRing =
                            showTallyDetails && tally.isTopPick
                              ? 'ring-2 ring-inset ring-amber-400'
                              : '';

                          return (
                            <td
                              key={block.id}
                              className={`relative p-1 h-[96px] align-middle transition-colors ${
                                isPriorityCapsule
                                  ? 'priority-cell'
                                  : 'slot-cell-hover'
                              } ${cellBg} ${topPickRing}`}
                            >
                              {isPriorityStart && (
                                <div
                                  aria-hidden="true"
                                  className="pointer-events-none absolute top-[3px] bottom-[3px] left-[3px] w-[calc(200%-6px)] rounded-lg border-[1.5px] border-indigo-400/90 bg-indigo-500/[0.06] z-[5]"
                                />
                              )}
                              {isPriorityCapsule && (
                                <div
                                  aria-hidden="true"
                                  className={`priority-cell-hover-layer pointer-events-none absolute top-[3px] bottom-[3px] z-[6] transition-colors duration-150 ease-out ${
                                    twoHourInfo.priorityPosition === 'start'
                                      ? 'left-[3px] right-0 rounded-l-lg'
                                      : 'left-0 right-[3px] rounded-r-lg'
                                  }`}
                                />
                              )}
                              <div className="relative z-10 h-full w-full flex flex-col items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleCycleSlot(slotKey)}
                                  className={`tactile-press w-full h-full min-h-[34px] sm:min-h-[38px] max-w-full px-0.5 rounded-xl flex items-center justify-center ${
                                    viewingVote
                                      ? 'cursor-default'
                                      : 'active:scale-[0.97] cursor-pointer'
                                  }`}
                                  title={
                                    viewingVote
                                      ? t.viewingCellTitle(viewingVote.name)
                                      : `${dayLabel} ${block.label} · ${cellData.summaryText}`
                                  }
                                >
                                  {showTallyDetails ? (
                                    <div
                                      translate="no"
                                      className="flex flex-col items-center justify-center leading-tight whitespace-nowrap tabular-nums"
                                    >
                                      <div className="text-sm font-extrabold text-[#1B365D]">
                                        ◯ {tally.yesCount}
                                      </div>
                                      <div className="text-sm font-bold text-amber-700">
                                        △ {tally.maybeCount}
                                      </div>
                                    </div>
                                  ) : (
                                    <span
                                      translate="no"
                                      className="w-full h-full flex items-center justify-center"
                                    >
                                      <SlotChoiceCircle
                                        choice={activeChoice}
                                        isViewing={Boolean(viewingVote)}
                                      />
                                    </span>
                                  )}
                                </button>

                                {showTallyDetails && (
                                  <button
                                    type="button"
                                    onClick={() => setInspectSlot(tally)}
                                    className="tactile-press active:scale-[0.97] w-full py-0.5 px-1 rounded bg-slate-100/90 hover:bg-[#1B365D] hover:text-white text-[10px] font-extrabold text-slate-700 flex items-center justify-center gap-1 border border-slate-200 cursor-pointer whitespace-nowrap"
                                    title={cellData.summaryText}
                                  >
                                    <span>{t.detailsLabel}</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          );
                        })
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

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
                    openDeleteVoteGuard({ id: editingVoteId, name: voterName })
                  }
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-rose-600 text-white hover:bg-rose-700 cursor-pointer whitespace-nowrap"
                >
                  <Trash2 className="w-3 h-3 shrink-0" />
                  <span>{t.deleteBtn}</span>
                </button>
                <button
                  type="button"
                  onClick={resetVoterForm}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white text-slate-800 border border-slate-300 hover:bg-slate-100 cursor-pointer whitespace-nowrap"
                >
                  <RotateCcw className="w-3 h-3 shrink-0" />
                  <span>{t.cancelBtn}</span>
                </button>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmitVote} className="p-3.5 sm:p-4">
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
                    onClick={() => setShowEditPickerModal(true)}
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

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          <section className="lg:col-span-7 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 bg-[#1B365D] text-white flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Trophy className="w-4 h-4 text-lime-300 shrink-0" />
                <h2 className="font-extrabold text-xs sm:text-sm">
                  {t.top5Title}
                </h2>
              </div>
              <span className="text-[11px] text-sky-200 whitespace-nowrap shrink-0">
                {t.top5Subtitle}
              </span>
            </div>

            <div className="p-3.5 space-y-2">
              {loadingVotes ? (
                <p className="text-xs text-slate-500 py-4 text-center">
                  {t.loadingVotes}
                </p>
              ) : !rankedTwoHourBlocks.length ? (
                <div className="text-center py-6 text-xs text-slate-500 space-y-1">
                  <p className="font-bold text-slate-700">
                    {t.noRankedBlocksTitle}
                  </p>
                  <p>{t.noRankedBlocksDesc}</p>
                </div>
              ) : (
                rankedTwoHourBlocks.map((block, index) => {
                  const extraParts = [
                    block.openVenues.length > 1
                      ? t.moreVenues(block.openVenues.length - 1).replace(/^\+/, '')
                      : '',
                    block.alternativeTwoHourBlock
                      ? isJa
                        ? '別時間帯あり'
                        : 'Alt time'
                      : '',
                  ].filter(Boolean);

                  return (
                    <div
                      key={block.dateKey}
                      onClick={() => setInspectSlot(block)}
                      className={`tactile-press active:scale-[0.99] p-3 rounded-xl border flex flex-wrap items-center justify-between gap-2 cursor-pointer ${
                        index === 0
                          ? 'bg-emerald-50/70 hover-surface-emerald border-emerald-400'
                          : 'bg-slate-50 hover-surface-slate border-slate-200'
                      }`}
                    >
                      <div className="flex items-start sm:items-center gap-2.5 flex-1 min-w-0">
                        <span
                          translate="no"
                          className={`w-6 h-6 rounded-full text-xs font-extrabold flex items-center justify-center shrink-0 mt-0.5 sm:mt-0 tabular-nums ${
                            index === 0
                              ? 'bg-[#1B365D] text-lime-300'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs sm:text-sm font-extrabold text-slate-900 leading-snug tabular-nums">
                            <span translate="no">
                              {formatDayLabel(block, isJa)}
                              {block.holiday && isJa ? `・${block.holiday}` : ''}
                            </span>{' '}
                            <span
                              translate="no"
                              className="text-[#1B365D] whitespace-nowrap"
                            >
                              {block.timeLabel}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-600 flex flex-wrap items-center gap-1.5 mt-1">
                            <span translate="no" className="font-bold text-[#1B365D]">
                              {t.firstChoice(
                                block.recommendedVenues[0]?.shortName
                              )}
                            </span>
                            {extraParts.length > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-200/75 text-slate-600 font-semibold text-[10px] whitespace-nowrap tabular-nums">
                                {extraParts.join('・')}
                              </span>
                            )}
                            {block.isSweetSpot && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-200/75 text-slate-700 font-bold text-[10px] whitespace-nowrap tabular-nums">
                                {t.sweetSpotBadge}
                              </span>
                            )}
                            {block.isDoubleCourt && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-200/75 text-slate-700 font-bold text-[10px] whitespace-nowrap tabular-nums">
                                {t.doubleCourtBadge}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 tabular-nums">
                        <span
                          translate="no"
                          className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-900 font-extrabold text-xs border border-emerald-300 whitespace-nowrap"
                        >
                          {t.twoHourYesPill(block.bothYesCount)}
                        </span>
                        {block.flexBothCount + block.partialYesCount > 0 && (
                          <span
                            translate="no"
                            className="px-2 py-1 rounded-lg bg-amber-100 text-amber-900 font-bold text-xs border border-amber-300 whitespace-nowrap"
                          >
                            {t.flexPill(
                              block.flexBothCount + block.partialYesCount
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <section className="lg:col-span-5 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            <div className="px-4 py-3 bg-[#264673] text-white flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <MessageSquare className="w-4 h-4 text-lime-300 shrink-0" />
                <h2 className="font-extrabold text-xs sm:text-sm">
                  {t.notesTitle}
                </h2>
                {isNotesLockedForEdit && (
                  <span className="px-2 py-0.5 rounded bg-amber-300 text-slate-950 text-[10px] font-extrabold shrink-0 whitespace-nowrap">
                    {t.notesLockedBadge}
                  </span>
                )}
              </div>
              <span
                translate={isJa ? undefined : 'no'}
                className="text-[11px] text-sky-200 whitespace-nowrap shrink-0 tabular-nums"
              >
                {t.playerCountSuffix(activeVotes.length)}
              </span>
            </div>

            <div
              className={`p-3.5 space-y-2.5 max-h-[430px] overflow-y-auto flex-1 transition ${
                isNotesLockedForEdit ? 'bg-slate-100/70' : ''
              }`}
            >
              {!activeVotes.length ? (
                <p className="text-xs text-slate-400 italic py-6 text-center">
                  {t.noNotesYet}
                </p>
              ) : (
                <>
                  {activeVotes
                    .filter((v) => Boolean(String(v.note || '').trim()))
                    .map((v) => {
                      const isSelected = viewingVote?.id === v.id;
                      const previewTitle = isJa ? '投票を見る' : 'View votes';
                      return (
                        <button
                          key={v.id}
                          type="button"
                          disabled={isNotesLockedForEdit}
                          aria-disabled={isNotesLockedForEdit}
                          aria-pressed={isSelected}
                          title={previewTitle}
                          onClick={() => handleSelectVoterToView(v)}
                          className={`tactile-press w-full p-2.5 rounded-xl border flex items-start justify-between gap-2 text-left ${
                            isNotesLockedForEdit
                              ? 'bg-slate-100/90 border-slate-200/80 opacity-60 cursor-not-allowed'
                              : isSelected
                                ? 'active:scale-[0.97] bg-sky-50 border-sky-500 ring-2 ring-sky-400/40 cursor-pointer'
                                : 'active:scale-[0.97] bg-slate-50 hover-surface-sky border-slate-200 cursor-pointer'
                          }`}
                        >
                          <div className="min-w-0">
                            <div
                              translate="no"
                              className="text-xs font-extrabold text-[#1B365D]"
                            >
                              {v.name}
                            </div>
                            <p className="text-xs text-slate-600 mt-0.5 break-words">
                              {v.note}
                            </p>
                          </div>
                          <span
                            title={previewTitle}
                            className={`p-1 rounded-lg shrink-0 transition-colors ${
                              isSelected
                                ? 'bg-sky-600 text-white'
                                : 'text-slate-400'
                            }`}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </span>
                        </button>
                      );
                    })}

                  {activeVotes.some((v) => !String(v.note || '').trim()) && (
                    <div
                      className={
                        activeVotes.some((v) =>
                          Boolean(String(v.note || '').trim())
                        )
                          ? 'pt-2 border-t border-slate-200/80'
                          : ''
                      }
                    >
                      <div className="text-[10px] font-bold text-slate-400 mb-1.5">
                        {t.noNoteText}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {activeVotes
                          .filter((v) => !String(v.note || '').trim())
                          .map((v) => {
                            const isSelected = viewingVote?.id === v.id;
                            const previewTitle = isJa
                              ? '投票を見る'
                              : 'View votes';
                            return (
                              <button
                                key={v.id}
                                type="button"
                                disabled={isNotesLockedForEdit}
                                aria-disabled={isNotesLockedForEdit}
                                aria-pressed={isSelected}
                                title={previewTitle}
                                onClick={() => handleSelectVoterToView(v)}
                                className={`tactile-press inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-bold ${
                                  isNotesLockedForEdit
                                    ? 'bg-slate-100 border-slate-200 text-slate-400 opacity-60 cursor-not-allowed'
                                    : isSelected
                                      ? 'active:scale-[0.97] bg-sky-100 border-sky-500 text-sky-950 ring-2 ring-sky-400/40 cursor-pointer'
                                      : 'active:scale-[0.97] bg-slate-50 hover-surface-sky border-slate-200 text-[#1B365D] cursor-pointer'
                                }`}
                              >
                                <span translate="no">{v.name}</span>
                                <Eye
                                  className={`w-3 h-3 shrink-0 ${
                                    isSelected
                                      ? 'text-sky-700'
                                      : 'text-slate-400'
                                  }`}
                                />
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {activeVotes.length > 0 && !isNotesLockedForEdit && (
              <div className="px-3.5 py-2 border-t border-slate-200/80 bg-slate-50/70 text-[11px] text-slate-500 flex items-center gap-1.5">
                <Eye className="w-3 h-3 text-slate-400 shrink-0" />
                <span>{t.notesTapHint}</span>
              </div>
            )}
          </section>
        </div>

        <footer className="bg-white border border-slate-200 rounded-2xl p-3.5 text-[11px] sm:text-xs text-slate-600 space-y-2.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-extrabold text-slate-800 inline-flex items-center gap-1.5 tabular-nums">
                <Info className="w-4 h-4 text-[#1B365D] shrink-0" />
                <span>{t.directoryTitle(VENUES.length)}</span>
              </span>
              <button
                type="button"
                onClick={() => setShowVenueList((prev) => !prev)}
                aria-expanded={showVenueList}
                className="tactile-press active:scale-[0.97] inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover-surface-slate-200 text-[#1B365D] font-extrabold text-xs border border-slate-300 cursor-pointer whitespace-nowrap"
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
                  className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold shrink-0 whitespace-nowrap ${
                        v.courtType === 'outdoor'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-sky-100 text-sky-800'
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
                      className="font-bold text-slate-800 hover:text-[#1B365D] underline truncate"
                    >
                      {v.fullName}
                    </a>
                  </div>
                  <a
                    href={v.bookingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 text-[#1B365D] font-extrabold underline shrink-0 whitespace-nowrap"
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
        open={showBookingModal}
        mode="create"
        onClose={() => setShowBookingModal(false)}
        onSubmit={handleSaveBookedSessionRow}
        isSavingBooking={isSavingBooking}
        canSubmit={
          !hasBookingForSelectedDate &&
          Boolean(selectedBookingVenueId) &&
          !isSelectedDateClosedForNew &&
          !isSelectedStartPast
        }
        formFields={renderBookingFormFields({
          showDuplicateWarning: true,
          includePlaceholderOption: true,
          enforcePastTimeGuard: true,
        })}
        t={t}
      />

      <BookingFormModal
        open={showEditBookingModal}
        mode="edit"
        onClose={() => {
          setShowEditBookingModal(false);
          setEditingBookingDateKey('');
        }}
        onSubmit={handleSaveEditedBooking}
        isSavingBooking={isSavingBooking}
        canSubmit={Boolean(selectedBookingVenueId)}
        formFields={renderBookingFormFields({ lockDateField: true })}
        t={t}
      />

      <SlotInspectModal
        inspectSlot={inspectSlot}
        onSelectSlot={setInspectSlot}
        onClose={() => setInspectSlot(null)}
        viewingVote={viewingVote}
        t={t}
      />

      <EditPickerModal
        open={showEditPickerModal}
        activeVotes={activeVotes}
        onSelectVoter={handleSelectVoterToEdit}
        onClose={() => setShowEditPickerModal(false)}
        t={t}
      />

      <ShareInviteModal
        open={showShareModal}
        canEditBooking={Boolean(shareModalBooking || closestBookedSession)}
        onOpenEditBooking={handleOpenEditBookingFromShare}
        bookingFormat={bookingFormat}
        onChangeFormat={(nextFormat) => {
          setHasCustomizedBooking(true);
          setBookingFormat(nextFormat);
        }}
        confirmedBookingText={confirmedBookingText}
        textareaRef={textareaRef}
        copiedShare={copiedShare}
        onCopyShareText={handleCopyShareText}
        onClose={() => setShowShareModal(false)}
        t={t}
      />

      <ConfirmKeywordModal
        open={Boolean(bookingToUnmark)}
        title={t.unmarkModalTitle}
        body={
          bookingToUnmark
            ? t.unmarkModalBody(
                bookingToUnmark.label,
                bookingToUnmark.venueLabel
              )
            : ''
        }
        keyword={t.deleteKeyword}
        keywordHint={t.deleteKeywordHint(t.deleteKeyword)}
        keywordPlaceholder={t.deleteKeywordPlaceholder(t.deleteKeyword)}
        confirmInput={unmarkConfirmInput}
        onConfirmInputChange={setUnmarkConfirmInput}
        onCancel={() => {
          setBookingToUnmark(null);
          setUnmarkConfirmInput('');
        }}
        onConfirm={handleConfirmClearBooking}
        cancelLabel={t.cancelBtn}
        confirmLabel={t.confirmUnmarkBtn}
        tone="amber"
      />

      <ConfirmKeywordModal
        open={Boolean(voteToDelete)}
        title={t.deleteModalTitle}
        body={voteToDelete ? t.deleteModalBody(voteToDelete.name) : ''}
        keyword={t.deleteKeyword}
        keywordHint={t.deleteKeywordHint(t.deleteKeyword)}
        keywordPlaceholder={t.deleteKeywordPlaceholder(t.deleteKeyword)}
        confirmInput={deleteConfirmInput}
        onConfirmInputChange={setDeleteConfirmInput}
        onCancel={() => {
          setVoteToDelete(null);
          setDeleteConfirmInput('');
        }}
        onConfirm={handleConfirmDeleteVote}
        cancelLabel={t.cancelBtn}
        confirmLabel={t.confirmDeleteBtn}
        tone="rose"
      />
    </div>
  );
}