const DOW_JP = ['日', '月', '火', '水', '木', '金', '土'];
const DOW_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function getTodayJstIsoDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

export function parseTimeRangeInput(rawTime) {
  const match = String(rawTime || '')
    .trim()
    .match(/(\d{1,2})(?::(\d{2}))?\s*(?:[-~〜–—]|to)\s*(\d{1,2})(?::(\d{2}))?/i);

  if (!match) return null;

  const startHour = Number(match[1]);
  const startMin = Number(match[2] || '0');
  const endHour = Number(match[3]);
  const endMin = Number(match[4] || '0');

  if (
    startHour < 0 ||
    startHour > 23 ||
    endHour < 1 ||
    endHour > 24 ||
    startMin > 59 ||
    endMin > 59
  ) {
    return null;
  }

  const startStr = `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`;
  const endStr = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;

  return {
    startHour,
    endHour,
    formattedRange: `${startStr}–${endStr}`,
  };
}

export function buildConfirmedBookingInvite({
  origin = window.location.origin,
  dateIso = getTodayJstIsoDate(),
  timeRangeText = '18:00-20:00',
  venueName = '',
  mapUrl = '',
  courtType = 'indoor',
  format = 'ja', // 'ja' | 'en' | 'bilingual'
}) {
  const cleanDate = /^\d{4}-\d{2}-\d{2}$/.test(dateIso)
    ? dateIso
    : getTodayJstIsoDate();
  const parsedTime = parseTimeRangeInput(timeRangeText) || {
    startHour: 18,
    endHour: 20,
    formattedRange: String(timeRangeText || '18:00–20:00').trim(),
  };

  const dt = new Date(`${cleanDate}T00:00:00Z`);
  const month = Number.isNaN(dt.getTime()) ? '' : dt.getUTCMonth() + 1;
  const day = Number.isNaN(dt.getTime()) ? '' : dt.getUTCDate();
  const dowIdx = Number.isNaN(dt.getTime()) ? 0 : dt.getUTCDay();

  const jpDateLabel =
    month && day ? `${month}月${day}日(${DOW_JP[dowIdx]})` : cleanDate;
  const enDateLabel =
    month && day ? `${DOW_EN[dowIdx]}, ${month}/${day}` : cleanDate;

  const trimmedVenue = String(venueName || '').trim() || '未定';
  const trimmedMap = String(mapUrl || '').trim();

  const eventUrl = new URL('/api/event', origin);
  eventUrl.searchParams.set('date', cleanDate);
  eventUrl.searchParams.set('jpDate', jpDateLabel);
  eventUrl.searchParams.set('start', String(parsedTime.startHour));
  eventUrl.searchParams.set('end', String(parsedTime.endHour));
  eventUrl.searchParams.set('venue', trimmedVenue);
  if (trimmedMap) {
    eventUrl.searchParams.set('map', trimmedMap);
  }

  const calendarLink = eventUrl.toString();

  if (format === 'en') {
    const shoesEn =
      courtType === 'outdoor'
        ? 'Outdoor hard court — tennis/court shoes recommended'
        : 'Indoor gym — indoor-only court shoes required';

    return [
      '🏓 Okadai dinks | Confirmed Session',
      `📅 Date & Time: ${enDateLabel} · ${parsedTime.formattedRange}`,
      `🏟 Venue: ${trimmedVenue}`,
      `👟 Footwear: ${shoesEn}`,
      '🗓 Calendar & Map 👇',
      calendarLink,
    ].join('\n');
  }

  if (format === 'bilingual') {
    const shoesBi =
      courtType === 'outdoor'
        ? '屋外コート用シューズ推奨 (Outdoor court shoes)'
        : '室内専用シューズ必須 (Indoor shoes required)';

    return [
      '🏓 岡大dinks | 次回セッション確定案内 (Session Confirmed)',
      `📅 日時 / Time: ${jpDateLabel} ${parsedTime.formattedRange}`,
      `🏟 会場 / Venue: ${trimmedVenue}`,
      `👟 シューズ / Shoes: ${shoesBi}`,
      '🗓 カレンダー・地図 / Calendar & Map 👇',
      calendarLink,
    ].join('\n');
  }

  const shoesJa =
    courtType === 'outdoor'
      ? '屋外コート用シューズ推奨'
      : '室内専用シューズ必須';

  return [
    '🏓 岡大dinks | 次回セッション確定案内',
    `📅 日時: ${jpDateLabel} ${parsedTime.formattedRange}`,
    `🏟 会場: ${trimmedVenue}`,
    `👟 シューズ: ${shoesJa}`,
    '🗓 カレンダー・地図はこちら 👇',
    calendarLink,
  ].join('\n');
}