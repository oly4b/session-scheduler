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
  UserCheck,
  Languages,
} from 'lucide-react';
import { supabase } from './lib/supabase';
import { VENUES, VENUE_BY_ID } from './config/venues';
import {
  ACTIVE_VENUE_IDS,
  TIME_BLOCKS,
  formatJstTimestamp,
  getJstDayMeta,
  getMergedVoterChoice,
  normalizeResponsesMap,
  rankRecommendedVenues,
} from './utils/scheduler';

const AVAILABILITY_PAGE_SIZE = 1000;

const COPY = {
  en: {
    badgeIntegrated: (count) => `${count} Venues · Availability & Poll`,
    syncedWaiting: '※ Waiting for initial availability scrape',
    appTitle: 'Okadai dinks Session Scheduler',
    venuesSummary: (total, okayama, kurashiki) =>
      `Venues (${total}): Okayama (${okayama}) · Kurashiki (${kurashiki})`,
    shareToSns: 'Share to SNS',
    supabaseError:
      'Supabase connection error: please check your .env and table settings.',
    editingBanner: (name) => `Editing: ${name}`,
    viewingBanner: (name) => `View-Only: viewing ${name}'s response`,
    defaultBanner: (count) =>
      `Enter your name and tap available slots (1 entry applies across ${count} venues)`,
    deleteBtn: 'Delete',
    cancelBtn: 'Cancel',
    editThisBtn: 'Edit Response',
    exitViewBtn: 'Exit View',
    nameLabel: 'Name',
    namePlaceholder: 'e.g. Kenji / Sarah',
    nameTitle: 'Name cannot be blank or spaces only',
    noteLabel: 'Note (preferred area, indoor/outdoor, paddle rental, etc.)',
    notePlaceholder: 'e.g. Okayama preferred / Anywhere / Need a paddle',
    editExistingBtn: 'Edit Existing Vote',
    submittingBtn: 'Saving...',
    updateVoteBtn: 'Update Vote',
    submitVoteBtn: (count) => `Submit Vote (${count} slots)`,
    quickFillLabel: 'Quick-Fill:',
    weekAllYes: 'Week All ◯',
    weekAllMaybe: 'Week All △',
    studentPrimeYes: '★ Student Prime ◯',
    twoHourPriorityYes: '★ 2h Priority ◯',
    clearBtn: 'Clear',
    votedLabel: (count) => `Voted (${count} · tap to view):`,
    noVotesYet: 'No responses yet',
    viewToggleTitle: 'Click to toggle view mode',
    viewModeTitle: 'Click to view response (prevents accidental edits)',
    editModeTitle: 'Click to edit response',
    oneHourSubLabel: '1-Hour Schedule (12:00–22:00)',
    prevWeek: 'Prev',
    nextWeek: 'Next',
    allAreas: 'All Areas',
    okayamaArea: 'Okayama',
    kurashikiArea: 'Kurashiki',
    allVenuesOption: (count) => `Venues: All (${count})`,
    outdoorShort: 'Outdoor',
    indoorShort: 'Indoor',
    studentPrimeFilter: '★ Prime',
    myVoteTab: (name) => (name ? `${name}'s Vote` : 'My Vote'),
    tallyTab: 'Group Tally',
    legendYes: 'Available',
    legendMaybe: 'Maybe',
    legendNo: 'Unavailable',
    legendFull: 'Full',
    legendFullDesc: 'All venues booked',
    legendNo2h: 'No 2h',
    legendNo2hDesc: '1h open only (no 2h block)',
    legendClosed: 'Closed',
    legendClosedDesc: 'Outside hours / closed',
    legendRec2h: 'Top 2h Block',
    legendPrime: 'Student Prime (18:00~)',
    legendHint: '※　Tap on "Details" or "◯/△" for top venues & voters',
    dateColHeader: 'Date / Day',
    allBookedDay: 'No slots',
    bookedTitle: 'All matching venues are booked (Full)',
    closedTitle: 'Outside operating hours or closed',
    no2hTitle: 'Only 1 hour open — no continuous 2-hour slot at the same venue',
    viewingCellTitle: (name) => `${name}'s response (View-Only)`,
    detailsLabel: 'Details',
    top5Title: 'Top 5 Recommended 2h Blocks',
    top5Subtitle: 'Best per day (3+ votes)',
    loadingVotes: 'Loading tallies...',
    noRankedBlocksTitle: 'No continuous 2-hour slots with 3+ votes yet',
    noRankedBlocksDesc:
      'Once 3+ players mark ◯ or △ across two consecutive hours, the top block per day appears here.',
    firstChoice: (name) => `1st choice: ${name}`,
    moreVenues: (count) => `+${count} more`,
    sweetSpotBadge: '🎯 6–8 sweet spot',
    doubleCourtBadge: '🔥 9+ (2 courts)',
    altBlockBadge: '+Alt time',
    twoHourYesPill: (count) => `2h◯ ${count}`,
    flexPill: (count) => `△/1h ${count}`,
    notesTitle: 'Player Notes',
    playerCountSuffix: (count) => `${count}`,
    noNotesYet: 'No notes yet',
    noNoteText: 'No note',
    directoryTitle: (count) => `Venues & Booking Links (${count})`,
    footwearNote:
      'Gyms require indoor-only court shoes; outdoor hard courts recommend tennis/court shoes.',
    bookLink: 'Book',
    modalTopTitle: 'Recommended Venues & Voters',
    altSecondChoice: '2nd Option Today (Alt 2h Block)',
    seeDetailsBtn: 'Details',
    recTopHeading: (count) => `Top ${count} Recommended Venues`,
    openCountLabel: (count) => `${count} open`,
    outdoorLights: 'Outdoor · Lights',
    distanceFromOkayama: (km) => `~${km}km from Okayama Sta.`,
    twoHourYesGroup: (count) => `◯ Available for both hours (${count}):`,
    oneHourYesGroup: (count) => `◯ Available (${count}):`,
    twoHourMaybeGroup: (count) => `△ Flexible / 1 hour only (${count}):`,
    oneHourMaybeGroup: (count) => `△ Flexible (${count}):`,
    noGroup: (count) => `✕ Unavailable (${count}):`,
    noneLabel: 'None',
    cycleSlotBtn: 'Cycle My Vote (◯/△/✕)',
    modalViewingNote: (name) => `Viewing ${name}'s response`,
    modalTwoHourNote: 'Change 1-hour votes directly in the grid above',
    closeBtn: 'Close',
    pickVoterTitle: 'Select Response to Edit',
    pickVoterPrompt: 'Choose a member whose availability you want to update:',
    answeredSlotsCount: (count) => `${count} slots`,
    editAction: 'Edit',
    shareModalTitle: 'Share to SNS',
    sharePrompt: 'Copy & paste into the SNS group DM:',
    copiedBtn: 'Copied!',
    copyBtn: 'Copy Invite Text',
    deleteModalTitle: 'Delete response?',
    deleteModalBody: (name) =>
      `This will remove ${name}'s submitted availability response.`,
    confirmDeleteBtn: 'Delete',
    toastEnterName: 'Please enter your name',
    toastSelectSlot: 'Tap at least one open calendar slot (◯ / △ / ✕) first!',
    toastUpdatedVote: (name) => `Updated ${name}'s calendar vote!`,
    toastSubmittedVote: (name) => `Submitted ${name}'s vote!`,
    toastSaveError: 'Could not save vote. Check Supabase connection.',
    toastDeletedVote: (name) => `Removed ${name}'s response.`,
    toastDeleteError: 'Error removing response.',
    toastCopiedShare: 'Copied SNS invite summary!',
    toastSelectManual: 'Text selected — press Ctrl/Cmd+C to copy',
  },
  ja: {
    badgeIntegrated: (count) => `${count}会場統合 空き状況 & 日程調整`,
    syncedWaiting: '※ 初回空き状況スクレイピング待機中',
    appTitle: '岡大dinks 合同セッション日程調整',
    venuesSummary: (total, okayama, kurashiki) =>
      `対象施設 (${total}会場): 岡山市 (${okayama}施設) ・ 倉敷市 (${kurashiki}施設)`,
    shareToSns: 'Share to SNS',
    supabaseError: 'Supabase接続エラー: .envとテーブル設定を確認してください。',
    editingBanner: (name) => `編集中 (Editing): ${name}`,
    viewingBanner: (name) => `閲覧モード (View-Only): ${name} さんの回答を確認中`,
    defaultBanner: (count) =>
      `名前を入力して参加できる時間帯をタップ (1回の入力で${count}会場に反映)`,
    deleteBtn: '削除',
    cancelBtn: 'キャンセル',
    editThisBtn: 'この回答を編集する',
    exitViewBtn: '閲覧終了',
    nameLabel: '名前 / Name',
    namePlaceholder: '例: Kenji / Sarah',
    nameTitle: '空白のみの入力はできません / Name cannot be blank or spaces only',
    noteLabel: 'メモ / Note (希望エリア・屋内/屋外・パドル貸出など)',
    notePlaceholder: '例: 岡山市内希望 / どこでもOK / パドル借りたいです',
    editExistingBtn: '既存の回答を編集',
    submittingBtn: '送信中...',
    updateVoteBtn: '回答を更新する',
    submitVoteBtn: (count) => `回答を登録 (${count}枠)`,
    quickFillLabel: '一括入力 (Quick-Fill):',
    weekAllYes: '今週すべて ◯',
    weekAllMaybe: '今週すべて △',
    studentPrimeYes: '★ 学生向け枠のみ ◯',
    twoHourPriorityYes: '★ 2h連続のみ ◯',
    clearBtn: 'クリア',
    votedLabel: (count) => `回答済 (${count}名・クリックで閲覧):`,
    noVotesYet: 'まだ回答はありません',
    viewToggleTitle: 'クリックして閲覧モードを閉じる',
    viewModeTitle: 'クリックして回答を閲覧（誤変更防止）',
    editModeTitle: '編集中の回答',
    oneHourSubLabel: '1時間枠スケジュール (12:00–22:00)',
    prevWeek: '前週',
    nextWeek: '次週',
    allAreas: '全エリア',
    okayamaArea: '岡山市',
    kurashikiArea: '倉敷市',
    allVenuesOption: (count) => `会場: すべて (${count}施設)`,
    outdoorShort: '屋外',
    indoorShort: '屋内',
    studentPrimeFilter: '★ 学生枠',
    myVoteTab: (name) => (name ? `${name}の回答` : '自分の回答'),
    tallyTab: 'みんなの集計',
    legendYes: '参加OK',
    legendMaybe: '調整可',
    legendNo: '不可',
    legendFull: '満員',
    legendFullDesc: '全会場予約済',
    legendNo2h: '2h不可',
    legendNo2hDesc: '1hのみ空き (2h連続なし)',
    legendClosed: '空きなし',
    legendClosedDesc: '営業時間外・休場',
    legendRec2h: 'おすすめ2時間枠',
    legendPrime: '学生向け時間帯 (18:00~)',
    legendHint: '※ 「詳細」または「◯/△」タップでおすすめ予約候補TOP3と投票メンバーを表示',
    dateColHeader: '日付 / 曜日',
    allBookedDay: '空きなし',
    bookedTitle: '対象施設はすべて予約済み（満員）です',
    closedTitle: '営業時間外・休場または対象外の時間帯です（空きなし）',
    no2hTitle: '1時間枠は空きがありますが、同一会場で2時間連続になる枠がありません',
    viewingCellTitle: (name) => `${name} の回答（閲覧モード）`,
    detailsLabel: '詳細',
    top5Title: 'おすすめ2時間枠 TOP 5 (連続空き会場)',
    top5Subtitle: '日程別ベスト枠 (3名以上)',
    loadingVotes: '集計データを読み込み中...',
    noRankedBlocksTitle: '3名以上の投票がある2時間連続枠はまだありません',
    noRankedBlocksDesc:
      '上のカレンダーで連続する2時間枠（◯/△）に3名以上集まると、日程ごとのベスト枠が自動ランキングされます！',
    firstChoice: (name) => `第1候補: ${name}`,
    moreVenues: (count) => `+他${count}会場`,
    sweetSpotBadge: '🎯 6–8名ベスト人数',
    doubleCourtBadge: '🔥 9名以上 (2面推奨)',
    altBlockBadge: '+別時間帯候補あり',
    twoHourYesPill: (count) => `2h◯ ${count}`,
    flexPill: (count) => `△/1h ${count}`,
    notesTitle: '参加メンバーのコメント (Notes)',
    playerCountSuffix: (count) => `${count}名`,
    noNotesYet: 'コメントはまだありません',
    noNoteText: 'コメントなし',
    directoryTitle: (count) => `対象施設・予約ページ一覧 (${count}会場)`,
    footwearNote:
      '体育館は室内専用シューズ必須・屋外ハードコートはテニス/コートシューズ推奨です。',
    bookLink: '予約',
    modalTopTitle: 'おすすめ予約候補 & 投票メンバー詳細',
    altSecondChoice: '同日の第2候補 (Alternative 2h Block)',
    seeDetailsBtn: '詳細を見る',
    recTopHeading: (count) => `おすすめ予約候補 TOP ${count}`,
    openCountLabel: (count) => `全${count}施設空き`,
    outdoorLights: '屋外・照明',
    distanceFromOkayama: (km) => `岡山駅から約${km}km`,
    twoHourYesGroup: (count) => `◯ 2時間とも参加OK (${count}名):`,
    oneHourYesGroup: (count) => `◯ 参加OK (${count}名):`,
    twoHourMaybeGroup: (count) => `△ 調整可 / 1時間のみ参加可 (${count}名):`,
    oneHourMaybeGroup: (count) => `△ 調整可 (${count}名):`,
    noGroup: (count) => `✕ 不可 (${count}名):`,
    noneLabel: 'なし',
    cycleSlotBtn: '自分の回答を切替 (◯/△/✕)',
    modalViewingNote: (name) => `閲覧モード中 (${name})`,
    modalTwoHourNote: '※ 各1時間枠の回答は上のカレンダーから変更できます',
    closeBtn: '閉じる',
    pickVoterTitle: '編集する回答を選択 (Select Player)',
    pickVoterPrompt: '日程を変更したいメンバーを選んでください：',
    answeredSlotsCount: (count) => `${count}枠回答済`,
    editAction: '編集',
    shareModalTitle: 'SNS共有テキスト',
    sharePrompt:
      'コピーしてSNSグループDMに貼り付けてください：',
    copiedBtn: 'コピーしました！',
    copyBtn: '案内文をコピー',
    deleteModalTitle: '回答を削除しますか？',
    deleteModalBody: (name) => `${name} さんの投票データを削除します。`,
    confirmDeleteBtn: '削除する',
    toastEnterName: 'Please enter your name / 名前を入力してください',
    toastSelectSlot: 'Tap at least one open calendar slot (◯ / △ / ✕) first!',
    toastUpdatedVote: (name) => `Updated ${name}'s calendar vote!`,
    toastSubmittedVote: (name) => `Submitted ${name}'s vote!`,
    toastSaveError: 'Could not save vote. Check Supabase connection.',
    toastDeletedVote: (name) => `Removed ${name}'s response.`,
    toastDeleteError: 'Error removing response.',
    toastCopiedShare: 'Copied SNS invite summary!',
    toastSelectManual: 'テキストを選択しました — コピーしてください (Ctrl/Cmd+C)',
  },
};

function getTwoHourPreferenceRank(startHour, courtType = 'indoor') {
  if (courtType === 'outdoor') {
    if (startHour === 14) return 0; // 14:00-16:00
    if (startHour === 13) return 1; // 13:00-15:00
    if (startHour === 15) return 2; // 15:00-17:00
    return 3 + Math.abs(startHour - 14);
  }

  if (startHour === 19) return 0; // 19:00-21:00
  if (startHour === 18) return 1; // 18:00-20:00
  if (startHour === 20) return 2; // 20:00-22:00
  return 3 + Math.abs(startHour - 19);
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

/**
 * Okayama Pickleball Session Scheduler (`岡大dinks`).
 * Defaults to Japanese with an EN/JA toggle so Japanese mode can be cleanly
 * auto-translated by browsers while protecting fixed time/symbol badges.
 */
export default function App() {
  const [lang, setLang] = useState('ja');
  const t = COPY[lang] || COPY.ja;

  const [loadingVotes, setLoadingVotes] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [votes, setVotes] = useState([]);
  const [openVenuesBySlot, setOpenVenuesBySlot] = useState({});
  const [bookedVenuesBySlot, setBookedVenuesBySlot] = useState({});
  const [lastSyncedAt, setLastSyncedAt] = useState({ yoyacool: '', spacepad: '' });

  const [activeWeekIdx, setActiveWeekIdx] = useState(0);
  const [areaFilter, setAreaFilter] = useState('all');
  const [venueFilter, setVenueFilter] = useState('all');
  const [gridViewMode, setGridViewMode] = useState('vote');
  const [highlightPrimeOnly, setHighlightPrimeOnly] = useState(false);

  const [voterName, setVoterName] = useState('');
  const [voterNote, setVoterNote] = useState('');
  const [responses, setResponses] = useState({});
  const [editingVoteId, setEditingVoteId] = useState(null);
  const [viewingVote, setViewingVote] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [inspectSlot, setInspectSlot] = useState(null);
  const [showEditPickerModal, setShowEditPickerModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [voteToDelete, setVoteToDelete] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const [copiedShare, setCopiedShare] = useState(false);

  const voterBarRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const triggerToast = useCallback((msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? '' : prev));
    }, 3200);
  }, []);

  const { okayamaCount, kurashikiCount, visibleVenues } = useMemo(() => {
    let okayama = 0;
    let kurashiki = 0;
    const filtered = [];

    for (const venue of VENUES) {
      if (venue.area === 'okayama') okayama += 1;
      else if (venue.area === 'kurashiki') kurashiki += 1;

      if (areaFilter === 'all' || venue.area === areaFilter) {
        filtered.push(venue);
      }
    }

    return { okayamaCount: okayama, kurashikiCount: kurashiki, visibleVenues: filtered };
  }, [areaFilter]);

  const viewingResponsesMap = useMemo(
    () => (viewingVote ? normalizeResponsesMap(viewingVote.responses) : null),
    [viewingVote]
  );

  // --------------------------------------------------------------------------
  // 1. SUPABASE FETCH & REALTIME SUBSCRIPTION
  // --------------------------------------------------------------------------

  const fetchVotes = useCallback(async () => {
    const { data, error } = await supabase
      .from('calendar_votes')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Supabase fetch error:', error);
      setErrorMsg(t.supabaseError);
    } else {
      setErrorMsg('');
      setVotes(data || []);
    }
    setLoadingVotes(false);
  }, [t.supabaseError]);

  useEffect(() => {
    let isCancelled = false;

    async function fetchAvailability() {
      const minDate = getJstDayMeta(0).dateKey;
      const openMap = {};
      const bookedMap = {};
      let latestYoyacool = '';
      let latestSpacepad = '';

      for (let from = 0; ; from += AVAILABILITY_PAGE_SIZE) {
        const { data, error } = await supabase
          .from('court_availability')
          .select('slot_key, slot_date, time_range, court_detail, status, updated_at')
          .gte('slot_date', minDate)
          .order('slot_key', { ascending: true })
          .range(from, from + AVAILABILITY_PAGE_SIZE - 1);

        if (isCancelled || error || !data?.length) break;

        for (const row of data) {
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

          const src = VENUE_BY_ID.get(venueId)?.source;
          if (src === 'yoyacool' && row.updated_at > latestYoyacool) {
            latestYoyacool = row.updated_at;
          } else if (src === 'spacepad' && row.updated_at > latestSpacepad) {
            latestSpacepad = row.updated_at;
          }
        }

        if (data.length < AVAILABILITY_PAGE_SIZE) break;
      }

      if (isCancelled) return;
      if (Object.keys(openMap).length === 0 && Object.keys(bookedMap).length === 0) {
        return;
      }

      setOpenVenuesBySlot(openMap);
      setBookedVenuesBySlot(bookedMap);
      setLastSyncedAt({
        yoyacool: formatJstTimestamp(latestYoyacool),
        spacepad: formatJstTimestamp(latestSpacepad),
      });
    }

    fetchVotes();
    fetchAvailability();

    const channel = supabase
      .channel('calendar-votes-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'calendar_votes' },
        fetchVotes
      )
      .subscribe();

    return () => {
      isCancelled = true;
      supabase.removeChannel(channel);
    };
  }, [fetchVotes]);

  // --------------------------------------------------------------------------
  // 2. 28-DAY CALENDAR MATRIX & 2-HOUR CONTINUOUS BLOCKS
  // --------------------------------------------------------------------------

  const matchesFilter = useCallback(
    (openVenueIds) => {
      if (venueFilter !== 'all') return openVenueIds.has(venueFilter);
      if (areaFilter !== 'all') {
        for (const id of openVenueIds) {
          if (VENUE_BY_ID.get(id)?.area === areaFilter) return true;
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

      for (const block of TIME_BLOCKS) {
        const key = `${meta.dateKey}_${block.id}`;
        const openIds = openVenuesBySlot[key];
        const bookedIds = bookedVenuesBySlot[key];

        const filteredOpenVenues = openIds
          ? filterVenueList(VENUES.filter((v) => openIds.has(v.id)))
          : [];
        const filteredBookedVenues = bookedIds
          ? filterVenueList(VENUES.filter((v) => bookedIds.has(v.id)))
          : [];

        const isOpen = filteredOpenVenues.length > 0;
        if (isOpen) openCount += 1;

        slots[block.id] = {
          isOpen,
          isFullyBooked: !isOpen && filteredBookedVenues.length > 0,
          openVenues: filteredOpenVenues,
          openVenueIds: new Set(filteredOpenVenues.map((v) => v.id)),
          summaryText: filteredOpenVenues.map((v) => v.shortName).join(' / '),
          studentPrime: isWeekendOrHoliday || block.isStudentPrime,
        };
      }

      days.push({ ...meta, allBooked: openCount === 0, slots });
    }

    const weeks = [0, 7, 14, 21].map((start, idx) => {
      const slice = days.slice(start, start + 7);
      return {
        id: `week${idx + 1}`,
        shortTitle: `Week ${idx + 1}: ${slice[0].shortDate}–${slice[6].shortDate}`,
        rangeLabel: `${slice[0].year}年 ${slice[0].jpDate}(${slice[0].dow}) 〜 ${slice[6].jpDate}(${slice[6].dow})`,
        days: slice,
      };
    });

    const openSlots = [];
    weeks.forEach((week, weekIndex) => {
      for (const day of week.days) {
        for (const block of TIME_BLOCKS) {
          const cell = day.slots[block.id];
          if (!cell?.isOpen) continue;

          openSlots.push({
            slotKey: `${day.dateKey}_${block.id}`,
            weekIndex,
            dateKey: day.dateKey,
            jpDate: day.jpDate,
            dow: day.dow,
            holiday: day.holiday,
            dayType: day.dayType,
            blockId: block.id,
            startHour: block.startHour,
            timeLabel: block.label,
            openVenues: cell.openVenues,
            openVenueIds: cell.openVenueIds,
            venueSummary: cell.summaryText,
            studentPrime: cell.studentPrime,
          });
        }
      }
    });

    return {
      calendarWeeks: weeks,
      allOpenSlots: openSlots,
      hasLiveAvailability: hasLive,
    };
  }, [openVenuesBySlot, bookedVenuesBySlot, filterVenueList]);

  const activeVotes = useMemo(() => {
    const openKeySet = new Set(allOpenSlots.map((s) => s.slotKey));
    return votes.filter((vote) =>
      Object.keys(normalizeResponsesMap(vote.responses)).some((k) =>
        openKeySet.has(k)
      )
    );
  }, [votes, allOpenSlots]);

  const { twoHourHighlightMap, twoHourEligibleSlotKeys } = useMemo(() => {
    const cellMeta = {};
    const eligible = new Set();

    for (const week of calendarWeeks) {
      for (const day of week.days) {
        const candidates = [];

        for (let i = 0; i < TIME_BLOCKS.length - 1; i += 1) {
          const b1 = TIME_BLOCKS[i];
          const b2 = TIME_BLOCKS[i + 1];
          const key1 = `${day.dateKey}_${b1.id}`;
          const key2 = `${day.dateKey}_${b2.id}`;

          const ids1 = openVenuesBySlot[key1];
          const ids2 = openVenuesBySlot[key2];
          if (!ids1 || !ids2) continue;

          const shared = filterVenueList(
            VENUES.filter((v) => ids1.has(v.id) && ids2.has(v.id))
          );
          if (shared.length === 0) continue;

          eligible.add(key1);
          eligible.add(key2);

          const topVenue = rankRecommendedVenues(
            shared,
            day.dateKey,
            [b1.startHour, b2.startHour],
            openVenuesBySlot,
            1
          )[0];

          candidates.push({
            key1,
            key2,
            spanLabel: `${b1.shortLabel}–${String(b2.startHour + 1).padStart(2, '0')}:00`,
            isIndoor: topVenue?.courtType === 'indoor' ? 1 : 0,
            timePrefRank: getTwoHourPreferenceRank(b1.startHour, topVenue?.courtType),
            facilityTier: topVenue?.facilityTier ?? 0,
            distanceKm: topVenue?.distanceKm ?? 99,
            topVenueName: topVenue?.shortName || '',
          });
        }

        if (candidates.length === 0) continue;

        candidates.sort((a, b) => {
          if (b.isIndoor !== a.isIndoor) return b.isIndoor - a.isIndoor;
          if (a.timePrefRank !== b.timePrefRank) return a.timePrefRank - b.timePrefRank;
          if (b.facilityTier !== a.facilityTier) return b.facilityTier - a.facilityTier;
          return a.distanceKm - b.distanceKm;
        });

        for (const candidate of candidates) {
          for (const key of [candidate.key1, candidate.key2]) {
            if (!cellMeta[key]) {
              cellMeta[key] = {
                isTwoHourPart: true,
                isPriorityTwoHour: false,
                spanLabel: candidate.spanLabel,
                topVenueName: candidate.topVenueName,
              };
            }
          }
        }

        const best = candidates[0];
        for (const key of [best.key1, best.key2]) {
          cellMeta[key] = {
            isTwoHourPart: true,
            isPriorityTwoHour: true,
            spanLabel: best.spanLabel,
            topVenueName: best.topVenueName,
          };
        }
      }
    }

    return { twoHourHighlightMap: cellMeta, twoHourEligibleSlotKeys: eligible };
  }, [calendarWeeks, openVenuesBySlot, filterVenueList]);

  // --------------------------------------------------------------------------
  // 3. TALLIES & TOP 5 INDEPENDENT-DATE 2-HOUR BLOCKS (MIN 3 VOTES)
  // --------------------------------------------------------------------------

  const slotTallies = useMemo(() => {
    const tallyMap = {};
    let bestScore = 0;

    for (const slot of allOpenSlots) {
      const yesPlayers = [];
      const maybePlayers = [];
      const noPlayers = [];

      for (const vote of votes) {
        const choice = getMergedVoterChoice(vote.responses, slot.slotKey);
        if (choice === 'yes') yesPlayers.push(vote);
        else if (choice === 'maybe') maybePlayers.push(vote);
        else if (choice === 'no') noPlayers.push(vote);
      }

      const score = yesPlayers.length * 100 + maybePlayers.length * 10;
      if (yesPlayers.length > 0 && score > bestScore) bestScore = score;

      const prevIds =
        openVenuesBySlot[
          `${slot.dateKey}_${String(slot.startHour - 1).padStart(2, '0')}:00-${String(slot.startHour).padStart(2, '0')}:00`
        ];
      const nextIds =
        openVenuesBySlot[
          `${slot.dateKey}_${String(slot.startHour + 1).padStart(2, '0')}:00-${String(slot.startHour + 2).padStart(2, '0')}:00`
        ];

      // Exclude venues that are only open for 1 hour (2h不可 on their own)
      const twoHourEligibleVenues = slot.openVenues.filter(
        (v) => prevIds?.has(v.id) || nextIds?.has(v.id)
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
        openVenues: twoHourEligibleVenues,
        recommendedVenues: rankRecommendedVenues(
          twoHourEligibleVenues,
          slot.dateKey,
          [slot.startHour],
          openVenuesBySlot,
          3
        ),
        isSweetSpot: yesPlayers.length >= 6 && yesPlayers.length <= 8,
        isDoubleCourt: yesPlayers.length >= 9,
        isTopPick: false,
      };
    }

    if (bestScore > 0) {
      for (const slot of allOpenSlots) {
        if (tallyMap[slot.slotKey].score === bestScore) {
          tallyMap[slot.slotKey].isTopPick = true;
        }
      }
    }

    return tallyMap;
  }, [allOpenSlots, votes, openVenuesBySlot]);

  const rankedTwoHourBlocks = useMemo(() => {
    const bestByDate = [];

    for (const week of calendarWeeks) {
      for (const day of week.days) {
        const dayBlocks = [];

        for (let i = 0; i < TIME_BLOCKS.length - 1; i += 1) {
          const b1 = TIME_BLOCKS[i];
          const b2 = TIME_BLOCKS[i + 1];
          const slotKey1 = `${day.dateKey}_${b1.id}`;
          const slotKey2 = `${day.dateKey}_${b2.id}`;

          const ids1 = openVenuesBySlot[slotKey1];
          const ids2 = openVenuesBySlot[slotKey2];
          if (!ids1 || !ids2) continue;

          const filteredShared = filterVenueList(
            VENUES.filter((v) => ids1.has(v.id) && ids2.has(v.id))
          );
          if (filteredShared.length === 0) continue;

          const bothYesPlayers = [];
          const flexBothPlayers = [];
          const partialYesPlayers = [];
          const noPlayers = [];

          for (const vote of votes) {
            const c1 = getMergedVoterChoice(vote.responses, slotKey1);
            const c2 = getMergedVoterChoice(vote.responses, slotKey2);

            if (c1 === 'yes' && c2 === 'yes') {
              bothYesPlayers.push(vote);
            } else if (
              (c1 === 'yes' || c1 === 'maybe') &&
              (c2 === 'yes' || c2 === 'maybe')
            ) {
              flexBothPlayers.push(vote);
            } else if (c1 === 'yes' || c2 === 'yes') {
              partialYesPlayers.push(vote);
            } else if (c1 === 'no' || c2 === 'no') {
              noPlayers.push(vote);
            }
          }

          const totalVotes =
            bothYesPlayers.length + flexBothPlayers.length + partialYesPlayers.length;
          if (totalVotes < 3) continue;

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
          const topCourtType = recommendedVenues[0]?.courtType;

          dayBlocks.push({
            slotKey: `${day.dateKey}_${b1.id}__2h`,
            slotKey1,
            slotKey2,
            isTwoHourBlock: true,
            dateKey: day.dateKey,
            jpDate: day.jpDate,
            dow: day.dow,
            holiday: day.holiday,
            timeLabel: `${b1.shortLabel}–${String(b2.startHour + 1).padStart(2, '0')}:00 (2時間)`,
            isIndoor: topCourtType === 'indoor' ? 1 : 0,
            timePrefRank: getTwoHourPreferenceRank(b1.startHour, topCourtType),
            openVenues: filteredShared,
            recommendedVenues,
            venueSummary: recommendedVenues.map((v) => v.shortName).join(' / '),
            yesPlayers: bothYesPlayers,
            maybePlayers: [...flexBothPlayers, ...partialYesPlayers],
            noPlayers,
            bothYesCount: bothYesPlayers.length,
            flexBothCount: flexBothPlayers.length,
            partialYesCount: partialYesPlayers.length,
            totalVotes,
            score,
            isSweetSpot: bothYesPlayers.length >= 6 && bothYesPlayers.length <= 8,
            isDoubleCourt: bothYesPlayers.length >= 9,
          });
        }

        if (dayBlocks.length === 0) continue;

        dayBlocks.sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          if (b.isIndoor !== a.isIndoor) return b.isIndoor - a.isIndoor;
          return a.timePrefRank - b.timePrefRank;
        });
        const [primaryBlock, secondBestBlock = null] = dayBlocks;

        bestByDate.push({
          ...primaryBlock,
          alternativeTwoHourBlock: secondBestBlock,
        });
      }
    }

    return bestByDate.sort((a, b) => b.score - a.score).slice(0, 5);
  }, [calendarWeeks, openVenuesBySlot, filterVenueList, votes]);

  // --------------------------------------------------------------------------
  // 4. INTERACTIVE CELL CYCLING & VOTER ACTIONS
  // --------------------------------------------------------------------------

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

  const applyQuickFill = (predicate, value, successMessage) => {
    if (viewingVote) {
      triggerToast(t.viewingBanner(viewingVote.name));
      return;
    }

    setResponses((prev) => {
      const next = { ...prev };
      for (const slot of allOpenSlots) {
        if (!predicate(slot)) continue;
        if (!matchesFilter(slot.openVenueIds)) continue;
        if (value !== 'clear' && !twoHourEligibleSlotKeys.has(slot.slotKey)) continue;

        if (value === 'clear') delete next[slot.slotKey];
        else next[slot.slotKey] = value;
      }
      return next;
    });

    triggerToast(successMessage);
  };

  const handleQuickFillWeek = (val) => {
    const currentWeek = calendarWeeks[activeWeekIdx];
    const message =
      val === 'clear'
        ? `${t.clearBtn}: ${currentWeek.shortTitle}`
        : `${currentWeek.shortTitle} (${val === 'yes' ? '◯' : '△'})`;

    applyQuickFill((slot) => slot.weekIndex === activeWeekIdx, val, message);
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
    triggerToast(t.viewingBanner(vote.name));
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
    triggerToast(t.editingBanner(vote.name));
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
    if (Object.keys(cleanResponses).length === 0) {
      triggerToast(t.toastSelectSlot);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: trimmedName,
        note: voterNote.trim(),
        responses: cleanResponses,
      };

      const { error } = editingVoteId
        ? await supabase
            .from('calendar_votes')
            .update({ ...payload, updated_at: new Date().toISOString() })
            .eq('id', editingVoteId)
        : await supabase.from('calendar_votes').insert([payload]);

      if (error) throw error;

      triggerToast(
        editingVoteId ? t.toastUpdatedVote(trimmedName) : t.toastSubmittedVote(trimmedName)
      );
      await fetchVotes();
      resetVoterForm();
    } catch (err) {
      console.error('Supabase save error:', err);
      triggerToast(t.toastSaveError);
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
      triggerToast(t.toastDeletedVote(voteToDelete.name));
    } catch (err) {
      console.error('Supabase delete error:', err);
      triggerToast(t.toastDeleteError);
    } finally {
      setVoteToDelete(null);
    }
  };

  // --------------------------------------------------------------------------
  // 5. SNS INVITE SUMMARY
  // --------------------------------------------------------------------------

  const shareSummaryText = useMemo(() => {
    if (rankedTwoHourBlocks.length === 0) {
      return lang === 'en'
        ? [
            '🏓 Okadai dinks | Next Session Poll',
            'No 2-hour continuous slots with votes yet — pick your available times via the link!',
            window.location.origin,
          ].join('\n')
        : [
            '🏓 岡大dinks | 次回セッション日程調整',
            'まだ2時間連続の投票がありません — リンクから参加できる時間帯を選んでください！',
            window.location.origin,
          ].join('\n');
    }

    const bestBlock = [...rankedTwoHourBlocks].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.dateKey.localeCompare(b.dateKey);
    })[0];

    const topVenue = bestBlock.recommendedVenues[0];
    const hol = bestBlock.holiday ? `(${bestBlock.holiday})` : '';
    const jpDateLabel = `${bestBlock.jpDate}(${bestBlock.dow})${hol}`;
    const startHour = Number(bestBlock.slotKey1.slice(-11, -9));

    const eventUrl = new URL('/api/event', window.location.origin);
    if (topVenue?.id) eventUrl.searchParams.set('v', topVenue.id);
    eventUrl.searchParams.set('date', bestBlock.dateKey);
    eventUrl.searchParams.set('start', String(startHour));
    eventUrl.searchParams.set('end', String(startHour + 2));

    const flexTotal = bestBlock.flexBothCount + bestBlock.partialYesCount;

    if (lang === 'en') {
      const footwearEn =
        topVenue?.courtType === 'outdoor'
          ? '👟 Outdoor hard court — tennis/court shoes recommended'
          : '👟 Indoor gym — indoor-only court shoes required';
      const flexEn = flexTotal > 0 ? ` (Maybe/1h: ${flexTotal})` : '';

      return [
        '🏓 Okadai dinks | Next Session Invite',
        `📅 Date & Time: ${bestBlock.dateKey} (${bestBlock.dow}) ${bestBlock.timeLabel}`,
        `🏟 Venue: ${topVenue?.fullName || bestBlock.venueSummary}`,
        `👥 Going: ${bestBlock.bothYesCount}${flexEn} players`,
        footwearEn,
        '🗓 Add to Calendar & Map 👇',
        eventUrl.toString(),
      ].join('\n');
    }

    const footwearJa =
      topVenue?.courtType === 'outdoor'
        ? '👟 屋外コートのためテニス・ハードコート用シューズ推奨'
        : '👟 体育館のため室内専用シューズ必須';
    const flexJa = flexTotal > 0 ? ` (調整可 ${flexTotal}名)` : '';

    return [
      '🏓 岡大dinks | 次回セッション案内',
      `📅 日時: ${jpDateLabel} ${bestBlock.timeLabel}`,
      `🏟 会場: ${topVenue?.fullName || bestBlock.venueSummary}`,
      `👥 参加予定: ◯${bestBlock.bothYesCount}名${flexJa}`,
      footwearJa,
      '🗓 カレンダー追加・地図はこちら 👇',
      eventUrl.toString(),
    ].join('\n');
  }, [rankedTwoHourBlocks, lang]);

  const handleCopyShareText = async () => {
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(shareSummaryText);
        setCopiedShare(true);
        triggerToast(t.toastCopiedShare);
        setTimeout(() => setCopiedShare(false), 2500);
        return;
      } catch {
        // Fall through to manual textarea selection
      }
    }

    textareaRef.current?.focus();
    textareaRef.current?.select();
    triggerToast(t.toastSelectManual);
  };

  const currentWeek = calendarWeeks[activeWeekIdx];
  const selectedSlotCount = Object.keys(responses).length;
  const showEditExistingButton =
    !editingVoteId &&
    activeVotes.length > 0 &&
    !voterName.trim() &&
    selectedSlotCount === 0;

  return (
    <div className="min-h-screen bg-[#eef2f6] text-slate-900 pb-16 font-sans selection:bg-lime-300 selection:text-slate-950">
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
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 bg-white/10 rounded-xl border border-white/20 shrink-0">
                <PickleballIcon className="w-7 h-7" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-lime-400 text-[#1B365D] text-[11px] font-extrabold tracking-tight whitespace-nowrap">
                    {t.badgeIntegrated(VENUES.length)}
                  </span>
                  {hasLiveAvailability ? (
                    <span
                      translate="no"
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/10 text-[10px] text-lime-200 font-semibold whitespace-nowrap"
                    >
                      <RefreshCw className="w-2.5 h-2.5 shrink-0" />
                      <span>
                        yoyacool({lastSyncedAt.yoyacool || '同期済'}) / Spacepad(
                        {lastSyncedAt.spacepad || '同期済'})
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
                    {t.venuesSummary(VENUES.length, okayamaCount, kurashikiCount)}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
              <div
                translate="no"
                className="inline-flex rounded-xl bg-white/10 p-0.5 border border-white/20 text-xs font-extrabold whitespace-nowrap"
                title="Default is JA; switch to EN for English"
              >
                <button
                  type="button"
                  onClick={() => setLang('ja')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition cursor-pointer ${
                    lang === 'ja'
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
                    lang === 'en'
                      ? 'bg-white text-[#1B365D] shadow-xs'
                      : 'text-sky-100 hover:text-white'
                  }`}
                >
                  EN
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowShareModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-lime-400 hover:bg-lime-300 active:scale-95 text-[#1B365D] text-xs sm:text-sm font-extrabold shadow transition cursor-pointer whitespace-nowrap"
              >
                <Share2 className="w-4 h-4 shrink-0" />
                <span>{t.shareToSns}</span>
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
            <div className="flex items-center gap-2 min-w-0">
              {viewingVote ? (
                <Eye className="w-3.5 h-3.5 text-lime-300 shrink-0" />
              ) : (
                <Edit3 className="w-3.5 h-3.5 text-lime-300 shrink-0" />
              )}
              <span>
                {editingVoteId
                  ? t.editingBanner(voterName)
                  : viewingVote
                    ? t.viewingBanner(viewingVote.name)
                    : t.defaultBanner(VENUES.length)}
              </span>
            </div>

            {editingVoteId && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    setVoteToDelete({ id: editingVoteId, name: voterName })
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

            {viewingVote && !editingVoteId && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleSelectVoterToEdit(viewingVote)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-400 text-slate-950 hover:bg-amber-300 cursor-pointer whitespace-nowrap"
                >
                  <Edit3 className="w-3 h-3 shrink-0" />
                  <span>{t.editThisBtn}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewingVote(null)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white text-slate-800 hover:bg-slate-100 cursor-pointer whitespace-nowrap"
                >
                  <X className="w-3 h-3 shrink-0" />
                  <span>{t.exitViewBtn}</span>
                </button>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmitVote} className="p-3.5 sm:p-4 space-y-3">
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
                    className="w-full py-2.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-[0.99] text-slate-950 font-extrabold text-xs sm:text-sm shadow border border-amber-500 transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <UserCheck className="w-4 h-4 shrink-0" />
                    <span>{t.editExistingBtn}</span>
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#1B365D] hover:bg-[#274b7d] active:scale-[0.99] text-lime-300 font-extrabold text-xs sm:text-sm shadow transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
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

            {/* Quick-fill toolbar + Existing Voters Strip */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/80">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-500 mr-1 whitespace-nowrap">
                  {t.quickFillLabel}
                </span>
                <button
                  type="button"
                  onClick={() => handleQuickFillWeek('yes')}
                  className="px-2.5 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-900 font-extrabold text-xs border border-emerald-300 cursor-pointer whitespace-nowrap"
                >
                  {t.weekAllYes}
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickFillWeek('maybe')}
                  className="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 font-extrabold text-xs border border-amber-300 cursor-pointer whitespace-nowrap"
                >
                  {t.weekAllMaybe}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    applyQuickFill(
                      (slot) => slot.studentPrime,
                      'yes',
                      t.studentPrimeYes
                    )
                  }
                  className="px-2.5 py-1 rounded-lg bg-sky-100 hover:bg-sky-200 text-sky-900 font-extrabold text-xs border border-sky-300 cursor-pointer whitespace-nowrap"
                >
                  {t.studentPrimeYes}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    applyQuickFill(
                      (slot) => Boolean(twoHourHighlightMap[slot.slotKey]?.isPriorityTwoHour),
                      'yes',
                      t.twoHourPriorityYes
                    )
                  }
                  className="px-2.5 py-1 rounded-lg bg-indigo-100 hover:bg-indigo-200 text-indigo-950 font-extrabold text-xs border border-indigo-300 cursor-pointer whitespace-nowrap"
                >
                  {t.twoHourPriorityYes}
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickFillWeek('clear')}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-300 cursor-pointer whitespace-nowrap"
                >
                  {t.clearBtn}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1 whitespace-nowrap">
                  <Users className="w-3.5 h-3.5 text-[#1B365D] shrink-0" />
                  <span>{t.votedLabel(activeVotes.length)}</span>
                </span>
                {activeVotes.length === 0 ? (
                  <span className="text-[11px] text-slate-400 italic">
                    {t.noVotesYet}
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
                            ? t.viewToggleTitle
                            : isEditing
                              ? t.editModeTitle
                              : t.viewModeTitle
                        }
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border transition cursor-pointer whitespace-nowrap ${
                          isEditing
                            ? 'bg-amber-400 text-slate-950 border-amber-600'
                            : isViewing
                              ? 'bg-sky-700 text-white border-sky-900 shadow-2xs'
                              : 'bg-slate-100 hover:bg-sky-100 text-[#1B365D] border-slate-300'
                        }`}
                      >
                        <span translate="no">{v.name}</span>
                        {isEditing ? (
                          <Edit3 className="w-2.5 h-2.5 opacity-80 shrink-0" />
                        ) : (
                          <Eye className="w-2.5 h-2.5 opacity-70 shrink-0" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </form>
        </section>

        {/* 2. WEEK NAVIGATION & 1-HOUR MATRIX */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-300 overflow-hidden">
          <div className="bg-[#1B365D] px-3 py-2.5 flex flex-wrap items-center justify-between gap-2 text-white">
            <button
              type="button"
              disabled={activeWeekIdx === 0}
              onClick={() => setActiveWeekIdx((i) => Math.max(0, i - 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#2B547E] hover:bg-[#366799] disabled:opacity-40 disabled:pointer-events-none text-xs font-extrabold border border-white/20 cursor-pointer whitespace-nowrap shrink-0"
            >
              <ChevronLeft className="w-4 h-4 shrink-0" />
              <span>{t.prevWeek}</span>
            </button>

            <div className="text-center min-w-0">
              <div className="inline-block px-2 py-0.5 rounded bg-rose-700 text-white text-[10px] font-extrabold tracking-wider mb-0.5 whitespace-nowrap">
                {t.oneHourSubLabel}
              </div>
              <div
                translate="no"
                className="text-sm sm:text-base font-extrabold tracking-tight text-white"
              >
                {currentWeek.rangeLabel}
              </div>
            </div>

            <button
              type="button"
              disabled={activeWeekIdx === calendarWeeks.length - 1}
              onClick={() =>
                setActiveWeekIdx((i) => Math.min(calendarWeeks.length - 1, i + 1))
              }
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#2B547E] hover:bg-[#366799] disabled:opacity-40 disabled:pointer-events-none text-xs font-extrabold border border-white/20 cursor-pointer whitespace-nowrap shrink-0"
            >
              <span>{t.nextWeek}</span>
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
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer border whitespace-nowrap ${
                    activeWeekIdx === idx
                      ? 'bg-[#1B365D] text-lime-300 border-[#1B365D] shadow-xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  <span translate="no">{w.shortTitle}</span>
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {okayamaCount > 0 && kurashikiCount > 0 && (
                <div className="inline-flex rounded-xl bg-slate-200 p-0.5 border border-slate-300 text-xs font-extrabold">
                  {[
                    { id: 'all', label: t.allAreas, activeClass: 'bg-white text-[#1B365D]' },
                    { id: 'okayama', label: t.okayamaArea, activeClass: 'bg-lime-400 text-[#1B365D]' },
                    { id: 'kurashiki', label: t.kurashikiArea, activeClass: 'bg-sky-300 text-[#1B365D]' },
                  ].map((area) => (
                    <button
                      key={area.id}
                      type="button"
                      onClick={() => {
                        setAreaFilter(area.id);
                        setVenueFilter('all');
                      }}
                      className={`px-2.5 py-1 rounded-lg transition cursor-pointer whitespace-nowrap ${
                        areaFilter === area.id
                          ? `${area.activeClass} shadow-xs`
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {area.label}
                    </button>
                  ))}
                </div>
              )}

              <select
                aria-label="Venue filter"
                value={venueFilter}
                onChange={(e) => setVenueFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-extrabold text-[#1B365D] focus:border-[#1B365D] outline-none cursor-pointer max-w-[220px]"
              >
                <option value="all">{t.allVenuesOption(visibleVenues.length)}</option>
                {visibleVenues.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.shortName} ({v.courtType === 'outdoor' ? t.outdoorShort : t.indoorShort})
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setHighlightPrimeOnly((p) => !p)}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer whitespace-nowrap ${
                  highlightPrimeOnly
                    ? 'bg-amber-100 text-amber-950 border-amber-400'
                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>{t.studentPrimeFilter}</span>
              </button>

              <div className="inline-flex rounded-xl bg-slate-200 p-0.5 border border-slate-300">
                <button
                  type="button"
                  onClick={() => setGridViewMode('vote')}
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-extrabold transition cursor-pointer whitespace-nowrap ${
                    gridViewMode === 'vote'
                      ? 'bg-white text-[#1B365D] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Grid className="w-3.5 h-3.5 shrink-0" />
                  <span>{t.myVoteTab(viewingVote?.name)}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setGridViewMode('heatmap')}
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-extrabold transition cursor-pointer whitespace-nowrap ${
                    gridViewMode === 'heatmap'
                      ? 'bg-[#1B365D] text-lime-300 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5 shrink-0" />
                  <span>{t.tallyTab}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Symbol Legend */}
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
            <span className="font-bold text-[#1B365D]">{t.legendHint}</span>
          </div>

          {/* Schedule Matrix Table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-center">
              <thead>
                <tr className="bg-[#eef3f8] border-b-2 border-slate-300 text-slate-800">
                  <th className="sticky left-0 z-20 bg-[#dce5f0] py-2.5 px-2 min-w-[104px] sm:min-w-[120px] text-left text-xs font-extrabold text-[#1B365D] border-r-2 border-slate-300 whitespace-nowrap">
                    {t.dateColHeader}
                  </th>
                  {TIME_BLOCKS.map((block) => (
                    <th
                      key={block.id}
                      title={block.label}
                      className={`py-2.5 px-1 min-w-[70px] sm:min-w-[82px] border-r border-slate-300 last:border-r-0 transition ${
                        block.isStudentPrime
                          ? 'bg-amber-100/90 border-b-2 border-b-amber-400'
                          : ''
                      }`}
                    >
                      <div
                        translate="no"
                        className="text-[11px] sm:text-xs font-extrabold text-[#1B365D] tracking-tight whitespace-nowrap"
                      >
                        {block.shortLabel}~
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-300">
                {currentWeek.days.map((day) => {
                  const dateTextColor =
                    day.dayType === 'saturday'
                      ? 'text-blue-700'
                      : day.dayType === 'sunday' || day.dayType === 'holiday'
                        ? 'text-red-600'
                        : 'text-slate-900';
                  const dateBgColor =
                    day.dayType === 'saturday'
                      ? 'bg-blue-50'
                      : day.dayType === 'sunday' || day.dayType === 'holiday'
                        ? 'bg-red-50'
                        : 'bg-[#f8fafc]';

                  return (
                    <tr key={day.dateKey} className="h-[88px] divide-x divide-slate-300">
                      <td
                        className={`sticky left-0 z-10 ${dateBgColor} h-full px-2 text-left border-r-2 border-slate-300 align-middle`}
                      >
                        <div className="flex items-center gap-1 flex-wrap">
                          <span
                            translate="no"
                            className={`text-xs sm:text-sm font-extrabold underline decoration-slate-300 whitespace-nowrap ${dateTextColor}`}
                          >
                            {day.jpDate}({day.dow})
                          </span>
                          {day.holiday && (
                            <span
                              translate="no"
                              className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-600 text-white text-[10px] font-extrabold shrink-0"
                            >
                              {day.holiday}
                            </span>
                          )}
                        </div>
                        {day.allBooked && (
                          <span className="inline-block mt-0.5 text-[10px] font-bold text-slate-400 leading-tight">
                            {t.allBookedDay}
                          </span>
                        )}
                      </td>

                      {TIME_BLOCKS.map((block) => {
                        const cellData = day.slots[block.id];

                        if (!cellData?.isOpen) {
                          const isBooked = Boolean(cellData?.isFullyBooked);
                          return (
                            <td
                              key={block.id}
                              title={isBooked ? t.bookedTitle : t.closedTitle}
                              className={`${
                                isBooked ? 'bg-[#e5e7eb]' : 'bg-slate-100/90'
                              } h-full px-0.5 align-middle select-none cursor-not-allowed`}
                            >
                              <div
                                className={`h-full flex flex-col items-center justify-center gap-0.5 max-w-[78px] mx-auto leading-tight ${
                                  isBooked ? 'text-slate-500' : 'text-slate-400'
                                }`}
                              >
                                <span
                                  translate="no"
                                  className="text-xs font-extrabold leading-none"
                                >
                                  {isBooked ? '✕' : '—'}
                                </span>
                                <span
                                  className={`text-[10px] text-center break-words line-clamp-2 ${
                                    isBooked ? 'font-bold' : 'font-medium'
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
                              className="bg-slate-200/85 h-full px-0.5 align-middle select-none cursor-not-allowed"
                            >
                              <div className="h-full flex flex-col items-center justify-center gap-0.5 text-slate-500 max-w-[78px] mx-auto leading-tight">
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

                        const activeChoice = viewingResponsesMap
                          ? viewingResponsesMap[slotKey]
                          : responses[slotKey];
                        const twoHourInfo = twoHourHighlightMap[slotKey];
                        const tally = slotTallies[slotKey] || {
                          yesCount: 0,
                          maybeCount: 0,
                          noCount: 0,
                          isTopPick: false,
                        };

                        const isDimmed =
                          (highlightPrimeOnly && !cellData.studentPrime) ||
                          !matchesFilter(cellData.openVenueIds);

                        let cellBg = twoHourInfo?.isPriorityTwoHour
                          ? 'bg-indigo-50/70 hover:bg-indigo-100/70'
                          : block.isStudentPrime
                            ? 'bg-amber-50/45 hover:bg-amber-50/80'
                            : 'bg-white hover:bg-sky-50';

                        if (gridViewMode === 'heatmap') {
                          if (tally.yesCount >= 6) {
                            cellBg = 'bg-emerald-200/90 hover:bg-emerald-200';
                          } else if (tally.yesCount >= 3) {
                            cellBg = 'bg-emerald-100/80 hover:bg-emerald-100';
                          } else if (tally.yesCount >= 1) {
                            cellBg = 'bg-lime-50 hover:bg-lime-100';
                          } else {
                            cellBg = 'bg-slate-50/70 hover:bg-slate-100';
                          }
                        } else if (activeChoice === 'yes') {
                          cellBg = 'bg-emerald-50/90 hover:bg-emerald-100/80';
                        } else if (activeChoice === 'maybe') {
                          cellBg = 'bg-amber-50/90 hover:bg-amber-100/80';
                        } else if (activeChoice === 'no') {
                          cellBg = 'bg-rose-50/80 hover:bg-rose-100/70';
                        }

                        const highlightRing = tally.isTopPick
                          ? 'ring-2 ring-inset ring-amber-400'
                          : twoHourInfo?.isPriorityTwoHour
                            ? 'ring-2 ring-inset ring-indigo-400'
                            : '';

                        return (
                          <td
                            key={block.id}
                            className={`p-1 h-full align-middle transition ${cellBg} ${
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
                                    ? t.viewingCellTitle(viewingVote.name)
                                    : `${day.jpDate}(${day.dow}) ${block.label} · ${cellData.summaryText}`
                                }
                              >
                                {gridViewMode === 'vote' ? (
                                  <span translate="no">
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
                                  </span>
                                ) : (
                                  <div
                                    translate="no"
                                    className="h-7 flex flex-col items-center justify-center leading-tight whitespace-nowrap"
                                  >
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
                                className="w-full py-0.5 px-1 rounded bg-slate-100/90 hover:bg-[#1B365D] hover:text-white text-[10px] font-extrabold text-slate-700 flex items-center justify-center gap-1 border border-slate-200 transition cursor-pointer whitespace-nowrap"
                                title={cellData.summaryText}
                              >
                                {gridViewMode === 'heatmap' ? (
                                  <span>{t.detailsLabel}</span>
                                ) : (
                                  <span translate="no" className="inline-flex items-center gap-1">
                                    <span className="text-emerald-700">
                                      ◯{tally.yesCount}
                                    </span>
                                    <span className="text-amber-600">
                                      △{tally.maybeCount}
                                    </span>
                                  </span>
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

        {/* 3. TOP 5 RECOMMENDED 2-HOUR BLOCKS (INDEPENDENT DATES, >= 3 VOTES) & PLAYER COMMENTS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <section className="lg:col-span-7 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 bg-[#1B365D] text-white flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Trophy className="w-4 h-4 text-lime-300 shrink-0" />
                <h2 className="font-extrabold text-xs sm:text-sm">{t.top5Title}</h2>
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
              ) : rankedTwoHourBlocks.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-500 space-y-1">
                  <p className="font-bold text-slate-700">{t.noRankedBlocksTitle}</p>
                  <p>{t.noRankedBlocksDesc}</p>
                </div>
              ) : (
                rankedTwoHourBlocks.map((block, index) => (
                  <div
                    key={block.dateKey}
                    onClick={() => setInspectSlot(block)}
                    className={`p-3 rounded-xl border flex flex-wrap items-center justify-between gap-2 transition cursor-pointer ${
                      index === 0
                        ? 'bg-lime-50/90 border-lime-400'
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                    }`}
                  >
                    <div className="flex items-start sm:items-center gap-2.5 flex-1 min-w-0">
                      <span
                        translate="no"
                        className={`w-6 h-6 rounded-full text-xs font-extrabold flex items-center justify-center shrink-0 mt-0.5 sm:mt-0 ${
                          index === 0
                            ? 'bg-[#1B365D] text-lime-300'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs sm:text-sm font-extrabold text-slate-900 leading-snug">
                          <span translate="no">
                            {block.jpDate}({block.dow})
                            {block.holiday ? `・${block.holiday}` : ''}
                          </span>{' '}
                          <span
                            translate="no"
                            className="text-[#1B365D] whitespace-nowrap"
                          >
                            {block.timeLabel}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600 flex flex-wrap items-center gap-1.5 mt-1">
                          <span className="font-bold text-[#1B365D]">
                            {t.firstChoice(block.recommendedVenues[0]?.shortName)}
                          </span>
                          {block.openVenues.length > 1 && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-700 font-bold text-[10px] whitespace-nowrap">
                              {t.moreVenues(block.openVenues.length - 1)}
                            </span>
                          )}
                          {block.isSweetSpot && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-extrabold text-[10px] whitespace-nowrap">
                              {t.sweetSpotBadge}
                            </span>
                          )}
                          {block.isDoubleCourt && (
                            <span className="px-1.5 py-0.5 rounded bg-sky-100 text-sky-900 font-extrabold text-[10px] whitespace-nowrap">
                              {t.doubleCourtBadge}
                            </span>
                          )}
                          {block.alternativeTwoHourBlock && (
                            <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 font-bold text-[10px] whitespace-nowrap">
                              {t.altBlockBadge}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
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
                          {t.flexPill(block.flexBothCount + block.partialYesCount)}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="lg:col-span-5 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            <div className="px-4 py-3 bg-[#264673] text-white flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <MessageSquare className="w-4 h-4 text-lime-300 shrink-0" />
                <h2 className="font-extrabold text-xs sm:text-sm">{t.notesTitle}</h2>
              </div>
              <span
                translate="no"
                className="text-[11px] text-sky-200 whitespace-nowrap shrink-0"
              >
                {t.playerCountSuffix(activeVotes.length)}
              </span>
            </div>

            <div className="p-3.5 space-y-2 max-h-[430px] overflow-y-auto flex-1">
              {activeVotes.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-6 text-center">
                  {t.noNotesYet}
                </p>
              ) : (
                activeVotes.map((v) => (
                  <div
                    key={v.id}
                    onClick={() => handleSelectVoterToView(v)}
                    className="p-2.5 rounded-xl bg-slate-50 hover:bg-sky-50 border border-slate-200 flex items-start justify-between gap-2 cursor-pointer transition"
                  >
                    <div className="min-w-0">
                      <div
                        translate="no"
                        className="text-xs font-extrabold text-[#1B365D]"
                      >
                        {v.name}
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5 break-words">
                        {v.note || (
                          <span className="text-slate-400 italic">{t.noNoteText}</span>
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
              <Info className="w-4 h-4 text-[#1B365D] shrink-0" />
              <span>{t.directoryTitle(VENUES.length)}</span>
            </span>
            <span>{t.footwearNote}</span>
          </div>

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
                    {v.courtType === 'outdoor' ? t.outdoorShort : t.indoorShort}
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
        </footer>
      </main>

      {/* MODAL 1: SLOT BREAKDOWN INSPECTOR */}
      {inspectSlot && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3.5 bg-[#1B365D] text-white flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[11px] text-lime-300 font-bold">
                  {t.modalTopTitle}
                </div>
                <h3 translate="no" className="font-extrabold text-sm sm:text-base">
                  {inspectSlot.jpDate}({inspectSlot.dow}) {inspectSlot.timeLabel}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectSlot(null)}
                className="p-1 rounded-lg hover:bg-white/15 text-slate-200 cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs max-h-[82vh] overflow-y-auto">
              {inspectSlot.alternativeTwoHourBlock && (
                <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[10px] font-extrabold text-indigo-700">
                      {t.altSecondChoice}
                    </div>
                    <div
                      translate="no"
                      className="font-extrabold text-slate-900 truncate"
                    >
                      {inspectSlot.alternativeTwoHourBlock.timeLabel} —{' '}
                      {inspectSlot.alternativeTwoHourBlock.recommendedVenues[0]?.shortName}
                    </div>
                    <div translate="no" className="text-[10px] text-slate-600">
                      2h◯ {inspectSlot.alternativeTwoHourBlock.bothYesCount} /{' '}
                      {inspectSlot.alternativeTwoHourBlock.totalVotes}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setInspectSlot({
                        ...inspectSlot.alternativeTwoHourBlock,
                        alternativeTwoHourBlock: {
                          ...inspectSlot,
                          alternativeTwoHourBlock: null,
                        },
                      })
                    }
                    className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-[11px] shrink-0 cursor-pointer whitespace-nowrap"
                  >
                    {t.seeDetailsBtn}
                  </button>
                </div>
              )}

              <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-extrabold text-[#1B365D] inline-flex items-center gap-1">
                    <Award className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>{t.recTopHeading(inspectSlot.recommendedVenues?.length || 0)}</span>
                  </span>
                  <span className="text-[10px] text-slate-500 whitespace-nowrap">
                    {t.openCountLabel(inspectSlot.openVenues?.length || 0)}
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
                          translate="no"
                          className={`w-4 h-4 rounded-full text-[10px] font-extrabold flex items-center justify-center shrink-0 ${
                            idx === 0
                              ? 'bg-[#1B365D] text-lime-300'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold shrink-0 whitespace-nowrap ${
                            v.courtType === 'outdoor'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-sky-100 text-sky-800'
                          }`}
                        >
                          {v.courtType === 'outdoor'
                            ? v.hasLights
                              ? t.outdoorLights
                              : t.outdoorShort
                            : t.indoorShort}
                        </span>
                        <span className="font-extrabold text-slate-900 truncate">
                          {v.fullName}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 pl-5 text-[10px]">
                        {v.continuousSpan && (
                          <span
                            translate="no"
                            className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold"
                          >
                            ★ {v.continuousSpan}
                          </span>
                        )}
                        <span className="text-slate-500">
                          {t.distanceFromOkayama(v.distanceKm)}
                        </span>
                      </div>
                    </div>

                    <a
                      href={v.bookingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 px-2 py-1 rounded bg-[#1B365D] text-lime-300 font-extrabold text-[11px] hover:bg-[#274b7d] shrink-0 whitespace-nowrap"
                    >
                      <span>{t.bookLink}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  </div>
                ))}
              </div>

              {[
                {
                  label: inspectSlot.isTwoHourBlock
                    ? t.twoHourYesGroup(inspectSlot.yesPlayers.length)
                    : t.oneHourYesGroup(inspectSlot.yesPlayers.length),
                  players: inspectSlot.yesPlayers,
                  titleClass: 'text-emerald-700',
                  badgeClass: 'bg-emerald-100 text-emerald-900',
                },
                {
                  label: inspectSlot.isTwoHourBlock
                    ? t.twoHourMaybeGroup(inspectSlot.maybePlayers.length)
                    : t.oneHourMaybeGroup(inspectSlot.maybePlayers.length),
                  players: inspectSlot.maybePlayers,
                  titleClass: 'text-amber-700',
                  badgeClass: 'bg-amber-100 text-amber-900',
                },
                {
                  label: t.noGroup(inspectSlot.noPlayers.length),
                  players: inspectSlot.noPlayers,
                  titleClass: 'text-rose-700',
                  badgeClass: 'bg-rose-100 text-rose-900',
                },
              ].map((group) => (
                <div key={group.label}>
                  <div className={`font-extrabold ${group.titleClass} mb-1`}>
                    {group.label}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {group.players.length === 0 ? (
                      <span className="text-slate-400">{t.noneLabel}</span>
                    ) : (
                      group.players.map((p) => (
                        <span
                          key={p.id}
                          translate="no"
                          className={`px-2.5 py-1 rounded-full ${group.badgeClass} font-bold`}
                        >
                          {p.name}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              ))}

              <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-200">
                {!inspectSlot.isTwoHourBlock && !viewingVote ? (
                  <button
                    type="button"
                    onClick={() => {
                      handleCycleSlot(inspectSlot.slotKey);
                      setInspectSlot(null);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-emerald-700 text-white font-extrabold hover:bg-emerald-600 cursor-pointer whitespace-nowrap"
                  >
                    {t.cycleSlotBtn}
                  </button>
                ) : (
                  <span className="text-[11px] text-slate-500">
                    {viewingVote
                      ? t.modalViewingNote(viewingVote.name)
                      : t.modalTwoHourNote}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setInspectSlot(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 cursor-pointer ml-auto whitespace-nowrap"
                >
                  {t.closeBtn}
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
            <div className="px-4 py-3.5 bg-[#1B365D] text-white flex items-center justify-between gap-2">
              <h3 className="font-extrabold text-sm sm:text-base flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-lime-300 shrink-0" />
                <span>{t.pickVoterTitle}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowEditPickerModal(false)}
                className="p-1 rounded-lg hover:bg-white/15 text-slate-200 cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-2.5 text-xs">
              <p className="text-slate-600">{t.pickVoterPrompt}</p>

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
                        <div
                          translate="no"
                          className="font-extrabold text-slate-900 text-sm"
                        >
                          {v.name}
                        </div>
                        {v.note && (
                          <div className="text-[11px] text-slate-500 truncate">
                            {v.note}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-bold text-[11px] whitespace-nowrap">
                          {t.answeredSlotsCount(count)}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#1B365D] text-lime-300 font-extrabold whitespace-nowrap">
                          <Edit3 className="w-3 h-3 shrink-0" />
                          <span>{t.editAction}</span>
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
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 cursor-pointer whitespace-nowrap"
                >
                  {t.closeBtn}
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
            <div className="px-4 py-3.5 bg-[#1B365D] text-white flex items-center justify-between gap-2">
              <h3 className="font-extrabold text-sm sm:text-base flex items-center gap-2">
                <Share2 className="w-4 h-4 text-lime-300 shrink-0" />
                <span>{t.shareModalTitle}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className="p-1 rounded-lg hover:bg-white/15 text-slate-200 cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <p className="text-xs text-slate-600">{t.sharePrompt}</p>

              <textarea
                ref={textareaRef}
                readOnly
                rows={12}
                value={shareSummaryText}
                onFocus={(e) => e.target.select()}
                className="w-full p-3 rounded-xl bg-slate-50 border border-slate-300 text-xs font-mono text-slate-800 focus:outline-none"
              />

              <button
                type="button"
                onClick={handleCopyShareText}
                className="w-full py-3 rounded-xl bg-lime-400 hover:bg-lime-300 text-[#1B365D] font-extrabold text-sm flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
              >
                {copiedShare ? (
                  <>
                    <Check className="w-4 h-4 shrink-0" />
                    <span>{t.copiedBtn}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 shrink-0" />
                    <span>{t.copyBtn}</span>
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
              {t.deleteModalTitle}
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              {t.deleteModalBody(voteToDelete.name)}
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setVoteToDelete(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 cursor-pointer whitespace-nowrap"
              >
                {t.cancelBtn}
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteVote}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer whitespace-nowrap"
              >
                {t.confirmDeleteBtn}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}