import { useCallback, useMemo, useRef, useState } from 'react';
import { VENUE_BY_ID } from '../config/venues';
import {
  MANUAL_VENUE_ID,
  OTHER_VENUE_OPTION,
  formatConfirmedSessionInvite,
  normalizeCourtType,
} from '../utils/confirmedInvite';
import {
  formatHourSlot,
  getMinStartHourForDate,
  parseHourValue,
} from '../utils/jst';
import {
  adjustBookingEndForStart,
  buildBookingPayloadFromForm,
  clampBookingEndTime,
  clampBookingTimeForDate,
} from '../domain/bookingForm';
import { findAttendeesAvailableForSession } from '../domain/schedule';
import {
  clearBookedSessionCascade,
  createBookedSession,
  resolveBookingVenueLabel,
  updateBookedSession,
} from '../services/schedulerRepository';

/** Parses `YYYY-MM-DD` as UTC midnight ms for timezone-safe day-diff math. */
function isoDateToUtcMs(dateKey) {
  return Date.parse(`${dateKey}T00:00:00Z`);
}

/**
 * Encapsulates confirmed-session booking form state, share invite modal state,
 * booking create/edit/unmark Supabase mutations, and clipboard copy logic.
 */
export function useBookingForm({
  todayJstDateKey,
  currentJstHour,
  minTodayStartHour,
  bookedSessionsByDate,
  setBookedSessionsByDate,
  setAttendeesByDate,
  setPendingRsvpByDate,
  votes,
  refreshVotesAndAttendees,
  calendarSectionRef,
  triggerToast,
  t,
}) {
  const [isSavingBooking, setIsSavingBooking] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareModalBooking, setShareModalBooking] = useState(null);
  const [showEditBookingModal, setShowEditBookingModal] = useState(false);
  const [editingBookingDateKey, setEditingBookingDateKey] = useState('');

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
  const [copiedShare, setCopiedShare] = useState(false);
  const textareaRef = useRef(null);

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

  /** Opens the "Mark Session as Booked" modal with today's next valid 2h window. */
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

  /** Opens the Share Invite modal prefilled with the closest upcoming booking (or a blank custom form). */
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

  /** Updates an existing booked session and replaces its auto-seeded `session_attendees` roster. */
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

  /** Creates a new booked session row and auto-seeds matching `yes` voters into `session_attendees`. */
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

  const openUnmarkBookingGuard = useCallback((targetBooking) => {
    setUnmarkConfirmInput('');
    setBookingToUnmark(targetBooking);
  }, []);

  /** Deletes a booked session and its attendees after keyword confirmation. */
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
    setPendingRsvpByDate,
  ]);

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

  /** Copies the generated invite text via Clipboard API, falling back to `textarea.select()`. */
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
  const hasBookingForSelectedDate = Boolean(
    bookingDate && bookedSessionsByDate[bookingDate]
  );

  return {
    isSavingBooking,
    showBookingModal,
    setShowBookingModal,
    showShareModal,
    setShowShareModal,
    shareModalBooking,
    showEditBookingModal,
    setShowEditBookingModal,
    setEditingBookingDateKey,
    bookingDate,
    selectedStartHour,
    selectedEndHour,
    activeStartHour,
    minStartForSelectedDate,
    isSelectedDateClosedForNew,
    isSelectedStartPast,
    hasBookingForSelectedDate,
    selectedBookingVenueId,
    isOtherVenue,
    customBookingVenue,
    setCustomBookingVenue,
    customBookingMapUrl,
    setCustomBookingMapUrl,
    bookingCourtType,
    setBookingCourtType,
    bookingFormat,
    setBookingFormat,
    setHasCustomizedBooking,
    bookingToUnmark,
    setBookingToUnmark,
    unmarkConfirmInput,
    setUnmarkConfirmInput,
    closestBookedSession,
    confirmedBookingText,
    copiedShare,
    textareaRef,
    handleOpenBookingModal,
    handleOpenShareModal,
    handleShareBookingCard,
    handleOpenEditBookingFromShare,
    handleSaveEditedBooking,
    handleSaveBookedSessionRow,
    openUnmarkBookingGuard,
    handleConfirmClearBooking,
    handleBookingDateChange,
    handleStartTimeChange,
    handleEndTimeChange,
    handleBookingVenueSelect,
    handleCopyShareText,
  };
}
