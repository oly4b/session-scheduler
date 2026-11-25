import { VENUE_BY_ID } from '../config/venues.js';
import {
  DAY_MS,
  formatHourSlot,
  getTodayJstIsoDate,
  parseHourValue,
} from './jst.js';
import { getJstDayMeta } from './scheduler.js';

export { getTodayJstIsoDate };

export const OTHER_VENUE_OPTION = '__other__';
export const MANUAL_VENUE_ID = 'other';

export function normalizeCourtType(value, fallback = 'indoor') {
  return value === 'outdoor' || value === 'indoor' ? value : fallback;
}

export function buildShortEventUrl({
  origin,
  dateIso,
  startHour,
  endHour,
  venueId = '',
  venueName = '',
  mapUrl = '',
}) {
  const url = new URL('/api/event', origin);
  url.searchParams.set('date', dateIso);
  url.searchParams.set('start', String(startHour));
  url.searchParams.set('end', String(endHour));

  if (venueId && venueId !== MANUAL_VENUE_ID && VENUE_BY_ID.has(venueId)) {
    url.searchParams.set('v', venueId);
    return url.toString();
  }

  if (venueName) url.searchParams.set('venue', venueName);
  if (mapUrl) url.searchParams.set('map', mapUrl);
  return url.toString();
}

export function formatConfirmedSessionInvite({
  origin,
  dateIso,
  timeRangeText,
  venueId,
  customVenueName = '',
  customMapUrl = '',
  courtType = 'indoor',
  format = 'ja',
}) {
  const isOther =
    venueId === OTHER_VENUE_OPTION || venueId === MANUAL_VENUE_ID;
  const matchedVenue = isOther ? null : VENUE_BY_ID.get(venueId) || null;
  const displayVenue = isOther
    ? customVenueName.trim() || '未定'
    : matchedVenue?.fullName || '未定';
  const effectiveCourtType = isOther
    ? normalizeCourtType(courtType, 'indoor')
    : normalizeCourtType(matchedVenue?.courtType, courtType);

  const [rawStart, rawEnd] = String(timeRangeText || '').split('-');
  const startHour = parseHourValue(rawStart || '18:00');
  const endHour = parseHourValue(rawEnd || '20:00');
  const formattedTime =
    `${formatHourSlot(startHour)}–${formatHourSlot(endHour)}`;

  const dayMeta = getJstDayMeta(0);
  const targetOffset = Math.round(
    (new Date(`${dateIso}T00:00:00+09:00`).getTime() -
      new Date(`${dayMeta.dateKey}T00:00:00+09:00`).getTime()) /
      DAY_MS
  );
  const targetDay =
    Number.isFinite(targetOffset) && targetOffset >= 0 && targetOffset < 28
      ? getJstDayMeta(targetOffset)
      : null;

  const jpDateText = targetDay
    ? `${targetDay.jpDate}(${targetDay.dow})`
    : dateIso;
  const enDateText = targetDay
    ? `${targetDay.dow}, ${targetDay.shortDate}`
    : dateIso;

  const eventUrl = buildShortEventUrl({
    origin,
    dateIso,
    startHour,
    endHour,
    venueId: isOther ? '' : matchedVenue?.id || '',
    venueName: isOther ? customVenueName.trim() : '',
    mapUrl: isOther ? customMapUrl.trim() : '',
  });

  const isOutdoor = effectiveCourtType === 'outdoor';
  const shoesJa = isOutdoor
    ? '屋外コートのためテニス・ハードコート用シューズ推奨'
    : '室内専用シューズ必須';
  const shoesEn = isOutdoor
    ? 'Outdoor court — tennis/court shoes recommended'
    : 'Indoor shoes required';

  if (format === 'en') {
    return [
      '桃dinks | Session Confirmed',
      `Date & Time: ${enDateText} · ${formattedTime}`,
      `Venue: ${displayVenue}`,
      `Shoes: ${shoesEn}`,
      'Calendar & Map:',
      eventUrl,
    ].join('\n');
  }

  if (format === 'ja') {
    return [
      '桃dinks | 次回セッション確定案内',
      `日時: ${jpDateText} ${formattedTime}`,
      `会場: ${displayVenue}`,
      `シューズ: ${shoesJa}`,
      'カレンダー・地図:',
      eventUrl,
    ].join('\n');
  }

  return [
    '桃dinks | 次回セッション確定案内 (Session Confirmed)',
    `日時 / Time: ${jpDateText} ${formattedTime}`,
    `会場 / Venue: ${displayVenue}`,
    `シューズ / Shoes: ${shoesJa} (${shoesEn})`,
    'カレンダー・地図 / Calendar & Map:',
    eventUrl,
  ].join('\n');
}
