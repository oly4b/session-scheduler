/**
 * @fileoverview Okayama Pickleball Session Scheduler (`岡大dinks`) — 3-Venue Unified Edition
 * Coordinates group pickleball sessions across:
 *   1. Seto Athletic Park Gymnasium Sub-Arena (`瀬戸` — yoyacool `1/2面A・B`)
 *   2. Shimada Mirai Arena Mizushima / Fukuda Park (`福田` — Spacepad `1/3面(1)–(3)`)
 *   3. Mizushima Gymnasium (`水島` — Spacepad `1/4面(1)–(4)`)
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
  BedDouble,
  Eye,
  Sparkles,
  Grid,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { supabase } from './lib/supabase';

// ============================================================================
// CONSTANTS, VENUE METADATA & JST CALENDAR UTILITIES
// ============================================================================

const TIME_BLOCKS = [
  { id: '12:00-13:00', label: '12:00–13:00', shortLabel: '12:00', isStudentPrime: false },
  { id: '13:00-14:00', label: '13:00–14:00', shortLabel: '13:00', isStudentPrime: false },
  { id: '14:00-15:00', label: '14:00–15:00', shortLabel: '14:00', isStudentPrime: false },
  { id: '15:00-16:00', label: '15:00–16:00', shortLabel: '15:00', isStudentPrime: false },
  { id: '16:00-17:00', label: '16:00–17:00', shortLabel: '16:00', isStudentPrime: false },
  { id: '17:00-18:00', label: '17:00–18:00', shortLabel: '17:00', isStudentPrime: false },
  { id: '18:00-19:00', label: '18:00–19:00', shortLabel: '18:00', isStudentPrime: true },
  { id: '19:00-20:00', label: '19:00–20:00', shortLabel: '19:00', isStudentPrime: true },
  { id: '20:00-21:00', label: '20:00–21:00', shortLabel: '20:00', isStudentPrime: true }
];

const VENUES = {
  seto: {
    id: 'seto',
    badgePrefix: '瀬戸',
    shortName: '瀬戸町総合運動公園体育館',
    subTitle: 'サブアリーナ 1/2面A・B',
    mapUrl:
      'https://www.google.com/maps/search/?api=1&query=%E7%80%AC%E6%88%B8%E7%94%BA%E7%B7%8F%E5%90%88%E9%81%8B%E5%8B%95%E5%85%AC%E5%9C%92%E4%BD%93%E8%82%B2%E9%A4%A8',
    bookingUrl:
      'https://yoyacool.e-harp.jp/okayamacity/FacilityAvailability/Index/331007/0031?ptn=3&rc=141&rc2w=141'
  },
  fukuda: {
    id: 'fukuda',
    badgePrefix: '福田',
    shortName: 'シマダみらいアリーナ水島（福田公園）',
    subTitle: '1/3面(1)・(2)・(3)',
    mapUrl: 'https://maps.app.goo.gl/XiqAWzqDudww3Z1aA',
    bookingUrl:
      'https://booking.spacepad.jp/provider/50833/spaces/itjbcjdbdle4-tgj/rooms/pxMub8xjITrSyqBW'
  },
  mizushima: {
    id: 'mizushima',
    badgePrefix: '水島',
    shortName: '水島体育館',
    subTitle: '1/4面(1)・(2)・(3)・(4)',
    mapUrl: 'https://maps.app.goo.gl/oFoRMkbfNLMs7eHM9',
    bookingUrl:
      'https://booking.spacepad.jp/provider/50833/spaces/w2xrdrqqmbh-yo2u/rooms/vo_5DKw8ofQonMDL'
  }
};

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

function getCombinedSlotInfo(courtAvailability, dateStr, slotId, hasAnyLive) {
  const info = courtAvailability[`${dateStr}_${slotId}`];

  // 1. Seto Athletic Park Gymnasium (`瀬戸`)
  let setoOpen = false;
  let setoClosed = false;
  let setoShort = '予約済';
  let setoStyle = 'bg-slate-100 text-slate-400 border-slate-200';

  if (info && (info.A || info.B)) {
    const aOpen = info.A === 'open';
    const bOpen = info.B === 'open';
    setoClosed = info.A === 'closed' && info.B === 'closed';

    if (aOpen && bOpen) {
      setoOpen = true;
      setoShort = 'A・B';
      setoStyle = 'bg-lime-100 text-lime-800 border-lime-300';
    } else if (aOpen || bOpen) {
      setoOpen = true;
      setoShort = aOpen ? 'A' : 'B';
      setoStyle = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    } else if (setoClosed) {
      setoShort = '休館';
      setoStyle = 'bg-slate-200 text-slate-600 border-slate-300';
    } else {
      setoShort = '予約済';
      setoStyle = 'bg-rose-50/80 text-rose-500 border-rose-200/80';
    }
  } else if (!hasAnyLive) {
    setoOpen = true;
    setoShort = 'A・B';
    setoStyle = 'bg-lime-100 text-lime-800 border-lime-300';
  }

  // 2. Shimada Mirai Arena Mizushima / Fukuda Park (`福田`)
  let fukudaOpen = false;
  let fukudaShort = '予約済';
  let fukudaStyle = 'bg-slate-100 text-slate-400 border-slate-200';

  if (info && (info.sp1 || info.sp2 || info.sp3)) {
    const openCourts = [
      info.sp1 === 'open' && '1',
      info.sp2 === 'open' && '2',
      info.sp3 === 'open' && '3'
    ].filter(Boolean);

    if (openCourts.length > 0) {
      fukudaOpen = true;
      fukudaShort = openCourts.join('・');
      fukudaStyle =
        openCourts.length >= 2
          ? 'bg-sky-100 text-sky-900 border-sky-300'
          : 'bg-cyan-50 text-cyan-800 border-cyan-200';
    } else {
      fukudaShort = '予約済';
      fukudaStyle = 'bg-rose-50/80 text-rose-500 border-rose-200/80';
    }
  }

  // 3. Mizushima Gymnasium (`水島`)
  let mizushimaOpen = false;
  let mizushimaShort = '予約済';
  let mizushimaStyle = 'bg-slate-100 text-slate-400 border-slate-200';

  if (info && (info.mg1 || info.mg2 || info.mg3 || info.mg4)) {
    const openCourts = [
      info.mg1 === 'open' && '1',
      info.mg2 === 'open' && '2',
      info.mg3 === 'open' && '3',
      info.mg4 === 'open' && '4'
    ].filter(Boolean);

    if (openCourts.length > 0) {
      mizushimaOpen = true;
      mizushimaShort = openCourts.join('・');
      mizushimaStyle =
        openCourts.length >= 2
          ? 'bg-violet-100 text-violet-900 border-violet-300'
          : 'bg-purple-50 text-purple-800 border-purple-200';
    } else {
      mizushimaShort = '予約済';
      mizushimaStyle = 'bg-rose-50/80 text-rose-500 border-rose-200/80';
    }
  }

  const openVenueParts = [
    setoOpen && `瀬戸 ${setoShort}`,
    fukudaOpen && `福田 ${fukudaShort}`,
    mizushimaOpen && `水島 ${mizushimaShort}`
  ].filter(Boolean);

  return {
    isOpen: setoOpen || fukudaOpen || mizushimaOpen,
    setoOpen,
    setoClosed,
    fukudaOpen,
    mizushimaOpen,
    setoBadge: { text: `瀬戸 ${setoShort}`, className: setoStyle },
    fukudaBadge: { text: `福田 ${fukudaShort}`, className: fukudaStyle },
    mizushimaBadge: { text: `水島 ${mizushimaShort}`, className: mizushimaStyle },
    summaryText: openVenueParts.join(' / ')
  };
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
  const [courtAvailability, setCourtAvailability] = useState({});
  const [lastSyncedAt, setLastSyncedAt] = useState({ seto: '', spacepad: '' });

  // Week Navigation, Venue Filter & Grid Display Modes
  const [activeWeekIdx, setActiveWeekIdx] = useState(0);
  const [venueFilter, setVenueFilter] = useState('all'); // 'all' | 'seto' | 'fukuda' | 'mizushima'
  const [gridViewMode, setGridViewMode] = useState('vote'); // 'vote' | 'heatmap'
  const [highlightPrimeOnly, setHighlightPrimeOnly] = useState(false);

  // Voter Input & Edit State
  const [voterName, setVoterName] = useState('');
  const [voterNote, setVoterNote] = useState('');
  const [responses, setResponses] = useState({});
  const [editingVoteId, setEditingVoteId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modals & Toast Notifications
  const [inspectSlot, setInspectSlot] = useState(null);
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

  // --------------------------------------------------------------------------
  // 1. FETCH VOTES & PARALLEL 3-VENUE AVAILABILITY FROM SUPABASE
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

      // Four parallel queries keep each response <= 756 rows (well below PostgREST's 1,000-row cap)
      const [setoRes, fukudaRes, mizushima12Res, mizushima34Res] = await Promise.all([
        supabase
          .from('court_availability')
          .select('slot_date, time_range, court_detail, status, updated_at')
          .in('court_detail', ['1/2面A', '1/2面B'])
          .gte('slot_date', minDate)
          .limit(1000),
        supabase
          .from('court_availability')
          .select('slot_date, time_range, court_detail, status, updated_at')
          .in('court_detail', [
            'spacepad_1/3(1)',
            'spacepad_1/3(2)',
            'spacepad_1/3(3)'
          ])
          .gte('slot_date', minDate)
          .limit(1000),
        supabase
          .from('court_availability')
          .select('slot_date, time_range, court_detail, status, updated_at')
          .in('court_detail', ['mizushima_gym_1/4(1)', 'mizushima_gym_1/4(2)'])
          .gte('slot_date', minDate)
          .limit(1000),
        supabase
          .from('court_availability')
          .select('slot_date, time_range, court_detail, status, updated_at')
          .in('court_detail', ['mizushima_gym_1/4(3)', 'mizushima_gym_1/4(4)'])
          .gte('slot_date', minDate)
          .limit(1000)
      ]);

      const data = [
        ...(setoRes.data || []),
        ...(fukudaRes.data || []),
        ...(mizushima12Res.data || []),
        ...(mizushima34Res.data || [])
      ];
      if (data.length === 0) return;

      const map = {};
      let latestSeto = '';
      let latestSpacepad = '';

      for (const row of data) {
        const key = `${row.slot_date}_${row.time_range}`;
        if (!map[key]) map[key] = {};

        if (row.court_detail === '1/2面A') {
          map[key].A = row.status;
          if (row.updated_at && row.updated_at > latestSeto) latestSeto = row.updated_at;
        } else if (row.court_detail === '1/2面B') {
          map[key].B = row.status;
          if (row.updated_at && row.updated_at > latestSeto) latestSeto = row.updated_at;
        } else if (row.court_detail === 'spacepad_1/3(1)') {
          map[key].sp1 = row.status;
          if (row.updated_at && row.updated_at > latestSpacepad) latestSpacepad = row.updated_at;
        } else if (row.court_detail === 'spacepad_1/3(2)') {
          map[key].sp2 = row.status;
          if (row.updated_at && row.updated_at > latestSpacepad) latestSpacepad = row.updated_at;
        } else if (row.court_detail === 'spacepad_1/3(3)') {
          map[key].sp3 = row.status;
          if (row.updated_at && row.updated_at > latestSpacepad) latestSpacepad = row.updated_at;
        } else if (row.court_detail === 'mizushima_gym_1/4(1)') {
          map[key].mg1 = row.status;
          if (row.updated_at && row.updated_at > latestSpacepad) latestSpacepad = row.updated_at;
        } else if (row.court_detail === 'mizushima_gym_1/4(2)') {
          map[key].mg2 = row.status;
          if (row.updated_at && row.updated_at > latestSpacepad) latestSpacepad = row.updated_at;
        } else if (row.court_detail === 'mizushima_gym_1/4(3)') {
          map[key].mg3 = row.status;
          if (row.updated_at && row.updated_at > latestSpacepad) latestSpacepad = row.updated_at;
        } else if (row.court_detail === 'mizushima_gym_1/4(4)') {
          map[key].mg4 = row.status;
          if (row.updated_at && row.updated_at > latestSpacepad) latestSpacepad = row.updated_at;
        }
      }

      setCourtAvailability(map);

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
        seto: fmtJst(latestSeto),
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
  // 2. BUILD UNIFIED 28-DAY (4-WEEK) CALENDAR ACROSS ALL 3 VENUES
  // --------------------------------------------------------------------------

  const { calendarWeeks, allOpenSlots, hasLiveAvailability } = useMemo(() => {
    const hasLive = Object.keys(courtAvailability).length > 0;
    const days = [];

    for (let offset = 0; offset < 28; offset += 1) {
      const meta = getJstDayMeta(offset);
      const isWeekendOrHoliday =
        meta.dayType === 'saturday' ||
        meta.dayType === 'sunday' ||
        meta.dayType === 'holiday';

      const slots = {};
      let allUnavailableCount = 0;

      TIME_BLOCKS.forEach((block) => {
        const studentPrime = isWeekendOrHoliday || block.isStudentPrime;
        const combined = getCombinedSlotInfo(
          courtAvailability,
          meta.dateKey,
          block.id,
          hasLive
        );

        if (!combined.isOpen) {
          allUnavailableCount += 1;
        }

        slots[block.id] = {
          ...combined,
          studentPrime
        };
      });

      days.push({
        ...meta,
        allBooked: allUnavailableCount === TIME_BLOCKS.length,
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
              timeLabel: block.label,
              setoOpen: cell.setoOpen,
              fukudaOpen: cell.fukudaOpen,
              mizushimaOpen: cell.mizushimaOpen,
              court: cell.summaryText,
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
  }, [courtAvailability]);

  // --------------------------------------------------------------------------
  // 3. GROUP TALLY & TOP RANKED SLOTS COMPUTATION
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

      tallyMap[slot.slotKey] = {
        ...slot,
        yesPlayers,
        maybePlayers,
        noPlayers,
        yesCount: yesPlayers.length,
        maybeCount: maybePlayers.length,
        noCount: noPlayers.length,
        score,
        isSweetSpot: yesPlayers.length >= 6 && yesPlayers.length <= 8,
        isDoubleCourt: yesPlayers.length >= 9
      };
    });

    allOpenSlots.forEach((slot) => {
      tallyMap[slot.slotKey].isTopPick =
        bestScore > 0 && tallyMap[slot.slotKey].score === bestScore;
    });

    return tallyMap;
  }, [allOpenSlots, votes]);

  const rankedTopSlots = useMemo(() => {
    return Object.values(slotTallies)
      .filter((s) => {
        if (s.yesCount === 0 && s.maybeCount === 0) return false;
        if (venueFilter === 'seto') return s.setoOpen;
        if (venueFilter === 'fukuda') return s.fukudaOpen;
        if (venueFilter === 'mizushima') return s.mizushimaOpen;
        return true;
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [slotTallies, venueFilter]);

  // --------------------------------------------------------------------------
  // 4. INTERACTIVE CELL CYCLING & VOTER FORM ACTIONS
  // --------------------------------------------------------------------------

  const handleCycleSlot = (slotKey) => {
    if (!slotTallies[slotKey]) return;

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
    const currentWeek = calendarWeeks[activeWeekIdx];
    setResponses((prev) => {
      const next = { ...prev };
      currentWeek.days.forEach((day) => {
        TIME_BLOCKS.forEach((block) => {
          const cell = day.slots[block.id];
          if (!cell || !cell.isOpen) return;
          if (venueFilter === 'seto' && !cell.setoOpen) return;
          if (venueFilter === 'fukuda' && !cell.fukudaOpen) return;
          if (venueFilter === 'mizushima' && !cell.mizushimaOpen) return;

          const key = `${day.dateKey}_${block.id}`;
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
    setResponses((prev) => {
      const next = { ...prev };
      allOpenSlots.forEach((slot) => {
        if (!slot.studentPrime) return;
        if (venueFilter === 'seto' && !slot.setoOpen) return;
        if (venueFilter === 'fukuda' && !slot.fukudaOpen) return;
        if (venueFilter === 'mizushima' && !slot.mizushimaOpen) return;
        next[slot.slotKey] = 'yes';
      });
      return next;
    });
    triggerToast('Marked all Student Prime slots (18:00+ & Holidays/Weekends) ◯!');
  };

  const resetVoterForm = () => {
    setVoterName('');
    setVoterNote('');
    setResponses({});
    setEditingVoteId(null);
  };

  const handleSelectVoterToEdit = (vote) => {
    setEditingVoteId(vote.id);
    setVoterName(vote.name || '');
    setVoterNote(vote.note || '');
    setResponses(normalizeResponsesMap(vote.responses));
    setGridViewMode('vote');
    voterBarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    triggerToast(`Editing ${vote.name}'s calendar votes`);
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

      if (editingVoteId === voteToDelete.id) {
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
  // 5. LINE / INSTAGRAM INVITE SUMMARY & CLIPBOARD HELPERS
  // --------------------------------------------------------------------------

  const shareSummaryText = useMemo(() => {
    const lines = [
      '🏓 岡大dinks | 日程調整 (瀬戸・福田・水島 3会場統合)',
      '📅 1-Hour Slot Poll (12:00–21:00 JST):',
      ''
    ];

    if (rankedTopSlots.length > 0) {
      lines.push('🏆 Top Ranked 1-Hr Slots / 現在の人気枠:');
      rankedTopSlots.slice(0, 5).forEach((s, idx) => {
        const hol = s.holiday ? `(${s.holiday})` : '';
        lines.push(
          `${idx + 1}. ${s.jpDate}(${s.dow})${hol} ${s.timeLabel} — ◯${s.yesCount} / △${s.maybeCount} [${s.court}]`
        );
      });
      lines.push('');
    } else {
      lines.push('まだ投票がありません — リンクから参加できる時間帯を選んでください！', '');
    }

    lines.push(
      `👥 Total Voted: ${votes.length} players`,
      `📍 瀬戸町総合運動公園体育館: ${VENUES.seto.mapUrl}`,
      `📍 シマダみらいアリーナ水島: ${VENUES.fukuda.mapUrl}`,
      `📍 水島体育館: ${VENUES.mizushima.mapUrl}`,
      '👟 Clean indoor shoes required (室内履き必須)'
    );
    return lines.join('\n');
  }, [rankedTopSlots, votes.length]);

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

  return (
    <div className="min-h-screen bg-[#eef2f6] text-slate-900 pb-16 font-sans selection:bg-lime-300 selection:text-slate-950">
      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-[#1B365D] text-white px-4 py-3 rounded-2xl shadow-2xl border border-lime-400/60 flex items-center gap-2.5 text-xs sm:text-sm font-bold max-w-[92vw]">
          <Check className="w-4 h-4 shrink-0 text-lime-300" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* HEADER: 3-Venue Map Links, Sync Status & Share Button */}
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
                    3会場統合 空き状況 &amp; 日程調整
                  </span>
                  {hasLiveAvailability ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/10 text-[10px] text-lime-200 font-semibold">
                      <RefreshCw className="w-2.5 h-2.5" />
                      <span>
                        yoyacool({lastSyncedAt.seto || '同期済'}) / Spacepad(
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

                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] sm:text-xs text-sky-200 mt-1">
                  <a
                    href={VENUES.seto.mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 underline decoration-lime-300/60 hover:text-lime-300 transition"
                  >
                    <MapPin className="w-3 h-3 text-lime-300 shrink-0" />
                    <span>
                      {VENUES.seto.shortName} ({VENUES.seto.subTitle})
                    </span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                  <span className="text-white/30">|</span>
                  <a
                    href={VENUES.fukuda.mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 underline decoration-sky-300/60 hover:text-lime-300 transition"
                  >
                    <MapPin className="w-3 h-3 text-sky-300 shrink-0" />
                    <span>
                      {VENUES.fukuda.shortName} ({VENUES.fukuda.subTitle})
                    </span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                  <span className="text-white/30">|</span>
                  <a
                    href={VENUES.mizushima.mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 underline decoration-violet-300/60 hover:text-lime-300 transition"
                  >
                    <MapPin className="w-3 h-3 text-violet-300 shrink-0" />
                    <span>
                      {VENUES.mizushima.shortName} ({VENUES.mizushima.subTitle})
                    </span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
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
              : 'bg-white border-[#1B365D]/20'
          }`}
        >
          <div
            className={`px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs font-extrabold ${
              editingVoteId
                ? 'bg-amber-200/80 text-amber-950'
                : 'bg-[#264673] text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <Edit3 className="w-3.5 h-3.5 text-lime-300" />
              <span>
                {editingVoteId
                  ? `編集中 (Editing): ${voterName}`
                  : 'STEP 1: 名前を入力して参加できる時間帯をタップ (1回の入力で3会場に反映)'}
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
                  onChange={(e) => setVoterName(e.target.value.replace(/^\s+/, ''))}
                  onBlur={(e) => setVoterName(e.target.value.trim())}
                  placeholder="例: Kenji / Sarah"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white focus:border-[#1B365D] focus:ring-2 focus:ring-[#1B365D]/20 outline-none text-sm font-bold"
                />
              </div>

              <div className="sm:col-span-5">
                <label className="block text-[11px] font-extrabold text-slate-600 mb-1">
                  メモ / Note (希望会場・ラケット貸出・交通手段など)
                </label>
                <input
                  type="text"
                  value={voterNote}
                  onChange={(e) => setVoterNote(e.target.value)}
                  placeholder="例: どこでもOK / パドル借りたいです"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white focus:border-[#1B365D] focus:ring-2 focus:ring-[#1B365D]/20 outline-none text-sm"
                />
              </div>

              <div className="sm:col-span-3 flex items-end">
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
                  onClick={() => handleQuickFillWeek('clear')}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-300 cursor-pointer"
                >
                  クリア
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-[#1B365D]" />
                  回答済 ({votes.length}名):
                </span>
                {votes.length === 0 ? (
                  <span className="text-[11px] text-slate-400 italic">
                    まだ回答はありません
                  </span>
                ) : (
                  votes.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => handleSelectVoterToEdit(v)}
                      title="クリックして回答を編集"
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border transition cursor-pointer ${
                        editingVoteId === v.id
                          ? 'bg-amber-400 text-slate-950 border-amber-600'
                          : 'bg-slate-100 hover:bg-sky-100 text-[#1B365D] border-slate-300'
                      }`}
                    >
                      <span>{v.name}</span>
                      <Edit3 className="w-2.5 h-2.5 opacity-70" />
                    </button>
                  ))
                )}
              </div>
            </div>
          </form>
        </section>

        {/* 2. WEEK NAVIGATION & UNIFIED 3-VENUE AVAILABILITY MATRIX */}
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
                瀬戸・福田・水島 3会場統合1時間枠 (12:00–21:00)
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

          {/* Week Tabs, 3-Venue Filter, Student Prime Filter, & Vote/Heatmap Switcher */}
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
              <div className="inline-flex rounded-xl bg-slate-200 p-0.5 border border-slate-300 text-xs font-extrabold">
                <button
                  type="button"
                  onClick={() => setVenueFilter('all')}
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                    venueFilter === 'all'
                      ? 'bg-white text-[#1B365D] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  全会場
                </button>
                <button
                  type="button"
                  onClick={() => setVenueFilter('seto')}
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                    venueFilter === 'seto'
                      ? 'bg-lime-400 text-[#1B365D] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  瀬戸空き
                </button>
                <button
                  type="button"
                  onClick={() => setVenueFilter('fukuda')}
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                    venueFilter === 'fukuda'
                      ? 'bg-sky-300 text-[#1B365D] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  福田空き
                </button>
                <button
                  type="button"
                  onClick={() => setVenueFilter('mizushima')}
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                    venueFilter === 'mizushima'
                      ? 'bg-violet-300 text-[#1B365D] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  水島空き
                </button>
              </div>

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
                  <span>自分の回答</span>
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

          {/* Symbol & 3-Venue Badge Legend */}
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
              <span className="inline-flex items-center gap-1">
                <span className="px-1.5 py-0.5 rounded bg-lime-100 border border-lime-300 text-lime-800 font-bold text-[10px]">
                  瀬戸 A・B
                </span>
                瀬戸サブアリーナ
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="px-1.5 py-0.5 rounded bg-sky-100 border border-sky-300 text-sky-900 font-bold text-[10px]">
                  福田 1・2・3
                </span>
                福田公園体育館
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="px-1.5 py-0.5 rounded bg-violet-100 border border-violet-300 text-violet-900 font-bold text-[10px]">
                  水島 1・2・3・4
                </span>
                水島体育館
              </span>
            </div>
            <span className="font-bold text-[#1B365D]">
              {gridViewMode === 'vote'
                ? '※ 3会場のいずれかが空いていれば投票可能'
                : '※ 枠をタップで投票メンバー詳細を表示'}
            </span>
          </div>

          {/* Horizontal-Scrollable Schedule Matrix */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-center">
              <thead>
                <tr className="bg-[#eef3f8] border-b-2 border-slate-300 text-slate-800">
                  <th className="sticky left-0 z-20 bg-[#dce5f0] py-2.5 px-2.5 min-w-[116px] sm:min-w-[136px] text-left text-xs font-extrabold text-[#1B365D] border-r-2 border-slate-300">
                    日付 / 曜日
                  </th>
                  {TIME_BLOCKS.map((block) => (
                    <th
                      key={block.id}
                      className="py-2 px-1.5 min-w-[104px] sm:min-w-[118px] border-r border-slate-300 last:border-r-0"
                    >
                      <div className="text-[11px] sm:text-xs font-extrabold text-[#1B365D]">
                        {block.label}
                      </div>
                      {block.isStudentPrime && (
                        <div className="text-[10px] font-bold text-amber-700 mt-0.5">
                          ★ 講義後OK
                        </div>
                      )}
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
                    <tr key={day.dateKey} className="divide-x divide-slate-300">
                      <td
                        className={`sticky left-0 z-10 ${dateBgColor} py-2.5 px-2.5 text-left border-r-2 border-slate-300 align-middle`}
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
                        <span className="block text-[10px] text-slate-500 mt-0.5">
                          {day.allBooked ? '全会場満員/休館' : '瀬戸・福田・水島'}
                        </span>
                      </td>

                      {TIME_BLOCKS.map((block) => {
                        const cellData = day.slots[block.id];

                        if (!cellData || !cellData.isOpen) {
                          return (
                            <td
                              key={block.id}
                              className="bg-[#e5e7eb] py-2 px-1 align-middle select-none cursor-not-allowed"
                            >
                              <div className="flex flex-col items-center justify-center gap-1 text-slate-400">
                                {cellData?.setoClosed ? (
                                  <BedDouble className="w-3.5 h-3.5" />
                                ) : (
                                  <span className="text-xs font-extrabold leading-none">
                                    ✕
                                  </span>
                                )}
                                {cellData && (
                                  <div className="flex flex-col gap-0.5 w-full px-1">
                                    <span
                                      className={`text-[9px] font-semibold px-1 py-0.5 rounded border leading-none truncate ${cellData.setoBadge.className}`}
                                    >
                                      {cellData.setoBadge.text}
                                    </span>
                                    <span
                                      className={`text-[9px] font-semibold px-1 py-0.5 rounded border leading-none truncate ${cellData.fukudaBadge.className}`}
                                    >
                                      {cellData.fukudaBadge.text}
                                    </span>
                                    <span
                                      className={`text-[9px] font-semibold px-1 py-0.5 rounded border leading-none truncate ${cellData.mizushimaBadge.className}`}
                                    >
                                      {cellData.mizushimaBadge.text}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </td>
                          );
                        }

                        const slotKey = `${day.dateKey}_${block.id}`;
                        const myChoice = responses[slotKey];
                        const tally = slotTallies[slotKey] || {
                          yesCount: 0,
                          maybeCount: 0,
                          noCount: 0,
                          isTopPick: false,
                          isSweetSpot: false
                        };

                        const isDimmedByPrime =
                          highlightPrimeOnly && !cellData.studentPrime;
                        const isDimmedByVenue =
                          (venueFilter === 'seto' && !cellData.setoOpen) ||
                          (venueFilter === 'fukuda' && !cellData.fukudaOpen) ||
                          (venueFilter === 'mizushima' && !cellData.mizushimaOpen);
                        const isDimmed = isDimmedByPrime || isDimmedByVenue;

                        let heatmapBg = 'bg-white hover:bg-sky-50';
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
                        } else if (myChoice === 'yes') {
                          heatmapBg = 'bg-emerald-50/90 hover:bg-emerald-100/80';
                        } else if (myChoice === 'maybe') {
                          heatmapBg = 'bg-amber-50/90 hover:bg-amber-100/80';
                        } else if (myChoice === 'no') {
                          heatmapBg = 'bg-rose-50/80 hover:bg-rose-100/70';
                        }

                        return (
                          <td
                            key={block.id}
                            className={`p-1.5 align-middle transition ${heatmapBg} ${
                              isDimmed ? 'opacity-30' : ''
                            } ${
                              tally.isTopPick
                                ? 'ring-2 ring-inset ring-amber-400'
                                : ''
                            }`}
                          >
                            <div className="flex flex-col items-center justify-between gap-1">
                              <button
                                type="button"
                                onClick={() => handleCycleSlot(slotKey)}
                                className="w-full py-0.5 px-0.5 rounded-xl flex flex-col items-center justify-center transition active:scale-95 cursor-pointer"
                                title={`${day.jpDate}(${day.dow}) ${block.label} [${cellData.summaryText}]`}
                              >
                                {gridViewMode === 'vote' ? (
                                  <>
                                    {myChoice === 'yes' && (
                                      <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-extrabold text-xs flex items-center justify-center shadow-xs">
                                        ◯
                                      </span>
                                    )}
                                    {myChoice === 'maybe' && (
                                      <span className="w-6 h-6 rounded-full bg-amber-500 text-white font-extrabold text-[11px] flex items-center justify-center shadow-xs">
                                        △
                                      </span>
                                    )}
                                    {myChoice === 'no' && (
                                      <span className="w-6 h-6 rounded-full bg-rose-600 text-white font-extrabold text-[11px] flex items-center justify-center shadow-xs">
                                        ✕
                                      </span>
                                    )}
                                    {!myChoice && (
                                      <span className="w-6 h-6 rounded-full border-2 border-dashed border-[#1B365D]/40 text-[#1B365D] font-extrabold text-xs flex items-center justify-center bg-white">
                                        ◯
                                      </span>
                                    )}
                                  </>
                                ) : (
                                  <div className="py-0.5">
                                    <div className="text-xs font-extrabold text-[#1B365D]">
                                      ◯ {tally.yesCount}
                                    </div>
                                    <div className="text-[10px] font-bold text-amber-700">
                                      △ {tally.maybeCount}
                                    </div>
                                  </div>
                                )}

                                {/* Stacked 3-Venue Availability Badges */}
                                <div className="mt-1 flex flex-col gap-0.5 w-full">
                                  <span
                                    className={`text-[9px] font-semibold px-1 py-0.5 rounded border leading-none whitespace-nowrap ${cellData.setoBadge.className}`}
                                  >
                                    {cellData.setoBadge.text}
                                  </span>
                                  <span
                                    className={`text-[9px] font-semibold px-1 py-0.5 rounded border leading-none whitespace-nowrap ${cellData.fukudaBadge.className}`}
                                  >
                                    {cellData.fukudaBadge.text}
                                  </span>
                                  <span
                                    className={`text-[9px] font-semibold px-1 py-0.5 rounded border leading-none whitespace-nowrap ${cellData.mizushimaBadge.className}`}
                                  >
                                    {cellData.mizushimaBadge.text}
                                  </span>
                                </div>
                              </button>

                              <button
                                type="button"
                                onClick={() => setInspectSlot(tally)}
                                className="w-full py-0.5 px-1 rounded bg-slate-100/90 hover:bg-[#1B365D] hover:text-white text-[10px] font-extrabold text-slate-700 flex items-center justify-center gap-1 border border-slate-200 transition cursor-pointer"
                                title="誰が投票したか見る (View Breakdown)"
                              >
                                <span className="text-emerald-700">
                                  ◯{tally.yesCount}
                                </span>
                                <span className="text-amber-600">
                                  △{tally.maybeCount}
                                </span>
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

        {/* 3. TOP RANKED 1-HOUR SLOTS & PLAYER COMMENTS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <section className="lg:col-span-7 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 bg-[#1B365D] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-lime-300" />
                <h2 className="font-extrabold text-xs sm:text-sm">
                  人気ランキング TOP 5 (3会場統合)
                </h2>
              </div>
              <span className="text-[11px] text-sky-200">
                6–8名で1面が最適
              </span>
            </div>

            <div className="p-3.5 space-y-2">
              {loadingVotes ? (
                <p className="text-xs text-slate-500 py-4 text-center">
                  集計データを読み込み中...
                </p>
              ) : rankedTopSlots.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-500 space-y-1">
                  <p className="font-bold text-slate-700">
                    投票はまだありません
                  </p>
                  <p>
                    上のカレンダーで空き枠（◯）をタップして投票すると、人気の日時と空き会場が自動ランキングされます！
                  </p>
                </div>
              ) : (
                rankedTopSlots.map((slot, index) => (
                  <div
                    key={slot.slotKey}
                    onClick={() => setInspectSlot(slot)}
                    className={`p-3 rounded-xl border flex flex-wrap items-center justify-between gap-2 transition cursor-pointer ${
                      index === 0
                        ? 'bg-lime-50/90 border-lime-400'
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`w-6 h-6 rounded-full text-xs font-extrabold flex items-center justify-center shrink-0 ${
                          index === 0
                            ? 'bg-[#1B365D] text-lime-300'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {index + 1}
                      </span>
                      <div>
                        <div className="text-xs sm:text-sm font-extrabold text-slate-900">
                          {slot.jpDate}({slot.dow})
                          {slot.holiday ? `・${slot.holiday}` : ''}{' '}
                          <span className="text-[#1B365D]">
                            {slot.timeLabel}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600 flex flex-wrap items-center gap-2 mt-0.5">
                          <span className="font-bold text-[#1B365D]">
                            空き: {slot.court}
                          </span>
                          {slot.isSweetSpot && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-extrabold text-[10px]">
                              🎯 6–8名ベスト人数
                            </span>
                          )}
                          {slot.isDoubleCourt && (
                            <span className="px-1.5 py-0.5 rounded bg-sky-100 text-sky-900 font-extrabold text-[10px]">
                              🔥 9名以上 (2面予約推奨)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-900 font-extrabold text-xs border border-emerald-300">
                        ◯ {slot.yesCount}
                      </span>
                      <span className="px-2 py-1 rounded-lg bg-amber-100 text-amber-900 font-bold text-xs border border-amber-300">
                        △ {slot.maybeCount}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="lg:col-span-5 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 bg-[#264673] text-white flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-lime-300" />
              <h2 className="font-extrabold text-xs sm:text-sm">
                参加メンバーのコメント (Notes)
              </h2>
            </div>

            <div className="p-3.5 space-y-2 max-h-[290px] overflow-y-auto">
              {votes.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-6 text-center">
                  コメントはまだありません
                </p>
              ) : (
                votes.map((v) => (
                  <div
                    key={v.id}
                    onClick={() => handleSelectVoterToEdit(v)}
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
                    <Edit3 className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {/* 3-Venue Access & Indoor Shoe Reminder Footer */}
        <footer className="bg-white border border-slate-200 rounded-2xl p-3.5 text-[11px] sm:text-xs text-slate-600 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-[#1B365D] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p>
              <a
                href={VENUES.seto.mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-extrabold text-[#1B365D] underline inline-flex items-center gap-1"
              >
                <span>{VENUES.seto.shortName}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              ：最新の空き状況の確認・予約確定は{' '}
              <a
                href={VENUES.seto.bookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#1B365D] font-bold underline"
              >
                岡山市施設予約サービス（yoyacool）
              </a>{' '}
              から行ってください。
            </p>
            <p>
              <a
                href={VENUES.fukuda.mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-extrabold text-[#1B365D] underline inline-flex items-center gap-1"
              >
                <span>{VENUES.fukuda.shortName}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              ：予約確定は{' '}
              <a
                href={VENUES.fukuda.bookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#1B365D] font-bold underline"
              >
                Spacepad（福田公園）予約ページ
              </a>{' '}
              から行ってください。
            </p>
            <p>
              <a
                href={VENUES.mizushima.mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-extrabold text-[#1B365D] underline inline-flex items-center gap-1"
              >
                <span>{VENUES.mizushima.shortName}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              ：予約確定は{' '}
              <a
                href={VENUES.mizushima.bookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#1B365D] font-bold underline"
              >
                Spacepad（水島体育館）予約ページ
              </a>{' '}
              から行ってください。
            </p>
            <p>
              全会場とも<strong>室内専用シューズ（ノンマーキング）必須</strong>です。
            </p>
          </div>
        </footer>
      </main>

      {/* MODAL 1: SLOT BREAKDOWN INSPECTOR */}
      {inspectSlot && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3.5 bg-[#1B365D] text-white flex items-center justify-between">
              <div>
                <div className="text-[11px] text-lime-300 font-bold">
                  空き会場: {inspectSlot.court}
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

            <div className="p-4 space-y-3 text-xs">
              <div>
                <div className="font-extrabold text-emerald-700 mb-1">
                  ◯ 参加OK ({inspectSlot.yesPlayers.length}名):
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
                  △ 調整可 ({inspectSlot.maybePlayers.length}名):
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
                <button
                  type="button"
                  onClick={() => setInspectSlot(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 cursor-pointer"
                >
                  閉じる
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: SHARE INVITE TEXT */}
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

      {/* MODAL 3: CONFIRM DELETE PLAYER VOTE */}
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