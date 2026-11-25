import { useCallback, useEffect, useRef, useState } from 'react';
import { normalizeSessionDateKey } from '../utils/jst.js';
import {
  fetchBookedSessions,
  fetchCourtAvailability,
  fetchSessionAttendees,
  fetchVotes,
  normalizeBookedRow,
  subscribeToSchedulerRealtime,
} from '../services/schedulerRepository.js';

/**
 * Loads initial scheduler data (votes, bookings, attendees, court availability)
 * and keeps it live via Supabase Realtime subscriptions.
 *
 * @param {string} supabaseErrorMessage - Localized fallback error shown when fetches fail.
 */
export function useSchedulerData(supabaseErrorMessage) {
  // Keep latest localized error message in a ref so toggling language does not
  // tear down and re-subscribe the realtime channels.
  const errorMessageRef = useRef(supabaseErrorMessage);

  useEffect(() => {
    errorMessageRef.current = supabaseErrorMessage;
  }, [supabaseErrorMessage]);

  const [votes, setVotes] = useState([]);
  const [loadingVotes, setLoadingVotes] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [openVenuesBySlot, setOpenVenuesBySlot] = useState({});
  const [bookedVenuesBySlot, setBookedVenuesBySlot] = useState({});
  const [lastSyncedAt, setLastSyncedAt] = useState({
    yoyacool: '',
    spacepad: '',
  });
  const [bookedSessionsByDate, setBookedSessionsByDate] = useState({});
  const [attendeesByDate, setAttendeesByDate] = useState({});

  const refreshVotes = useCallback(async () => {
    const { votes: nextVotes, error } = await fetchVotes();
    if (error) {
      console.error('Supabase fetch error:', error);
      setErrorMsg(errorMessageRef.current);
    } else {
      setErrorMsg('');
      setVotes(nextVotes);
    }
    setLoadingVotes(false);
  }, []);

  const refreshSessionAttendees = useCallback(async () => {
    const { attendeesByDate: grouped, error } = await fetchSessionAttendees();
    if (error) {
      console.error('Supabase session_attendees fetch error:', error);
      return;
    }
    if (grouped) setAttendeesByDate(grouped);
  }, []);

  const refreshVotesAndAttendees = useCallback(
    () => Promise.all([refreshVotes(), refreshSessionAttendees()]),
    [refreshVotes, refreshSessionAttendees]
  );

  useEffect(() => {
    let isCancelled = false;

    async function loadInitial() {
      const [votesRes, bookingsRes, attendeesRes, availabilityRes] =
        await Promise.all([
          fetchVotes(),
          fetchBookedSessions(),
          fetchSessionAttendees(),
          fetchCourtAvailability(),
        ]);

      if (isCancelled) return;

      if (votesRes.error) {
        console.error('Supabase fetch error:', votesRes.error);
        setErrorMsg(errorMessageRef.current);
      } else {
        setErrorMsg('');
        setVotes(votesRes.votes);
      }
      setLoadingVotes(false);

      if (bookingsRes.error) {
        console.error(
          'Supabase booked_sessions fetch error:',
          bookingsRes.error
        );
      } else if (bookingsRes.bookedSessionsByDate) {
        setBookedSessionsByDate(bookingsRes.bookedSessionsByDate);
      }

      if (attendeesRes.error) {
        console.error(
          'Supabase session_attendees fetch error:',
          attendeesRes.error
        );
      } else if (attendeesRes.attendeesByDate) {
        setAttendeesByDate(attendeesRes.attendeesByDate);
      }

      if (availabilityRes.hasData) {
        setOpenVenuesBySlot(availabilityRes.openVenuesBySlot);
        setBookedVenuesBySlot(availabilityRes.bookedVenuesBySlot);
        setLastSyncedAt(availabilityRes.lastSyncedAt);
      }
    }

    loadInitial();

    const unsubscribe = subscribeToSchedulerRealtime({
      onVotesChange: refreshVotes,
      onAttendeesChange: refreshSessionAttendees,
      onBookingEvent: (payload) => {
        if (isCancelled) return;
        if (payload.eventType === 'DELETE' && payload.old?.date_key) {
          const deletedDate = normalizeSessionDateKey(payload.old.date_key);
          setBookedSessionsByDate((prev) => {
            const next = { ...prev };
            delete next[deletedDate];
            return next;
          });
          return;
        }
        const normalized = normalizeBookedRow(payload.new);
        if (!normalized) return;
        setBookedSessionsByDate((prev) => ({
          ...prev,
          [normalized.dateKey]: normalized,
        }));
      },
    });

    return () => {
      isCancelled = true;
      unsubscribe();
    };
  }, [refreshVotes, refreshSessionAttendees]);

  return {
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
  };
}
