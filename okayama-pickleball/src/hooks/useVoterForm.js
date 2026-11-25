import { useCallback, useMemo, useState } from 'react';
import { normalizeResponsesMap } from '../utils/scheduler';
import {
  applyDayWindowToResponses,
  clearWeekResponses,
  cycleSlotChoice,
  fillWeekAllResponses,
} from '../domain/schedule';
import {
  deleteVoteCascade,
  saveVoteWithRsvps,
} from '../services/schedulerRepository';

/**
 * Encapsulates voter form state, read-only response inspection (`viewingVote`),
 * edit mode (`editingVoteId`), day/week quick-fill actions, and vote submit/delete.
 */
export function useVoterForm({
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
}) {
  const [dayWindowByDate, setDayWindowByDate] = useState({});
  const [pendingRsvpByDate, setPendingRsvpByDate] = useState({});
  const [voterName, setVoterName] = useState('');
  const [voterNote, setVoterNote] = useState('');
  const [responses, setResponses] = useState({});
  const [editingVoteId, setEditingVoteId] = useState(null);
  const [viewingVote, setViewingVote] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showEditPickerModal, setShowEditPickerModal] = useState(false);
  const [voteToDelete, setVoteToDelete] = useState(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');

  const viewingResponsesMap = useMemo(
    () => (viewingVote ? normalizeResponsesMap(viewingVote.responses) : null),
    [viewingVote]
  );

  const activeMap = viewingResponsesMap || responses;

  const resetVoterForm = useCallback(() => {
    setVoterName('');
    setVoterNote('');
    setResponses({});
    setPendingRsvpByDate({});
    setDayWindowByDate({});
    setEditingVoteId(null);
    setViewingVote(null);
  }, []);

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

  /** Cycles a 2h-eligible slot (`unset -> yes -> maybe -> no -> unset`), blocking non-2h slots. */
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

  // Guard against switching into read-only "view response" mode while actively
  // editing a voter's responses so unsaved grid edits are not overwritten.
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
    [editingVoteId, voterName, t, triggerToast, setGridViewMode, calendarSectionRef]
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
    [attendeesByDate, t, triggerToast, setGridViewMode, calendarSectionRef]
  );

  /** Validates voter name/selections and persists both `calendar_votes` and pending `session_attendees` RSVPs. */
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

  /** Deletes a voter's submission and cascades to their `session_attendees` rows after keyword confirmation. */
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

  return {
    dayWindowByDate,
    pendingRsvpByDate,
    setPendingRsvpByDate,
    voterName,
    setVoterName,
    voterNote,
    setVoterNote,
    editingVoteId,
    viewingVote,
    setViewingVote,
    activeMap,
    isSubmitting,
    showEditPickerModal,
    setShowEditPickerModal,
    voteToDelete,
    setVoteToDelete,
    deleteConfirmInput,
    setDeleteConfirmInput,
    selectedSlotCount,
    trimmedVoterName,
    hasSelectionProgress,
    isNotesLockedForEdit,
    showEditExistingButton,
    reminderMessage,
    reminderStepCount,
    resetVoterForm,
    handleToggleBookingAttendee,
    handleCycleSlot,
    handleSelectDayWindow,
    handleFillActiveWeekAll,
    handleClearActiveWeek,
    handleSelectVoterToView,
    handleSelectVoterToEdit,
    handleSubmitVote,
    openDeleteVoteGuard,
    handleConfirmDeleteVote,
  };
}
