/**
 * @fileoverview Okayama Pickleball Session Scheduler (`岡大dinks`) — Scalable Multi-Venue Edition
 * Coordinates group pickleball sessions across Okayama & Kurashiki gymnasiums and outdoor hardcourts.
 * Evaluates venue-level availability, prioritizes 19:00–21:00 > 18:00–20:00 > 20:00–22:00 2-hour blocks,
 * ranks Top 3 recommended courts per slot, and computes Top 5 consecutive 2-hour block bookings.
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  MapPin,
  Users,
  Trash2,
  Share2,
  Check,
  Edit3,
  Trophy,
  MessageSquare,
  X,
  Copy,
  RotateCcw,
  Info,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
  Sparkles,
  Grid,
  RefreshCw,
  ExternalLink,
  Award,
  UserCheck
} from 'lucide-react';
import { supabase } from './lib/supabase';
import { VENUES } from './config/venues';

// ============================================================================
// CONSTANTS & JST CALENDAR UTILITIES
// ============================================================================

const TIME_BLOCKS = [
  { id: '12:00-13:00', startHour: 12, label: '12:00–13:00', shortLabel: '12:00', isStudentPrime: false },
  { id: '13:00-14:00', startHour: 13, label: '13:00–14:00', shortLabel: '13:00', isStudentPrime: false },
  { id: '14:00-15:00', startHour: 14, label: '14:00–15:00', shortLabel: '14:00', isStudentPrime: false },
  { id: '15:00-16:00', startHour: 15, label: '15:00–16:00', shortLabel: '15:00', isStudentPrime: false },
  { id: '16:00-17:00', startHour: 16, label: '16:00–17:00', shortLabel: '16:00', isStudentPrime: false },
  { id: '17:00-18:00', startHour: 17, label: '17:00–18:00', shortLabel: '17:00', isStudentPrime: false },
  { id: '18:00-19:00', startHour: 18, label: '18:00–19:00', shortLabel: '18:00', isStudentPrime: true },
  { id: '19:00-20:00', startHour: 19, label: '19:00–20:00', shortLabel: '19:00', isStudentPrime: true },
  { id: '20:00-21:00', startHour: 20, label: '20:00–21:00', shortLabel: '20:00', isStudentPrime: true },
  { id: '21:00-22:00', startHour: 21, label: '21:00–22:00', shortLabel: '21:00', isStudentPrime: true }
];

const VENUE_BY_ID = Object.fromEntries(VENUES.map((v) => [v.id, v]));
const ACTIVE_VENUE_IDS = new Set(VENUES.map((v) => v.id));

const JP_DOW = ['日', '月', '火', '水', '木', '金', '土'];

const JP_HOLIDAYS = new Set([
  '2026-11-23',
  '2027-01-01',
  '2027-01-11',
  '2027-02-11',
  '2027-02-23',
  '2027-03-21',
  '2027-03-22',
  '2027-04-29',
  '2027-05-03',
  '2027-05-04',
  '2027-05-05'
]);

const RESPONSE_PRIORITY = { yes: 3, maybe: 2, no: 1 };

function getVenueFacilityTier(venue) {
  if (venue.courtType === 'indoor') return 3; // 1st: Indoor gym
  if (venue.hasLights) return 2; // 2nd: Outdoor with lights
  return 1; // 3rd: Outdoor without lights
}

/**
 * Ranks candidate venues (max 3) by:
 * 1. Adjacent open timeslot(s) at the same venue
 * 2. Indoor > Outdoor (lit) > Outdoor (no lights)
 * 3. Closest distance to JR Okayama Station
 */
function rankRecommendedVenues(candidateVenues, dateKey, targetHours, openVenuesBySlot, limit = 3) {
  const minHour = Math.min(...targetHours);
  const maxHour = Math.max(...targetHours);
  const prevHour = minHour - 1;
  const nextHour = maxHour + 1;

  const prevIds =
    prevHour >= 12
      ? openVenuesBySlot[`${dateKey}_${String(prevHour).padStart(2, '0')}:00-${String(prevHour + 1).padStart(2, '0')}:00`] || new Set()
      : new Set();
  const nextIds =
    nextHour <= 21
      ? openVenuesBySlot[`${dateKey}_${String(nextHour).padStart(2, '0')}:00-${String(nextHour + 1).padStart(2, '0')}:00`] || new Set()
      : new Set();

  return candidateVenues
    .map((v) => {
      const hasPrev = prevIds.has(v.id);
      const hasNext = nextIds.has(v.id);
      const adjacentCount = (hasPrev ? 1 : 0) + (hasNext ? 1 : 0);

      let continuousSpan = null;
      if (hasPrev && hasNext) {
        continuousSpan = `${prevHour}:00–${nextHour + 1}:00 連続空き`;
      } else if (hasPrev) {
        continuousSpan = `${prevHour}:00–${maxHour + 1}:00 連続空き`;
      } else if (hasNext) {
        continuousSpan = `${minHour}:00–${nextHour + 1}:00 連続空き`;
      }

      return {
        ...v,
        hasAdjacent: adjacentCount > 0,
        adjacentCount,
        continuousSpan,
        facilityTier: getVenueFacilityTier(v)
      };
    })
    .sort((a, b) => {
      if (b.hasAdjacent !== a.hasAdjacent) return Number(b.hasAdjacent) - Number(a.hasAdjacent);
      if (b.adjacentCount !== a.adjacentCount) return b.adjacentCount - a.adjacentCount;
      if (b.facilityTier !== a.facilityTier) return b.facilityTier - a.facilityTier;
      return (a.distanceKm ?? 99) - (b.distanceKm ?? 99);
    })
    .slice(0, limit);
}

function getJstDayMeta(offsetDays) {
  const now = new Date();
  const jstMs = now.getTime() + 9 * 60 * 60 * 1000 + offsetDays * 86400000;
  const d = new Date(jstMs);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  const dowIdx = d.getUTCDay();
  const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const isHoliday = JP_HOLIDAYS.has(dateKey);

  let dayType = 'weekday';
  if (isHoliday) dayType = 'holiday';
  else if (dowIdx === 6) dayType = 'saturday';
  else if (dowIdx === 0) dayType = 'sunday';

  return {
    dateKey,
    year,
    month,
    day,
    jpDate: `${month}月${day}日`,
    shortDate: `${month}/${day}`,
    dow: JP_DOW[dowIdx],
    dowIdx,
    holiday: isHoliday ? '祝' : '',
    dayType
  };
}

function getMergedVoterChoice(responsesMap, slotKey) {
  if (!responsesMap) return undefined;
  const direct = responsesMap[slotKey];
  const legacySp = responsesMap[`spacepad_1_3_${slotKey}`];
  if (!direct) return legacySp;
  if (!legacySp) return direct;
  return RESPONSE_PRIORITY[direct] >= RESPONSE_PRIORITY[legacySp] ? direct : legacySp;
}

function normalizeResponsesMap(rawResponses) {
  const normalized = {};
  if (!rawResponses) return normalized;

  for (const [key, val] of Object.entries(rawResponses)) {
    if (!val) continue;
    const cleanKey = key.startsWith('spacepad_1_3_')
      ? key.slice('spacepad_1_3_'.length)
      : key;
    const existing = normalized[cleanKey];
    if (!existing || RESPONSE_PRIORITY[val] > RESPONSE_PRIORITY[existing]) {
      normalized[cleanKey] = val;
    }
  }
  return normalized;
}

function PickleballIcon({ className = 'w-7 h-7' }) {
  return (
    <svg
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <circle
        cx="18"
        cy="18"
        r="16"
        fill="#D9F99D"
        stroke="#84CC16"
        strokeWidth="2"
      />
      <circle cx="12" cy="11" r="2.1" fill="#1E3A5F" />
      <circle cx="21" cy="9.5" r="2" fill="#1E3A5F" />
      <circle cx="26" cy="16" r="2.1" fill="#1E3A5F" />
      <circle cx="18" cy="18" r="2.3" fill="#1E3A5F" />
      <circle cx="10" cy="20" r="2.1" fill="#1E3A5F" />
      <circle cx="23" cy="25" r="2" fill="#1E3A5F" />
      <circle cx="14.5" cy="26.5" r="1.9" fill="#1E3A5F" />
    </svg>
  );
}

export default function App() {
  // Supabase Data State
  const [loadingVotes, setLoadingVotes] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [votes, setVotes] = useState([]);
  // Map of `${dateKey}_${timeRange}` -> Set<venueId> for status === 'open'
  const [openVenuesBySlot, setOpenVenuesBySlot] = useState({});
  // Map of `${dateKey}_${timeRange}` -> Set<venueId> for status === 'booked'
  const [bookedVenuesBySlot, setBookedVenuesBySlot] = useState({});
  const [lastSyncedAt, setLastSyncedAt] = useState({ yoyacool: '', spacepad: '' });

  // Week Navigation, Area/Venue Filter & Grid Display Modes
  const [activeWeekIdx, setActiveWeekIdx] = useState(0);
  const [areaFilter, setAreaFilter] = useState('all'); // 'all' | 'okayama' | 'kurashiki'
  const [venueFilter, setVenueFilter] = useState('all'); // 'all' | venue.id
  const [gridViewMode, setGridViewMode] = useState('vote'); // 'vote' | 'heatmap'
  const [highlightPrimeOnly, setHighlightPrimeOnly] = useState(false);

  // Voter Input, View-Only Inspection & Edit State
  const [voterName, setVoterName] = useState('');
  const [voterNote, setVoterNote] = useState('');
  const [responses, setResponses] = useState({});
  const [editingVoteId, setEditingVoteId] = useState(null);
  const [viewingVote, setViewingVote] = useState(null); // Read-only player inspection
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modals & Toast Notifications
  const [inspectSlot, setInspectSlot] = useState(null);
  const [showEditPickerModal, setShowEditPickerModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [voteToDelete, setVoteToDelete] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const [copiedShare, setCopiedShare] = useState(false);

  const voterBarRef = useRef(null);

  const triggerToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? '' : prev));
    }, 3200);
  };

  // Filtered venue dropdown options based on selected area
  const visibleVenues = useMemo(() => {
    if (areaFilter === 'all') return VENUES;
    return VENUES.filter((v) => v.area === areaFilter);
  }, [areaFilter]);

  const viewingResponsesMap = useMemo(() => {
    if (!viewingVote) return null;
    return normalizeResponsesMap(viewingVote.responses);
  }, [viewingVote]);

  // --------------------------------------------------------------------------
  // 1. FETCH VOTES & VENUE AVAILABILITY (open / booked / closed) FROM SUPABASE
  // --------------------------------------------------------------------------

  const fetchVotes = useCallback(async () => {
    const { data, error } = await supabase
      .from('calendar_votes')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Supabase fetch error:', error);
      setErrorMsg('Supabase接続エラー: .envとテーブル設定を確認してください。');
    } else {
      setErrorMsg('');
      setVotes(data || []);
    }
    setLoadingVotes(false);
  }, []);

  useEffect(() => {
    async function fetchAvailability() {
      const minDate = getJstDayMeta(0).dateKey;
      const pageSize = 1000;
      let from = 0;
      let allRows = [];

      while (true) {
        const { data, error } = await supabase
          .from('court_availability')
          .select('slot_date, time_range, court_detail, status, updated_at')
          .gte('slot_date', minDate)
          .range(from, from + pageSize - 1);

        if (error || !data || data.length === 0) break;
        allRows = allRows.concat(data);
        if (data.length < pageSize) break;
        from += pageSize;
      }

      if (allRows.length === 0) return;

      const openMap = {};
      const bookedMap = {};
      let latestYoyacool = '';
      let latestSpacepad = '';

      for (const row of allRows) {
        const venueId = row.court_detail;
        if (!ACTIVE_VENUE_IDS.has(venueId)) continue;

        const key = `${row.slot_date}_${row.time_range}`;
        if (row.status === 'open') {
          if (!openMap[key]) openMap[key] = new Set();
          openMap[key].add(venueId);
        } else if (row.status === 'booked') {
          if (!bookedMap[key]) bookedMap[key] = new Set();
          bookedMap[key].add(venueId);
        }

        const src = VENUE_BY_ID[venueId]?.source;
        if (src === 'yoyacool' && row.updated_at && row.updated_at > latestYoyacool) {
          latestYoyacool = row.updated_at;
        } else if (src === 'spacepad' && row.updated_at && row.updated_at > latestSpacepad) {
          latestSpacepad = row.updated_at;
        }
      }

      setOpenVenuesBySlot(openMap);
      setBookedVenuesBySlot(bookedMap);

      const fmtJst = (iso) =>
        iso
          ? new Date(iso).toLocaleString('ja-JP', {
              timeZone: 'Asia/Tokyo',
              month: 'numeric',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })
          : '';

      setLastSyncedAt({
        yoyacool: fmtJst(latestYoyacool),
        spacepad: fmtJst(latestSpacepad)
      });
    }

    fetchVotes();
    fetchAvailability();

    const channel = supabase
      .channel('calendar-votes-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'calendar_votes' },
        () => {
          fetchVotes();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchVotes]);

  // --------------------------------------------------------------------------
  // 2. BUILD UNIFIED 28-DAY (4-WEEK) CALENDAR
  // --------------------------------------------------------------------------

  const matchesFilter = useCallback(
    (openVenueIds) => {
      if (venueFilter !== 'all') {
        return openVenueIds.has(venueFilter);
      }
      if (areaFilter !== 'all') {
        for (const id of openVenueIds) {
          if (VENUE_BY_ID[id]?.area === areaFilter) return true;
        }
        return false;
      }
      return openVenueIds.size > 0;
    },
    [areaFilter, venueFilter]
  );

  const filterVenueList = useCallback(
    (venues) => {
      if (venueFilter !== 'all') return venues.filter((v) => v.id === venueFilter);
      if (areaFilter !== 'all') return venues.filter((v) => v.area === areaFilter);
      return venues;
    },
    [areaFilter, venueFilter]
  );

  const { calendarWeeks, allOpenSlots, hasLiveAvailability } = useMemo(() => {
    const hasLive =
      Object.keys(openVenuesBySlot).length > 0 ||
      Object.keys(bookedVenuesBySlot).length > 0;
    const days = [];

    for (let offset = 0; offset < 28; offset += 1) {
      const meta = getJstDayMeta(offset);
      const isWeekendOrHoliday =
        meta.dayType === 'saturday' ||
        meta.dayType === 'sunday' ||
        meta.dayType === 'holiday';

      const slots = {};
      let openCount = 0;

      TIME_BLOCKS.forEach((block) => {
        const key = `${meta.dateKey}_${block.id}`;
        const studentPrime = isWeekendOrHoliday || block.isStudentPrime;
        const openIds = openVenuesBySlot[key] || new Set();
        const bookedIds = bookedVenuesBySlot[key] || new Set();

        const filteredOpenVenues = filterVenueList(
          VENUES.filter((v) => openIds.has(v.id))
        );
        const filteredBookedVenues = filterVenueList(
          VENUES.filter((v) => bookedIds.has(v.id))
        );

        const isOpen = filteredOpenVenues.length > 0;
        const isFullyBooked = !isOpen && filteredBookedVenues.length > 0;

        if (isOpen) openCount += 1;

        slots[block.id] = {
          isOpen,
          isFullyBooked,
          openVenues: filteredOpenVenues,
          openVenueIds: new Set(filteredOpenVenues.map((v) => v.id)),
          summaryText: filteredOpenVenues.map((v) => v.shortName).join(' / '),
          studentPrime
        };
      });

      days.push({
        ...meta,
        allBooked: openCount === 0,
        slots
      });
    }

    const weeks = [0, 7, 14, 21].map((start, idx) => {
      const slice = days.slice(start, start + 7);
      return {
        id: `week${idx + 1}`,
        shortTitle: `Week ${idx + 1}: ${slice[0].shortDate}–${slice[6].shortDate}`,
        rangeLabel: `${slice[0].year}年 ${slice[0].jpDate}(${slice[0].dow}) 〜 ${slice[6].jpDate}(${slice[6].dow})`,
        days: slice
      };
    });

    const openSlots = [];
    weeks.forEach((week, weekIndex) => {
      week.days.forEach((day) => {
        TIME_BLOCKS.forEach((block) => {
          const cell = day.slots[block.id];
          if (cell && cell.isOpen) {
            openSlots.push({
              slotKey: `${day.dateKey}_${block.id}`,
              weekIndex,
              dateKey: day.dateKey,
              jpDate: day.jpDate,
              dow: day.dow,
              holiday: day.holiday || '',
              dayType: day.dayType,
              blockId: block.id,
              startHour: block.startHour,
              timeLabel: block.label,
              openVenues: cell.openVenues,
              openVenueIds: cell.openVenueIds,
              venueSummary: cell.summaryText,
              studentPrime: Boolean(cell.studentPrime)
            });
          }
        });
      });
    });

    return {
      calendarWeeks: weeks,
      allOpenSlots: openSlots,
      hasLiveAvailability: hasLive
    };
  }, [openVenuesBySlot, bookedVenuesBySlot, filterVenueList]);

  // Active voters who have at least 1 vote on a currently open slot
  const activeVotes = useMemo(() => {
    const openKeySet = new Set(allOpenSlots.map((s) => s.slotKey));
    return votes.filter((v) => {
      const normalized = normalizeResponsesMap(v.responses);
      return Object.keys(normalized).some((k) => openKeySet.has(k));
    });
  }, [votes, allOpenSlots]);

  // Highlight consecutive 2-hour blocks per day, prioritizing 19:00–21:00 > 18:00–20:00 > 20:00–22:00
  const twoHourHighlightMap = useMemo(() => {
    const cellMeta = {};

    const getTwoHourPreferenceRank = (startHour) => {
      if (startHour === 19) return 0; // 19:00–21:00
      if (startHour === 18) return 1; // 18:00–20:00
      if (startHour === 20) return 2; // 20:00–22:00
      return 3 + Math.abs(startHour - 19);
    };

    calendarWeeks.forEach((week) => {
      week.days.forEach((day) => {
        const candidates = [];

        for (let i = 0; i < TIME_BLOCKS.length - 1; i += 1) {
          const b1 = TIME_BLOCKS[i];
          const b2 = TIME_BLOCKS[i + 1];
          const key1 = `${day.dateKey}_${b1.id}`;
          const key2 = `${day.dateKey}_${b2.id}`;

          const ids1 = openVenuesBySlot[key1] || new Set();
          const ids2 = openVenuesBySlot[key2] || new Set();

          const shared = VENUES.filter((v) => ids1.has(v.id) && ids2.has(v.id));
          const filtered = filterVenueList(shared);
          if (filtered.length === 0) continue;

          const topVenue = rankRecommendedVenues(
            filtered,
            day.dateKey,
            [b1.startHour, b2.startHour],
            openVenuesBySlot,
            1
          )[0];

          candidates.push({
            key1,
            key2,
            spanLabel: `${b1.shortLabel}–${String(b2.startHour + 1).padStart(2, '0')}:00`,
            timePrefRank: getTwoHourPreferenceRank(b1.startHour),
            facilityTier: topVenue?.facilityTier ?? 0,
            distanceKm: topVenue?.distanceKm ?? 99,
            topVenueName: topVenue?.shortName || ''
          });
        }

        if (candidates.length === 0) return;

        candidates.sort((a, b) => {
          if (a.timePrefRank !== b.timePrefRank) return a.timePrefRank - b.timePrefRank;
          if (b.facilityTier !== a.facilityTier) return b.facilityTier - a.facilityTier;
          return a.distanceKm - b.distanceKm;
        });

        for (const c of candidates) {
          for (const k of [c.key1, c.key2]) {
            if (!cellMeta[k]) {
              cellMeta[k] = {
                isTwoHourPart: true,
                isPriorityTwoHour: false,
                spanLabel: c.spanLabel,
                topVenueName: c.topVenueName
              };
            }
          }
        }

        const best = candidates[0];
        for (const k of [best.key1, best.key2]) {
          cellMeta[k] = {
            isTwoHourPart: true,
            isPriorityTwoHour: true,
            spanLabel: best.spanLabel,
            topVenueName: best.topVenueName
          };
        }
      });
    });

    return cellMeta;
  }, [calendarWeeks, openVenuesBySlot, filterVenueList]);

  // Any slotKey that can participate in at least one consecutive 2-hour game at a shared venue
  const twoHourEligibleSlotKeys = useMemo(() => {
    const eligible = new Set();

    calendarWeeks.forEach((week) => {
      week.days.forEach((day) => {
        for (let i = 0; i < TIME_BLOCKS.length - 1; i += 1) {
          const b1 = TIME_BLOCKS[i];
          const b2 = TIME_BLOCKS[i + 1];
          const key1 = `${day.dateKey}_${b1.id}`;
          const key2 = `${day.dateKey}_${b2.id}`;

          const ids1 = openVenuesBySlot[key1] || new Set();
          const ids2 = openVenuesBySlot[key2] || new Set();

          const shared = VENUES.filter((v) => ids1.has(v.id) && ids2.has(v.id));
          if (filterVenueList(shared).length > 0) {
            eligible.add(key1);
            eligible.add(key2);
          }
        }
      });
    });

    return eligible;
  }, [calendarWeeks, openVenuesBySlot, filterVenueList]);

  const isSlotBlockedForTwoHour = useCallback(
    (slotKey) => !twoHourEligibleSlotKeys.has(slotKey),
    [twoHourEligibleSlotKeys]
  );

  // --------------------------------------------------------------------------
  // 3. 1-HOUR TALLIES (WITH TOP 3 RECOMMENDED VENUES) & TOP 5 2-HOUR BLOCKS
  // --------------------------------------------------------------------------

  const slotTallies = useMemo(() => {
    const tallyMap = {};
    let bestScore = 0;

    allOpenSlots.forEach((slot) => {
      const yesPlayers = [];
      const maybePlayers = [];
      const noPlayers = [];

      votes.forEach((v) => {
        const ans = getMergedVoterChoice(v.responses, slot.slotKey);
        if (ans === 'yes') yesPlayers.push(v);
        else if (ans === 'maybe') maybePlayers.push(v);
        else if (ans === 'no') noPlayers.push(v);
      });

      const score = yesPlayers.length * 100 + maybePlayers.length * 10;
      if (yesPlayers.length > 0 && score > bestScore) {
        bestScore = score;
      }

      const recommendedVenues = rankRecommendedVenues(
        slot.openVenues,
        slot.dateKey,
        [slot.startHour],
        openVenuesBySlot,
        3
      );

      tallyMap[slot.slotKey] = {
        ...slot,
        isTwoHourBlock: false,
        yesPlayers,
        maybePlayers,
        noPlayers,
        yesCount: yesPlayers.length,
        maybeCount: maybePlayers.length,
        noCount: noPlayers.length,
        score,
        recommendedVenues,
        isSweetSpot: yesPlayers.length >= 6 && yesPlayers.length <= 8,
        isDoubleCourt: yesPlayers.length >= 9
      };
    });

    allOpenSlots.forEach((slot) => {
      tallyMap[slot.slotKey].isTopPick =
        bestScore > 0 && tallyMap[slot.slotKey].score === bestScore;
    });

    return tallyMap;
  }, [allOpenSlots, votes, openVenuesBySlot]);

  const rankedTwoHourBlocks = useMemo(() => {
    const blocks = [];

    calendarWeeks.forEach((week) => {
      week.days.forEach((day) => {
        for (let i = 0; i < TIME_BLOCKS.length - 1; i += 1) {
          const b1 = TIME_BLOCKS[i];
          const b2 = TIME_BLOCKS[i + 1];
          const slotKey1 = `${day.dateKey}_${b1.id}`;
          const slotKey2 = `${day.dateKey}_${b2.id}`;

          const openIds1 = openVenuesBySlot[slotKey1] || new Set();
          const openIds2 = openVenuesBySlot[slotKey2] || new Set();

          const sharedVenues = VENUES.filter(
            (v) => openIds1.has(v.id) && openIds2.has(v.id)
          );
          const filteredShared = filterVenueList(sharedVenues);
          if (filteredShared.length === 0) continue;

          const bothYesPlayers = [];
          const flexBothPlayers = [];
          const partialYesPlayers = [];
          const noPlayers = [];

          votes.forEach((v) => {
            const c1 = getMergedVoterChoice(v.responses, slotKey1);
            const c2 = getMergedVoterChoice(v.responses, slotKey2);

            if (c1 === 'yes' && c2 === 'yes') {
              bothYesPlayers.push(v);
            } else if (
              (c1 === 'yes' || c1 === 'maybe') &&
              (c2 === 'yes' || c2 === 'maybe')
            ) {
              flexBothPlayers.push(v);
            } else if (c1 === 'yes' || c2 === 'yes') {
              partialYesPlayers.push(v);
            } else if (c1 === 'no' || c2 === 'no') {
              noPlayers.push(v);
            }
          });

          if (
            bothYesPlayers.length === 0 &&
            flexBothPlayers.length === 0 &&
            partialYesPlayers.length === 0
          ) {
            continue;
          }

          const score =
            bothYesPlayers.length * 1000 +
            flexBothPlayers.length * 100 +
            partialYesPlayers.length * 10;

          const recommendedVenues = rankRecommendedVenues(
            filteredShared,
            day.dateKey,
            [b1.startHour, b2.startHour],
            openVenuesBySlot,
            3
          );

          blocks.push({
            slotKey: `${day.dateKey}_${b1.id}__2h`,
            slotKey1,
            slotKey2,
            isTwoHourBlock: true,
            dateKey: day.dateKey,
            jpDate: day.jpDate,
            dow: day.dow,
            holiday: day.holiday || '',
            timeLabel: `${b1.shortLabel}–${String(b2.startHour + 1).padStart(2, '0')}:00 (2時間)`,
            openVenues: filteredShared,
            recommendedVenues,
            venueSummary: recommendedVenues.map((v) => v.shortName).join(' / '),
            yesPlayers: bothYesPlayers,
            maybePlayers: [...flexBothPlayers, ...partialYesPlayers],
            noPlayers,
            bothYesCount: bothYesPlayers.length,
            flexBothCount: flexBothPlayers.length,
            partialYesCount: partialYesPlayers.length,
            score,
            isSweetSpot: bothYesPlayers.length >= 6 && bothYesPlayers.length <= 8,
            isDoubleCourt: bothYesPlayers.length >= 9
          });
        }
      });
    });

    return blocks.sort((a, b) => b.score - a.score).slice(0, 5);
  }, [calendarWeeks, openVenuesBySlot, filterVenueList, votes]);

  // --------------------------------------------------------------------------
  // 4. INTERACTIVE CELL CYCLING, VIEW-ONLY INSPECTION & VOTER FORM ACTIONS
  // --------------------------------------------------------------------------

  const handleCycleSlot = (slotKey) => {
    if (!slotTallies[slotKey]) return;

    if (isSlotBlockedForTwoHour(slotKey)) {
      triggerToast('1時間枠のみ空きのため、2時間連続枠の対象外（ロック中）です');
      return;
    }

    if (viewingVote) {
      triggerToast(`閲覧モード中 (${viewingVote.name}) — 変更するには「編集する」を押してください`);
      return;
    }

    if (gridViewMode === 'heatmap') {
      setInspectSlot(slotTallies[slotKey]);
      return;
    }

    setResponses((prev) => {
      const current = prev[slotKey];
      const next = { ...prev };
      if (!current) next[slotKey] = 'yes';
      else if (current === 'yes') next[slotKey] = 'maybe';
      else if (current === 'maybe') next[slotKey] = 'no';
      else delete next[slotKey];
      return next;
    });
  };

  const handleQuickFillWeek = (val) => {
    if (viewingVote) {
      triggerToast(`閲覧モード中です。「この回答を編集する」を押すと一括入力できます`);
      return;
    }

    const currentWeek = calendarWeeks[activeWeekIdx];
    setResponses((prev) => {
      const next = { ...prev };
      currentWeek.days.forEach((day) => {
        TIME_BLOCKS.forEach((block) => {
          const cell = day.slots[block.id];
          if (!cell || !cell.isOpen) return;
          if (!matchesFilter(cell.openVenueIds)) return;

          const key = `${day.dateKey}_${block.id}`;
          if (val !== 'clear' && isSlotBlockedForTwoHour(key)) return;
          if (val === 'clear') {
            delete next[key];
          } else {
            next[key] = val;
          }
        });
      });
      return next;
    });

    if (val === 'clear') {
      triggerToast(`Cleared selections for ${currentWeek.shortTitle}`);
    } else {
      triggerToast(
        `Marked open slots ${val === 'yes' ? '◯' : '△'} for ${
          currentWeek.shortTitle
        }`
      );
    }
  };

  const handleQuickFillPrime = () => {
    if (viewingVote) {
      triggerToast(`閲覧モード中です。「この回答を編集する」を押すと一括入力できます`);
      return;
    }

    setResponses((prev) => {
      const next = { ...prev };
      allOpenSlots.forEach((slot) => {
        if (!slot.studentPrime) return;
        if (!matchesFilter(slot.openVenueIds)) return;
        if (isSlotBlockedForTwoHour(slot.slotKey)) return;
        next[slot.slotKey] = 'yes';
      });
      return next;
    });
    triggerToast('Marked all Student Prime slots (18:00+ & Holidays/Weekends) ◯!');
  };

  const handleQuickFillPriorityTwoHour = () => {
    if (viewingVote) {
      triggerToast(`閲覧モード中です。「この回答を編集する」を押すと一括入力できます`);
      return;
    }

    setResponses((prev) => {
      const next = { ...prev };
      allOpenSlots.forEach((slot) => {
        if (!twoHourHighlightMap[slot.slotKey]?.isPriorityTwoHour) return;
        if (!matchesFilter(slot.openVenueIds)) return;
        if (isSlotBlockedForTwoHour(slot.slotKey)) return;
        next[slot.slotKey] = 'yes';
      });
      return next;
    });
    triggerToast('Marked all recommended 2-hour continuous blocks (★ 2h連続) ◯!');
  };

  const resetVoterForm = () => {
    setVoterName('');
    setVoterNote('');
    setResponses({});
    setEditingVoteId(null);
    setViewingVote(null);
  };

  const handleSelectVoterToView = (vote) => {
    if (editingVoteId === vote.id) return;
    setEditingVoteId(null);
    setViewingVote(vote);
    setGridViewMode('vote');
    triggerToast(`閲覧モード: ${vote.name} さんの回答を表示中（誤タップ防止）`);
  };

  const handleSelectVoterToEdit = (vote) => {
    setViewingVote(null);
    setEditingVoteId(vote.id);
    setVoterName(vote.name || '');
    setVoterNote(vote.note || '');
    setResponses(normalizeResponsesMap(vote.responses));
    setGridViewMode('vote');
    setShowEditPickerModal(false);
    voterBarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    triggerToast(`編集モード: ${vote.name} さんの回答を変更できます`);
  };

  const handleSubmitVote = async (e) => {
    e.preventDefault();
    const trimmedName = voterName.trim().replace(/\s+/g, ' ');
    if (!trimmedName) {
      setVoterName('');
      triggerToast('Please enter your name / 名前を入力してください');
      return;
    }

    const cleanResponses = normalizeResponsesMap(responses);
    if (Object.keys(cleanResponses).length === 0) {
      triggerToast('Tap at least one open calendar slot (◯ / △ / ✕) first!');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingVoteId) {
        const { error } = await supabase
          .from('calendar_votes')
          .update({
            name: trimmedName,
            note: voterNote.trim(),
            responses: cleanResponses,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingVoteId);

        if (error) throw error;
        triggerToast(`Updated ${trimmedName}'s calendar vote!`);
      } else {
        const { error } = await supabase.from('calendar_votes').insert([
          {
            name: trimmedName,
            note: voterNote.trim(),
            responses: cleanResponses
          }
        ]);

        if (error) throw error;
        triggerToast(`Submitted ${trimmedName}'s vote!`);
      }

      await fetchVotes();
      resetVoterForm();
    } catch (err) {
      console.error('Supabase save error:', err);
      triggerToast('Could not save vote. Check Supabase connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDeleteVote = async () => {
    if (!voteToDelete) return;
    try {
      const { error } = await supabase
        .from('calendar_votes')
        .delete()
        .eq('id', voteToDelete.id);

      if (error) throw error;

      if (editingVoteId === voteToDelete.id || viewingVote?.id === voteToDelete.id) {
        resetVoterForm();
      }
      await fetchVotes();
      triggerToast(`Removed ${voteToDelete.name}'s response.`);
    } catch (err) {
      console.error('Supabase delete error:', err);
      triggerToast('Error removing response.');
    } finally {
      setVoteToDelete(null);
    }
  };

  // --------------------------------------------------------------------------
  // 5. SNS INVITE SUMMARY (Top 2-Hour Blocks + Recommended Venue Map Links)
  // --------------------------------------------------------------------------

  const shareSummaryText = useMemo(() => {
    if (rankedTwoHourBlocks.length === 0) {
      return [
        '🏓 岡大dinks | 次回セッション日程調整',
        'まだ2時間連続の投票がありません — リンクから参加できる時間帯を選んでください！',
        window.location.href
      ].join('\n');
    }

    // Pick top choice; if tied on score, prefer the closest date & preferred evening hour
    const bestBlock = [...rankedTwoHourBlocks].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.dateKey.localeCompare(b.dateKey);
    })[0];

    const topVenue = bestBlock.recommendedVenues[0];
    const hol = bestBlock.holiday ? `(${bestBlock.holiday})` : '';
    const footwearNote =
      topVenue?.courtType === 'outdoor'
        ? '👟 屋外コートのためテニス・ハードコート用シューズ推奨'
        : '👟 体育館のため室内専用シューズ必須';

    return [
      '🏓 岡大dinks | 次回セッション案内',
      `📅 日時: ${bestBlock.jpDate}(${bestBlock.dow})${hol} ${bestBlock.timeLabel}`,
      `🏟 会場: ${topVenue?.fullName || bestBlock.venueSummary}`,
      `👥 参加予定: ◯${bestBlock.bothYesCount}名${
        bestBlock.flexBothCount + bestBlock.partialYesCount > 0
          ? ` (調整可 ${bestBlock.flexBothCount + bestBlock.partialYesCount}名)`
          : ''
      }`,
      topVenue?.mapUrl ? `📍 Map: ${topVenue.mapUrl}` : null,
      footwearNote
    ]
      .filter(Boolean)
      .join('\n');
  }, [rankedTwoHourBlocks]);

  const fallbackCopy = () => {
    const ta = document.createElement('textarea');
    ta.value = shareSummaryText;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    setCopiedShare(true);
    triggerToast('Copied LINE / Instagram invite summary!');
    setTimeout(() => setCopiedShare(false), 2500);
  };

  const handleCopyShareText = () => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(shareSummaryText)
        .then(() => {
          setCopiedShare(true);
          triggerToast('Copied LINE / Instagram invite summary!');
          setTimeout(() => setCopiedShare(false), 2500);
        })
        .catch(() => fallbackCopy());
    } else {
      fallbackCopy();
    }
  };

  const currentWeek = calendarWeeks[activeWeekIdx];
  const selectedSlotCount = Object.keys(responses).length;
  const okayamaCount = VENUES.filter((v) => v.area === 'okayama').length;
  const kurashikiCount = VENUES.filter((v) => v.area === 'kurashiki').length;

  const showEditExistingButton =
    !editingVoteId &&
    activeVotes.length > 0 &&
    !voterName.trim() &&
    selectedSlotCount === 0;

  return (
    <div className="min-h-screen bg-[#eef2f6] text-slate-900 pb-16 font-sans selection:bg-lime-300 selection:text-slate-950">
      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-[#1B365D] text-white px-4 py-3 rounded-2xl shadow-2xl border border-lime-400/60 flex items-center gap-2.5 text-xs sm:text-sm font-bold max-w-[92vw]">
          <Check className="w-4 h-4 shrink-0 text-lime-300" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* HEADER */}
      <header className="bg-[#1B365D] text-white shadow-md border-b-4 border-[#2B547E]">
        <div className="max-w-6xl mx-auto px-3.5 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/10 rounded-xl border border-white/20 shrink-0">
                <PickleballIcon className="w-7 h-7" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-lime-400 text-[#1B365D] text-[11px] font-extrabold tracking-tight">
                    {VENUES.length}会場統合 空き状況 &amp; 日程調整
                  </span>
                  {hasLiveAvailability ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/10 text-[10px] text-lime-200 font-semibold">
                      <RefreshCw className="w-2.5 h-2.5" />
                      <span>
                        yoyacool({lastSyncedAt.yoyacool || '同期済'}) / Spacepad(
                        {lastSyncedAt.spacepad || '同期済'})
                      </span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-400/20 text-[10px] text-amber-200 font-semibold">
                      ※ 初回空き状況スクレイピング待機中
                    </span>
                  )}
                </div>

                <h1 className="text-base sm:text-xl font-extrabold tracking-tight text-white mt-0.5">
                  岡大dinks 合同セッション日程調整
                </h1>

                <p className="text-[11px] sm:text-xs text-sky-200 flex items-center gap-1.5 mt-1">
                  <MapPin className="w-3.5 h-3.5 text-lime-300 shrink-0" />
                  <span>
                    対象施設 ({VENUES.length}会場): 岡山市 ({okayamaCount}施設) ・ 倉敷市 ({kurashikiCount}施設)
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center">
              <button
                type="button"
                onClick={() => setShowShareModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-lime-400 hover:bg-lime-300 active:scale-95 text-[#1B365D] text-xs sm:text-sm font-extrabold shadow transition cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                <span>Share to SNS</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN WORKSPACE */}
      <main className="max-w-6xl mx-auto px-2.5 sm:px-5 pt-4 space-y-4">
        {errorMsg && (
          <div className="bg-rose-50 border border-rose-300 text-rose-800 px-4 py-3 rounded-xl flex items-center gap-2 text-xs sm:text-sm">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 1. VOTER ACTION BAR */}
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
                ? 'bg-amber-200/80 text-amber-950'
                : viewingVote
                ? 'bg-sky-700 text-white'
                : 'bg-[#264673] text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              {viewingVote ? (
                <Eye className="w-3.5 h-3.5 text-lime-300" />
              ) : (
                <Edit3 className="w-3.5 h-3.5 text-lime-300" />
              )}
              <span>
                {editingVoteId
                  ? `編集中 (Editing): ${voterName}`
                  : viewingVote
                  ? `閲覧モード (View-Only): ${viewingVote.name} さんの回答を確認中`
                  : `名前を入力して参加できる時間帯をタップ (1回の入力で${VENUES.length}会場に反映)`}
              </span>
            </div>

            {editingVoteId && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setVoteToDelete({ id: editingVoteId, name: voterName })
                  }
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-rose-600 text-white hover:bg-rose-700 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" /> 削除
                </button>
                <button
                  type="button"
                  onClick={resetVoterForm}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white text-slate-800 border border-slate-300 hover:bg-slate-100 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" /> キャンセル
                </button>
              </div>
            )}

            {viewingVote && !editingVoteId && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectVoterToEdit(viewingVote)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-400 text-slate-950 hover:bg-amber-300 cursor-pointer"
                >
                  <Edit3 className="w-3 h-3" /> この回答を編集する
                </button>
                <button
                  type="button"
                  onClick={() => setViewingVote(null)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white text-slate-800 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-3 h-3" /> 閲覧終了
                </button>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmitVote} className="p-3.5 sm:p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
              <div className="sm:col-span-4">
                <label className="block text-[11px] font-extrabold text-slate-600 mb-1">
                  名前 / Name <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  pattern=".*\S+.*"
                  title="空白のみの入力はできません / Name cannot be blank or spaces only"
                  value={voterName}
                  onChange={(e) => {
                    if (viewingVote) setViewingVote(null);
                    setVoterName(e.target.value.replace(/^\s+/, ''));
                  }}
                  onBlur={(e) => setVoterName(e.target.value.trim())}
                  placeholder="例: Kenji / Sarah"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white focus:border-[#1B365D] focus:ring-2 focus:ring-[#1B365D]/20 outline-none text-sm font-bold"
                />
              </div>

              <div className="sm:col-span-5">
                <label className="block text-[11px] font-extrabold text-slate-600 mb-1">
                  メモ / Note (希望エリア・屋内/屋外・パドル貸出など)
                </label>
                <input
                  type="text"
                  value={voterNote}
                  onChange={(e) => {
                    if (viewingVote) setViewingVote(null);
                    setVoterNote(e.target.value);
                  }}
                  placeholder="例: 岡山市内希望 / どこでもOK / パドル借りたいです"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white focus:border-[#1B365D] focus:ring-2 focus:ring-[#1B365D]/20 outline-none text-sm"
                />
              </div>

              <div className="sm:col-span-3 flex items-end">
                {showEditExistingButton ? (
                  <button
                    type="button"
                    onClick={() => setShowEditPickerModal(true)}
                    className="w-full py-2.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-[0.99] text-slate-950 font-extrabold text-xs sm:text-sm shadow border border-amber-500 transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <UserCheck className="w-4 h-4" />
                    <span>既存の回答を編集</span>
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#1B365D] hover:bg-[#274b7d] active:scale-[0.99] text-lime-300 font-extrabold text-xs sm:text-sm shadow transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    <span>
                      {isSubmitting
                        ? '送信中...'
                        : editingVoteId
                        ? '回答を更新する'
                        : `回答を登録 (${selectedSlotCount}枠)`}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* Quick-fill toolbar + Existing Voters Strip */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/80">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-500 mr-1">
                  一括入力 (Quick-Fill):
                </span>
                <button
                  type="button"
                  onClick={() => handleQuickFillWeek('yes')}
                  className="px-2.5 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-900 font-extrabold text-xs border border-emerald-300 cursor-pointer"
                >
                  今週すべて ◯
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickFillWeek('maybe')}
                  className="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 font-extrabold text-xs border border-amber-300 cursor-pointer"
                >
                  今週すべて △
                </button>
                <button
                  type="button"
                  onClick={handleQuickFillPrime}
                  className="px-2.5 py-1 rounded-lg bg-sky-100 hover:bg-sky-200 text-sky-900 font-extrabold text-xs border border-sky-300 cursor-pointer"
                >
                  ★ 学生向け枠のみ ◯
                </button>
                <button
                  type="button"
                  onClick={handleQuickFillPriorityTwoHour}
                  className="px-2.5 py-1 rounded-lg bg-indigo-100 hover:bg-indigo-200 text-indigo-950 font-extrabold text-xs border border-indigo-300 cursor-pointer"
                >
                  ★ 2h連続のみ ◯
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickFillWeek('clear')}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-300 cursor-pointer"
                >
                  クリア
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-[#1B365D]" />
                  回答済 ({activeVotes.length}名・クリックで閲覧):
                </span>
                {activeVotes.length === 0 ? (
                  <span className="text-[11px] text-slate-400 italic">
                    まだ回答はありません
                  </span>
                ) : (
                  activeVotes.map((v) => {
                    const isViewing = viewingVote?.id === v.id;
                    const isEditing = editingVoteId === v.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() =>
                          isViewing ? setViewingVote(null) : handleSelectVoterToView(v)
                        }
                        title={
                          isViewing
                            ? 'クリックして閲覧モードを閉じる'
                            : 'クリックして回答を閲覧（誤変更防止）'
                        }
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border transition cursor-pointer ${
                          isEditing
                            ? 'bg-amber-400 text-slate-950 border-amber-600'
                            : isViewing
                            ? 'bg-sky-700 text-white border-sky-900 shadow-2xs'
                            : 'bg-slate-100 hover:bg-sky-100 text-[#1B365D] border-slate-300'
                        }`}
                      >
                        <span>{v.name}</span>
                        {isEditing ? (
                          <Edit3 className="w-2.5 h-2.5 opacity-80" />
                        ) : (
                          <Eye className="w-2.5 h-2.5 opacity-70" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </form>
        </section>

        {/* 2. WEEK NAVIGATION & CLEAN SCALABLE 1-HOUR MATRIX */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-300 overflow-hidden">
          <div className="bg-[#1B365D] px-3 py-2.5 flex flex-wrap items-center justify-between gap-2 text-white">
            <button
              type="button"
              disabled={activeWeekIdx === 0}
              onClick={() => setActiveWeekIdx((i) => Math.max(0, i - 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#2B547E] hover:bg-[#366799] disabled:opacity-40 disabled:pointer-events-none text-xs font-extrabold border border-white/20 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>前週 (Prev)</span>
            </button>

            <div className="text-center">
              <div className="inline-block px-2 py-0.5 rounded bg-rose-700 text-white text-[10px] font-extrabold tracking-wider mb-0.5">
                1時間枠スケジュール (12:00–22:00)
              </div>
              <div className="text-sm sm:text-base font-extrabold tracking-tight text-white">
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
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#2B547E] hover:bg-[#366799] disabled:opacity-40 disabled:pointer-events-none text-xs font-extrabold border border-white/20 cursor-pointer"
            >
              <span>次週 (Next)</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Week Tabs, Scalable Area+Venue Dropdown Filter, Student Prime, & View Mode */}
          <div className="bg-[#f4f6f9] px-3 py-2.5 border-b border-slate-300 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {calendarWeeks.map((w, idx) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setActiveWeekIdx(idx)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer border ${
                    activeWeekIdx === idx
                      ? 'bg-[#1B365D] text-lime-300 border-[#1B365D] shadow-xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {w.shortTitle}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {okayamaCount > 0 && kurashikiCount > 0 && (
                <div className="inline-flex rounded-xl bg-slate-200 p-0.5 border border-slate-300 text-xs font-extrabold">
                  <button
                    type="button"
                    onClick={() => {
                      setAreaFilter('all');
                      setVenueFilter('all');
                    }}
                    className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                      areaFilter === 'all'
                        ? 'bg-white text-[#1B365D] shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    全エリア
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAreaFilter('okayama');
                      setVenueFilter('all');
                    }}
                    className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                      areaFilter === 'okayama'
                        ? 'bg-lime-400 text-[#1B365D] shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    岡山市
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAreaFilter('kurashiki');
                      setVenueFilter('all');
                    }}
                    className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                      areaFilter === 'kurashiki'
                        ? 'bg-sky-300 text-[#1B365D] shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    倉敷市
                  </button>
                </div>
              )}

              <select
                aria-label="会場フィルター"
                value={venueFilter}
                onChange={(e) => setVenueFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-extrabold text-[#1B365D] focus:border-[#1B365D] outline-none cursor-pointer"
              >
                <option value="all">
                  会場: すべて ({visibleVenues.length}施設)
                </option>
                {visibleVenues.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.shortName} ({v.courtType === 'outdoor' ? '屋外' : '屋内'})
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setHighlightPrimeOnly((p) => !p)}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                  highlightPrimeOnly
                    ? 'bg-amber-100 text-amber-950 border-amber-400'
                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>★ 学生枠</span>
              </button>

              <div className="inline-flex rounded-xl bg-slate-200 p-0.5 border border-slate-300">
                <button
                  type="button"
                  onClick={() => setGridViewMode('vote')}
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                    gridViewMode === 'vote'
                      ? 'bg-white text-[#1B365D] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Grid className="w-3.5 h-3.5" />
                  <span>{viewingVote ? `${viewingVote.name}の回答` : '自分の回答'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setGridViewMode('heatmap')}
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                    gridViewMode === 'heatmap'
                      ? 'bg-[#1B365D] text-lime-300 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>みんなの集計</span>
                </button>
              </div>
            </div>
          </div>

          {/* Minimal Symbol Legend */}
          <div className="px-3.5 py-2 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                <span className="w-4 h-4 rounded-full bg-emerald-100 border border-emerald-400 inline-flex items-center justify-center text-[10px]">
                  ◯
                </span>
                参加OK
              </span>
              <span className="inline-flex items-center gap-1 font-bold text-amber-700">
                <span className="w-4 h-4 rounded-full bg-amber-100 border border-amber-400 inline-flex items-center justify-center text-[10px]">
                  △
                </span>
                調整可
              </span>
              <span className="inline-flex items-center gap-1 font-bold text-rose-700">
                <span className="w-4 h-4 rounded-full bg-rose-100 border border-rose-400 inline-flex items-center justify-center text-[10px]">
                  ✕
                </span>
                不可
              </span>
              <span className="inline-flex items-center gap-1 text-slate-500">
                <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 font-bold text-[10px]">
                  満員
                </span>
                全会場予約済
              </span>
              <span className="inline-flex items-center gap-1 text-slate-600">
                <span className="px-1.5 py-0.5 rounded bg-slate-300/80 text-slate-700 font-bold text-[10px]">
                  2h不可
                </span>
                1hのみ空き (2h連続なし)
              </span>
              <span className="inline-flex items-center gap-1 text-slate-500">
                <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-300 text-slate-500 font-bold text-[10px]">
                  空きなし
                </span>
                営業時間外・休場
              </span>
              <span className="inline-flex items-center gap-1 font-bold text-indigo-800">
                <span className="w-3.5 h-3.5 rounded bg-indigo-50 border-2 border-indigo-400 inline-block" />
                おすすめ2時間枠
              </span>
              <span className="inline-flex items-center gap-1 text-amber-800 font-bold">
                <span className="w-3.5 h-3.5 rounded bg-amber-100 border border-amber-400 inline-block" />
                学生向け時間帯 (18:00~)
              </span>
            </div>
            <span className="font-bold text-[#1B365D]">
              ※ 「詳細」または「◯/△」タップでおすすめ予約候補TOP3と投票メンバーを表示
            </span>
          </div>

          {/* Horizontal-Scrollable Schedule Matrix */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-center">
              <thead>
                <tr className="bg-[#eef3f8] border-b-2 border-slate-300 text-slate-800">
                  <th className="sticky left-0 z-20 bg-[#dce5f0] py-2.5 px-2.5 min-w-[116px] sm:min-w-[132px] text-left text-xs font-extrabold text-[#1B365D] border-r-2 border-slate-300">
                    日付 / 曜日
                  </th>
                  {TIME_BLOCKS.map((block) => (
                    <th
                      key={block.id}
                      title={
                        block.isStudentPrime
                          ? `${block.label}（★ 学生向け枠）`
                          : block.label
                      }
                      className={`py-2.5 px-2 min-w-[78px] sm:min-w-[88px] border-r border-slate-300 last:border-r-0 transition ${
                        block.isStudentPrime
                          ? 'bg-amber-100/90 border-b-2 border-b-amber-400'
                          : ''
                      }`}
                    >
                      <div className="text-xs font-extrabold text-[#1B365D] tracking-wide">
                        {block.shortLabel} ~
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-300">
                {currentWeek.days.map((day) => {
                  let dateTextColor = 'text-slate-900';
                  let dateBgColor = 'bg-[#f8fafc]';
                  if (day.dayType === 'saturday') {
                    dateTextColor = 'text-blue-700';
                    dateBgColor = 'bg-blue-50';
                  } else if (
                    day.dayType === 'sunday' ||
                    day.dayType === 'holiday'
                  ) {
                    dateTextColor = 'text-red-600';
                    dateBgColor = 'bg-red-50';
                  }

                  return (
                    <tr key={day.dateKey} className="h-[88px] divide-x divide-slate-300">
                      <td
                        className={`sticky left-0 z-10 ${dateBgColor} h-full px-2.5 text-left border-r-2 border-slate-300 align-middle`}
                      >
                        <div className="flex items-center gap-1 flex-wrap">
                          <span
                            className={`text-xs sm:text-sm font-extrabold underline decoration-slate-300 ${dateTextColor}`}
                          >
                            {day.jpDate}({day.dow})
                          </span>
                          {day.holiday && (
                            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-600 text-white text-[10px] font-extrabold">
                              {day.holiday}
                            </span>
                          )}
                        </div>
                        {day.allBooked && (
                          <span className="inline-block mt-0.5 text-[10px] font-bold text-slate-400">
                            空きなし
                          </span>
                        )}
                      </td>

                      {TIME_BLOCKS.map((block) => {
                        const cellData = day.slots[block.id];

                        if (!cellData || !cellData.isOpen) {
                          if (cellData?.isFullyBooked) {
                            return (
                              <td
                                key={block.id}
                                title="対象施設はすべて予約済み（満員）です"
                                className="bg-[#e5e7eb] h-full px-1 align-middle select-none cursor-not-allowed"
                              >
                                <div className="h-full flex flex-col items-center justify-center gap-0.5 text-slate-500">
                                  <span className="text-xs font-extrabold leading-none">
                                    ✕
                                  </span>
                                  <span className="text-[10px] font-bold">
                                    満員
                                  </span>
                                </div>
                              </td>
                            );
                          }

                          return (
                            <td
                              key={block.id}
                              title="営業時間外・休場または対象外の時間帯です（空きなし）"
                              className="bg-slate-100/90 h-full px-1 align-middle select-none cursor-not-allowed"
                            >
                              <div className="h-full flex flex-col items-center justify-center gap-0.5 text-slate-400">
                                <span className="text-xs font-bold leading-none">
                                  —
                                </span>
                                <span className="text-[10px] font-medium">
                                  空きなし
                                </span>
                              </div>
                            </td>
                          );
                        }

                        const slotKey = `${day.dateKey}_${block.id}`;

                        if (isSlotBlockedForTwoHour(slotKey)) {
                          return (
                            <td
                              key={block.id}
                              onClick={() => handleCycleSlot(slotKey)}
                              title="1時間枠は空きがありますが、同一会場で2時間連続になる枠がありません"
                              className="bg-slate-200/85 h-full px-1 align-middle select-none cursor-not-allowed"
                            >
                              <div className="h-full flex flex-col items-center justify-center gap-0.5 text-slate-500">
                                <span className="text-xs font-extrabold leading-none">
                                  —
                                </span>
                                <span className="text-[10px] font-bold">
                                  2h不可
                                </span>
                              </div>
                            </td>
                          );
                        }

                        const activeChoice = viewingResponsesMap
                          ? viewingResponsesMap[slotKey]
                          : responses[slotKey];
                        const twoHourInfo = twoHourHighlightMap[slotKey];
                        const tally = slotTallies[slotKey] || {
                          yesCount: 0,
                          maybeCount: 0,
                          noCount: 0,
                          isTopPick: false,
                          isSweetSpot: false
                        };

                        const isDimmedByPrime =
                          highlightPrimeOnly && !cellData.studentPrime;
                        const isDimmedByVenue = !matchesFilter(cellData.openVenueIds);
                        const isDimmed = isDimmedByPrime || isDimmedByVenue;

                        let heatmapBg = twoHourInfo?.isPriorityTwoHour
                          ? 'bg-indigo-50/70 hover:bg-indigo-100/70'
                          : block.isStudentPrime
                          ? 'bg-amber-50/45 hover:bg-amber-50/80'
                          : 'bg-white hover:bg-sky-50';

                        if (gridViewMode === 'heatmap') {
                          if (tally.yesCount >= 6) {
                            heatmapBg =
                              'bg-emerald-200/90 hover:bg-emerald-200';
                          } else if (tally.yesCount >= 3) {
                            heatmapBg =
                              'bg-emerald-100/80 hover:bg-emerald-100';
                          } else if (tally.yesCount >= 1) {
                            heatmapBg = 'bg-lime-50 hover:bg-lime-100';
                          } else {
                            heatmapBg = 'bg-slate-50/70 hover:bg-slate-100';
                          }
                        } else if (activeChoice === 'yes') {
                          heatmapBg = 'bg-emerald-50/90 hover:bg-emerald-100/80';
                        } else if (activeChoice === 'maybe') {
                          heatmapBg = 'bg-amber-50/90 hover:bg-amber-100/80';
                        } else if (activeChoice === 'no') {
                          heatmapBg = 'bg-rose-50/80 hover:bg-rose-100/70';
                        }

                        const highlightRing = tally.isTopPick
                          ? 'ring-2 ring-inset ring-amber-400'
                          : twoHourInfo?.isPriorityTwoHour
                          ? 'ring-2 ring-inset ring-indigo-400'
                          : '';

                        return (
                          <td
                            key={block.id}
                            className={`p-1.5 h-full align-middle transition ${heatmapBg} ${
                              isDimmed ? 'opacity-25' : ''
                            } ${highlightRing}`}
                          >
                            <div className="h-full flex flex-col items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleCycleSlot(slotKey)}
                                className={`w-full py-0.5 px-0.5 rounded-xl flex flex-col items-center justify-center transition ${
                                  viewingVote
                                    ? 'cursor-default'
                                    : 'active:scale-95 cursor-pointer'
                                }`}
                                title={
                                  viewingVote
                                    ? `${viewingVote.name} の回答（閲覧モード）`
                                    : twoHourInfo?.isPriorityTwoHour
                                    ? `★ 2時間連続おすすめ枠 (${twoHourInfo.spanLabel} / ${twoHourInfo.topVenueName}) • ${day.jpDate}(${day.dow}) ${block.label} • 空き会場: ${cellData.summaryText}`
                                    : `${day.jpDate}(${day.dow}) ${block.label} • 空き会場: ${cellData.summaryText}`
                                }
                              >
                                {gridViewMode === 'vote' ? (
                                  <>
                                    {activeChoice === 'yes' && (
                                      <span className="w-7 h-7 rounded-full bg-emerald-600 text-white font-extrabold text-sm flex items-center justify-center shadow-xs">
                                        ◯
                                      </span>
                                    )}
                                    {activeChoice === 'maybe' && (
                                      <span className="w-7 h-7 rounded-full bg-amber-500 text-white font-extrabold text-xs flex items-center justify-center shadow-xs">
                                        △
                                      </span>
                                    )}
                                    {activeChoice === 'no' && (
                                      <span className="w-7 h-7 rounded-full bg-rose-600 text-white font-extrabold text-xs flex items-center justify-center shadow-xs">
                                        ✕
                                      </span>
                                    )}
                                    {!activeChoice && (
                                      <span
                                        className={`w-7 h-7 rounded-full border-2 border-dashed font-extrabold text-sm flex items-center justify-center bg-white ${
                                          viewingVote
                                            ? 'border-slate-300 text-slate-300'
                                            : 'border-[#1B365D]/40 text-[#1B365D]'
                                        }`}
                                      >
                                        {viewingVote ? '–' : '◯'}
                                      </span>
                                    )}
                                  </>
                                ) : (
                                  <div className="h-7 flex flex-col items-center justify-center leading-tight">
                                    <div className="text-xs font-extrabold text-[#1B365D]">
                                      ◯ {tally.yesCount}
                                    </div>
                                    <div className="text-[10px] font-bold text-amber-700">
                                      △ {tally.maybeCount}
                                    </div>
                                  </div>
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={() => setInspectSlot(tally)}
                                className="w-full py-0.5 px-1 rounded bg-slate-100/90 hover:bg-[#1B365D] hover:text-white text-[10px] font-extrabold text-slate-700 flex items-center justify-center gap-1 border border-slate-200 transition cursor-pointer"
                                title={`おすすめ会場と投票詳細 (${cellData.summaryText})`}
                              >
                                {gridViewMode === 'heatmap' ? (
                                  <span>詳細</span>
                                ) : (
                                  <>
                                    <span className="text-emerald-700">
                                      ◯{tally.yesCount}
                                    </span>
                                    <span className="text-amber-600">
                                      △{tally.maybeCount}
                                    </span>
                                  </>
                                )}
                              </button>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* 3. TOP 5 RECOMMENDED 2-HOUR BLOCKS & PLAYER COMMENTS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <section className="lg:col-span-7 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 bg-[#1B365D] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-lime-300" />
                <h2 className="font-extrabold text-xs sm:text-sm">
                  おすすめ2時間枠 TOP 5 (連続空き会場)
                </h2>
              </div>
              <span className="text-[11px] text-sky-200">
                2時間連続で予約可能な枠
              </span>
            </div>

            <div className="p-3.5 space-y-2">
              {loadingVotes ? (
                <p className="text-xs text-slate-500 py-4 text-center">
                  集計データを読み込み中...
                </p>
              ) : rankedTwoHourBlocks.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-500 space-y-1">
                  <p className="font-bold text-slate-700">
                    2時間連続の投票はまだありません
                  </p>
                  <p>
                    上のカレンダーで連続する2時間枠（◯）をタップすると、同じ会場で2時間取れるおすすめ枠が自動ランキングされます！
                  </p>
                </div>
              ) : (
                rankedTwoHourBlocks.map((block, index) => (
                  <div
                    key={block.slotKey}
                    onClick={() => setInspectSlot(block)}
                    className={`p-3 rounded-xl border flex flex-wrap items-center justify-between gap-2 transition cursor-pointer ${
                      index === 0
                        ? 'bg-lime-50/90 border-lime-400'
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`w-6 h-6 rounded-full text-xs font-extrabold flex items-center justify-center shrink-0 ${
                          index === 0
                            ? 'bg-[#1B365D] text-lime-300'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs sm:text-sm font-extrabold text-slate-900">
                          {block.jpDate}({block.dow})
                          {block.holiday ? `・${block.holiday}` : ''}{' '}
                          <span className="text-[#1B365D]">
                            {block.timeLabel}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600 flex flex-wrap items-center gap-1.5 mt-0.5">
                          <span className="font-bold text-[#1B365D]">
                            第1候補: {block.recommendedVenues[0]?.shortName}
                          </span>
                          {block.recommendedVenues.length > 1 && (
                            <span className="text-slate-500">
                              (他 {block.recommendedVenues.slice(1).map((v) => v.shortName).join('・')})
                            </span>
                          )}
                          {block.isSweetSpot && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-extrabold text-[10px]">
                              🎯 6–8名ベスト人数
                            </span>
                          )}
                          {block.isDoubleCourt && (
                            <span className="px-1.5 py-0.5 rounded bg-sky-100 text-sky-900 font-extrabold text-[10px]">
                              🔥 9名以上 (2面推奨)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-900 font-extrabold text-xs border border-emerald-300">
                        2h◯ {block.bothYesCount}
                      </span>
                      {block.flexBothCount + block.partialYesCount > 0 && (
                        <span className="px-2 py-1 rounded-lg bg-amber-100 text-amber-900 font-bold text-xs border border-amber-300">
                          △/1h {block.flexBothCount + block.partialYesCount}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="lg:col-span-5 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            <div className="px-4 py-3 bg-[#264673] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-lime-300" />
                <h2 className="font-extrabold text-xs sm:text-sm">
                  参加メンバーのコメント (Notes)
                </h2>
              </div>
              <span className="text-[11px] text-sky-200">
                {activeVotes.length}名
              </span>
            </div>

            <div className="p-3.5 space-y-2 max-h-[430px] overflow-y-auto flex-1">
              {activeVotes.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-6 text-center">
                  コメントはまだありません
                </p>
              ) : (
                activeVotes.map((v) => (
                  <div
                    key={v.id}
                    onClick={() => handleSelectVoterToView(v)}
                    className="p-2.5 rounded-xl bg-slate-50 hover:bg-sky-50 border border-slate-200 flex items-start justify-between gap-2 cursor-pointer transition"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-extrabold text-[#1B365D]">
                        {v.name}
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5 break-words">
                        {v.note || (
                          <span className="text-slate-400 italic">
                            コメントなし
                          </span>
                        )}
                      </p>
                    </div>
                    <Eye className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {/* Venue Directory & Footwear Reminder Footer */}
        <footer className="bg-white border border-slate-200 rounded-2xl p-3.5 text-[11px] sm:text-xs text-slate-600 space-y-2.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="font-extrabold text-slate-800 inline-flex items-center gap-1.5">
              <Info className="w-4 h-4 text-[#1B365D]" />
              <span>対象施設・予約ページ一覧 ({VENUES.length}会場)</span>
            </span>
            <span>
              体育館は<strong>室内専用シューズ必須</strong>・屋外ハードコートは<strong>テニス/コートシューズ推奨</strong>です。
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {VENUES.map((v) => (
              <div
                key={v.id}
                className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold shrink-0 ${
                      v.courtType === 'outdoor'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-sky-100 text-sky-800'
                    }`}
                  >
                    {v.courtType === 'outdoor' ? '屋外' : '屋内'}
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
                  className="inline-flex items-center gap-0.5 text-[#1B365D] font-extrabold underline shrink-0"
                >
                  <span>予約</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            ))}
          </div>
        </footer>
      </main>

      {/* MODAL 1: SLOT BREAKDOWN INSPECTOR (Top 3 Recommended Courts + Voters) */}
      {inspectSlot && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3.5 bg-[#1B365D] text-white flex items-center justify-between">
              <div>
                <div className="text-[11px] text-lime-300 font-bold">
                  おすすめ予約候補 &amp; 投票メンバー詳細
                </div>
                <h3 className="font-extrabold text-sm sm:text-base">
                  {inspectSlot.jpDate}({inspectSlot.dow}){' '}
                  {inspectSlot.timeLabel}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectSlot(null)}
                className="p-1 rounded-lg hover:bg-white/15 text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs max-h-[82vh] overflow-y-auto">
              {/* Top 3 Recommended Venues */}
              <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-[#1B365D] inline-flex items-center gap-1">
                    <Award className="w-4 h-4 text-amber-500" />
                    <span>
                      おすすめ予約候補 TOP {inspectSlot.recommendedVenues?.length || 0}
                    </span>
                  </span>
                  <span className="text-[10px] text-slate-500">
                    全{inspectSlot.openVenues?.length || 0}施設空き
                  </span>
                </div>

                {inspectSlot.recommendedVenues?.map((v, idx) => (
                  <div
                    key={v.id}
                    className={`p-2 rounded-lg border flex items-center justify-between gap-2 ${
                      idx === 0
                        ? 'bg-white border-lime-400 shadow-2xs'
                        : 'bg-white/80 border-slate-200'
                    }`}
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-4 h-4 rounded-full text-[10px] font-extrabold flex items-center justify-center shrink-0 ${
                            idx === 0
                              ? 'bg-[#1B365D] text-lime-300'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold shrink-0 ${
                            v.courtType === 'outdoor'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-sky-100 text-sky-800'
                          }`}
                        >
                          {v.courtType === 'outdoor'
                            ? v.hasLights
                              ? '屋外・照明'
                              : '屋外'
                            : '屋内'}
                        </span>
                        <span className="font-extrabold text-slate-900 truncate">
                          {v.fullName}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 pl-5 text-[10px]">
                        {v.continuousSpan && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                            ★ {v.continuousSpan}
                          </span>
                        )}
                        <span className="text-slate-500">
                          岡山駅から約{v.distanceKm}km
                        </span>
                      </div>
                    </div>

                    <a
                      href={v.bookingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 px-2 py-1 rounded bg-[#1B365D] text-lime-300 font-extrabold text-[11px] hover:bg-[#274b7d] shrink-0"
                    >
                      <span>予約</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                ))}
              </div>

              <div>
                <div className="font-extrabold text-emerald-700 mb-1">
                  {inspectSlot.isTwoHourBlock
                    ? `◯ 2時間とも参加OK (${inspectSlot.yesPlayers.length}名):`
                    : `◯ 参加OK (${inspectSlot.yesPlayers.length}名):`}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {inspectSlot.yesPlayers.length === 0 ? (
                    <span className="text-slate-400">なし</span>
                  ) : (
                    inspectSlot.yesPlayers.map((p) => (
                      <span
                        key={p.id}
                        className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-900 font-bold"
                      >
                        {p.name}
                      </span>
                    ))
                  )}
                </div>
              </div>

              <div>
                <div className="font-extrabold text-amber-700 mb-1">
                  {inspectSlot.isTwoHourBlock
                    ? `△ 調整可 / 1時間のみ参加可 (${inspectSlot.maybePlayers.length}名):`
                    : `△ 調整可 (${inspectSlot.maybePlayers.length}名):`}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {inspectSlot.maybePlayers.length === 0 ? (
                    <span className="text-slate-400">なし</span>
                  ) : (
                    inspectSlot.maybePlayers.map((p) => (
                      <span
                        key={p.id}
                        className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 font-bold"
                      >
                        {p.name}
                      </span>
                    ))
                  )}
                </div>
              </div>

              <div>
                <div className="font-extrabold text-rose-700 mb-1">
                  ✕ 不可 ({inspectSlot.noPlayers.length}名):
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {inspectSlot.noPlayers.length === 0 ? (
                    <span className="text-slate-400">なし</span>
                  ) : (
                    inspectSlot.noPlayers.map((p) => (
                      <span
                        key={p.id}
                        className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-900 font-bold"
                      >
                        {p.name}
                      </span>
                    ))
                  )}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-200">
                {!inspectSlot.isTwoHourBlock && !viewingVote ? (
                  <button
                    type="button"
                    onClick={() => {
                      handleCycleSlot(inspectSlot.slotKey);
                      setInspectSlot(null);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-emerald-700 text-white font-extrabold hover:bg-emerald-600 cursor-pointer"
                  >
                    自分の回答を切替 (◯/△/✕)
                  </button>
                ) : (
                  <span className="text-[11px] text-slate-500">
                    {viewingVote
                      ? `閲覧モード中 (${viewingVote.name})`
                      : '※ 各1時間枠の回答は上のカレンダーから変更できます'}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setInspectSlot(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 cursor-pointer ml-auto"
                >
                  閉じる
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: SELECT VOTER TO EDIT */}
      {showEditPickerModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3.5 bg-[#1B365D] text-white flex items-center justify-between">
              <h3 className="font-extrabold text-sm sm:text-base flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-lime-300" />
                編集する回答を選択 (Select Player)
              </h3>
              <button
                type="button"
                onClick={() => setShowEditPickerModal(false)}
                className="p-1 rounded-lg hover:bg-white/15 text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-2.5 text-xs">
              <p className="text-slate-600">
                日程を変更したいメンバーを選んでください：
              </p>

              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {activeVotes.map((v) => {
                  const count = Object.keys(normalizeResponsesMap(v.responses)).length;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => handleSelectVoterToEdit(v)}
                      className="w-full p-2.5 rounded-xl bg-slate-50 hover:bg-amber-50 border border-slate-200 hover:border-amber-400 flex items-center justify-between gap-2 text-left transition cursor-pointer"
                    >
                      <div className="min-w-0">
                        <div className="font-extrabold text-slate-900 text-sm">
                          {v.name}
                        </div>
                        {v.note && (
                          <div className="text-[11px] text-slate-500 truncate">
                            {v.note}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-bold text-[11px]">
                          {count}枠回答済
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#1B365D] text-lime-300 font-extrabold">
                          <Edit3 className="w-3 h-3" />
                          <span>編集</span>
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 flex justify-end border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowEditPickerModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 cursor-pointer"
                >
                  閉じる
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: SHARE INVITE TEXT */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3.5 bg-[#1B365D] text-white flex items-center justify-between">
              <h3 className="font-extrabold text-sm sm:text-base flex items-center gap-2">
                <Share2 className="w-4 h-4 text-lime-300" />
                LINE / Instagram 共有テキスト
              </h3>
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className="p-1 rounded-lg hover:bg-white/15 text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <p className="text-xs text-slate-600">
                コピーしてLINEオープンチャットやInstagramグループDMに貼り付けてください：
              </p>

              <textarea
                readOnly
                rows={12}
                value={shareSummaryText}
                className="w-full p-3 rounded-xl bg-slate-50 border border-slate-300 text-xs font-mono text-slate-800 focus:outline-none"
              />

              <button
                type="button"
                onClick={handleCopyShareText}
                className="w-full py-3 rounded-xl bg-lime-400 hover:bg-lime-300 text-[#1B365D] font-extrabold text-sm flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
              >
                {copiedShare ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>コピーしました！</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>案内文をコピー</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: CONFIRM DELETE PLAYER VOTE */}
      {voteToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="font-extrabold text-slate-900 text-base">
              回答を削除しますか？
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              <strong>{voteToDelete.name}</strong> さんの投票データを削除します。
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setVoteToDelete(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 cursor-pointer"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteVote}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}