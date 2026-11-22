import { VENUES } from '../src/config/venues.js';

const DOW_JP = ['日', '月', '火', '水', '木', '金', '土'];

const VENUE_ADDRESSES = {
  mabi: '岡山県倉敷市真備町箭田40-1',
  kurashiki_gym: '岡山県倉敷市四十瀬4',
  kurashiki_wl: '岡山県倉敷市四十瀬4',
  mizushima: '岡山県倉敷市水島青葉町4-1',
  fukuda: '岡山県倉敷市福田町古新田1027',
  nakayama: '岡山県倉敷市児島小川町3681-2',
  seto: '岡山県岡山市東区瀬戸町下450-1',
  okayama_sogo: '岡山県岡山市北区いずみ町2-1-3',
  futsukaichi: '岡山県岡山市北区二日市町56',
  hyakkengawa_a: '岡山県岡山市中区東川原',
  hyakkengawa_c: '岡山県岡山市中区神下',
  nadasaki: '岡山県岡山市南区片岡159-1',
};

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeIcsText(str) {
  return String(str || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function sanitizeSafeUrl(rawUrl) {
  if (!rawUrl) return '';
  try {
    const parsed = new URL(String(rawUrl).trim());
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
  } catch {
    // Invalid URL
  }
  return '';
}

function buildGoogleMapsFallbackUrl(query) {
  if (!query || query === '未定') return '';
  const url = new URL('https://www.google.com/maps/search/');
  url.searchParams.set('api', '1');
  url.searchParams.set('query', query);
  return url.toString();
}

function formatJpDateFromIso(dateStr) {
  const dt = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(dt.getTime())) return dateStr;
  return `${dt.getUTCMonth() + 1}月${dt.getUTCDate()}日(${DOW_JP[dt.getUTCDay()]})`;
}

export default function handler(req, res) {
  const {
    v = '',
    date = '',
    jpDate = '',
    start = '',
    end = '',
    venue: rawVenue = '',
    map: rawMap = '',
    note: rawNote = '',
    ics = '',
  } = req.query;

  const venueId = String(v || '').trim();
  const venueRecord = VENUES.find((item) => item.id === venueId) || null;

  const venueName =
    venueRecord?.fullName ||
    venueRecord?.name ||
    venueRecord?.shortName ||
    String(rawVenue || '').trim() ||
    '未定';

  const address = venueRecord?.address || VENUE_ADDRESSES[venueId] || '';
  const calendarLocation = address ? `${venueName} (${address})` : venueName;

  const mapUrl =
    sanitizeSafeUrl(venueRecord?.mapUrl) ||
    sanitizeSafeUrl(rawMap) ||
    buildGoogleMapsFallbackUrl(address ? `${venueName} ${address}` : venueName);

  const note =
    String(rawNote || '').trim() ||
    (venueRecord
      ? venueRecord.courtType === 'outdoor'
        ? '👟 屋外コートのためテニス・ハードコート用シューズ推奨'
        : '👟 体育館のため室内専用シューズ必須'
      : '');

  const displayDate = String(jpDate || '').trim() || (date ? formatJpDateFromIso(date) : '');

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !start || !end) {
    res.status(400).send('Invalid event parameters');
    return;
  }

  const startHour = Number(start);
  const endHour = Number(end);
  if (
    !Number.isInteger(startHour) ||
    !Number.isInteger(endHour) ||
    startHour < 0 ||
    endHour > 24 ||
    endHour <= startHour
  ) {
    res.status(400).send('Invalid event hours');
    return;
  }

  const compactDate = date.replace(/-/g, '');
  const startStr = `${compactDate}T${String(startHour).padStart(2, '0')}0000`;
  const endStr = `${compactDate}T${String(endHour).padStart(2, '0')}0000`;
  const nowStamp = `${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`;

  const summary = `🏓 岡大dinks ピックルボール (${venueName})`;
  const descriptionLines = [
    '岡大dinks 合同セッション',
    displayDate ? `日時: ${displayDate} ${startHour}:00–${endHour}:00` : '',
    `会場: ${calendarLocation}`,
    note,
    mapUrl ? `Googleマップ: ${mapUrl}` : '',
  ].filter(Boolean);

  if (ics === '1') {
    const hasCoords =
      typeof venueRecord?.lat === 'number' && typeof venueRecord?.lng === 'number';

    const icsLines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//OkadaiDinks//Session Scheduler//JP',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VTIMEZONE',
      'TZID:Asia/Tokyo',
      'BEGIN:STANDARD',
      'TZOFFSETFROM:+0900',
      'TZOFFSETTO:+0900',
      'TZNAME:JST',
      'DTSTART:19700101T000000',
      'END:STANDARD',
      'END:VTIMEZONE',
      'BEGIN:VEVENT',
      `UID:okadaidinks-${compactDate}-${startHour}-${encodeURIComponent(venueId || venueName)}@okayama-pickleball`,
      `DTSTAMP:${nowStamp}`,
      `DTSTART;TZID=Asia/Tokyo:${startStr}`,
      `DTEND;TZID=Asia/Tokyo:${endStr}`,
      `SUMMARY:${escapeIcsText(summary)}`,
      `LOCATION:${escapeIcsText(calendarLocation)}`,
      hasCoords ? `GEO:${venueRecord.lat};${venueRecord.lng}` : '',
      hasCoords
        ? `X-APPLE-STRUCTURED-LOCATION;VALUE=URI;X-ADDRESS="${escapeIcsText(address || venueName)}";X-TITLE="${escapeIcsText(venueName)}":geo:${venueRecord.lat},${venueRecord.lng}`
        : '',
      `DESCRIPTION:${escapeIcsText(descriptionLines.join('\n'))}`,
      mapUrl ? `URL:${mapUrl}` : '',
      'END:VEVENT',
      'END:VCALENDAR',
    ].filter(Boolean);

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="okadaidinks-${compactDate}.ics"`
    );
    res.status(200).send(icsLines.join('\r\n'));
    return;
  }

  const downloadUrl = new URL(req.url, `https://${req.headers.host}`);
  downloadUrl.searchParams.set('ics', '1');

  const googleCalUrl = new URL('https://calendar.google.com/calendar/render');
  googleCalUrl.searchParams.set('action', 'TEMPLATE');
  googleCalUrl.searchParams.set('text', summary);
  googleCalUrl.searchParams.set('dates', `${startStr}/${endStr}`);
  googleCalUrl.searchParams.set('ctz', 'Asia/Tokyo');
  googleCalUrl.searchParams.set('location', calendarLocation);
  googleCalUrl.searchParams.set('details', descriptionLines.join('\n'));

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(summary)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #eef2f6; color: #0f172a; margin: 0; padding: 20px; display: flex; justify-content: center; }
    .card { max-width: 440px; width: 100%; background: #fff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(15,23,42,.12); border: 1px solid #cbd5e1; }
    .hdr { background: #1B365D; color: #fff; padding: 18px 20px; }
    .hdr small { color: #bef264; font-weight: 800; display: block; margin-bottom: 4px; }
    .hdr h1 { font-size: 18px; margin: 0; }
    .body { padding: 18px 20px; font-size: 14px; line-height: 1.6; }
    .row { margin-bottom: 10px; }
    .btn { display: block; text-align: center; text-decoration: none; font-weight: 800; padding: 12px 16px; border-radius: 12px; margin-top: 10px; }
    .btn-primary { background: #a3e635; color: #1B365D; }
    .btn-secondary { background: #1B365D; color: #fff; }
    .btn-outline { background: #f8fafc; color: #1B365D; border: 1px solid #cbd5e1; }
  </style>
</head>
<body>
  <div class="card">
    <div class="hdr">
      <small>🏓 岡大dinks セッション案内</small>
      <h1>${escapeHtml(displayDate)} ${startHour}:00–${endHour}:00</h1>
    </div>
    <div class="body">
      <div class="row"><strong>🏟 会場:</strong> ${escapeHtml(calendarLocation)}</div>
      ${note ? `<div class="row">${escapeHtml(note)}</div>` : ''}
      <a class="btn btn-primary" href="${escapeHtml(downloadUrl.toString())}">📅 Apple / 標準カレンダーに追加 (.ics)</a>
      <a class="btn btn-secondary" href="${escapeHtml(googleCalUrl.toString())}" target="_blank" rel="noopener noreferrer">🗓 Google カレンダーに追加</a>
      ${mapUrl ? `<a class="btn btn-outline" href="${escapeHtml(mapUrl)}" target="_blank" rel="noopener noreferrer">📍 Google マップで場所を開く</a>` : ''}
    </div>
  </div>
</body>
</html>`);
}