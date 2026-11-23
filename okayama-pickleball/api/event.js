import { VENUES } from '../src/config/venues.js';

const DOW_JP = ['日', '月', '火', '水', '木', '金', '土'];
const VENUE_BY_ID = new Map(VENUES.map((venue) => [venue.id, venue]));

// Supplement venues.js entries with street addresses and coordinates for
// calendar LOCATION/GEO fields and map queries when a known venue ID is passed.
const VENUE_META_BY_ID = {
  mabi: {
    address: '岡山県倉敷市真備町箭田2208-1',
    lat: 34.642562,
    lng: 133.685144,
  },
  kurashiki_gym: {
    address: '岡山県倉敷市上富井1-8',
    lat: 34.585989,
    lng: 133.745118,
  },
  kurashiki_weightlifting: {
    address: '岡山県倉敷市四十瀬4',
    lat: 34.589062,
    lng: 133.745787,
  },
  mizushima: {
    address: '岡山県倉敷市水島西千鳥町3-21-303',
    lat: 34.52977,
    lng: 133.739137,
  },
  fukuda: {
    address: '岡山県倉敷市福田町古新田1027',
    lat: 34.53335,
    lng: 133.7681,
  },
  nakayama: {
    address: '岡山県倉敷市児島小川町2831',
    lat: 34.480789,
    lng: 133.810104,
  },
  seto: {
    address: '岡山県岡山市東区瀬戸町南方1311',
    lat: 34.7481279,
    lng: 134.0692336,
  },
  okayama_sogo: {
    address: '岡山県岡山市南区浦安南町493-2',
    lat: 34.600133,
    lng: 133.915802,
  },
  futsukaichi: {
    address: '岡山県岡山市北区二日市町51',
    lat: 34.644472,
    lng: 133.929792,
  },
  hyakkengawa_a: {
    address: '岡山県岡山市中区東川原',
    lat: 34.678536,
    lng: 133.946369,
  },
  hyakkengawa_c: {
    address: '岡山県岡山市中区兼基',
    lat: 34.671356,
    lng: 133.969445,
  },
  nadasaki: {
    address: '岡山県岡山市南区彦崎2686',
    lat: 34.549681,
    lng: 133.83803,
  },
};

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeIcsText(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function sanitizeSafeUrl(rawUrl) {
  if (!rawUrl) return '';
  try {
    const parsed = new URL(String(rawUrl).trim());
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
      ? parsed.toString()
      : '';
  } catch {
    return '';
  }
}

function extractVenueFromMapUrl(rawMapUrl) {
  const safeUrl = sanitizeSafeUrl(rawMapUrl);
  if (!safeUrl) return '';

  try {
    const parsed = new URL(safeUrl);
    const queryParam =
      parsed.searchParams.get('query') || parsed.searchParams.get('q');
    if (queryParam) return queryParam.trim();

    const placeMatch = parsed.pathname.match(/\/maps\/place\/([^/]+)/);
    if (placeMatch?.[1]) {
      return decodeURIComponent(placeMatch[1].replace(/\+/g, ' ')).trim();
    }
  } catch {
    return '';
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
  const dateObj = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(dateObj.getTime())) return dateStr;
  return (
    `${dateObj.getUTCMonth() + 1}月${dateObj.getUTCDate()}日` +
    `(${DOW_JP[dateObj.getUTCDay()]})`
  );
}

function buildIcsCalendar({
  compactDate,
  startStr,
  endStr,
  nowStamp,
  venueId,
  venueName,
  address,
  lat,
  lng,
  hasCoords,
  summary,
  descriptionText,
  mapUrl,
}) {
  const uidVenue = encodeURIComponent(venueId || venueName);
  return [
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
    `UID:okadaidinks-${compactDate}-${uidVenue}@okayama-pickleball`,
    `DTSTAMP:${nowStamp}`,
    `DTSTART;TZID=Asia/Tokyo:${startStr}`,
    `DTEND;TZID=Asia/Tokyo:${endStr}`,
    `SUMMARY:${escapeIcsText(summary)}`,
    `LOCATION:${escapeIcsText(venueName)}`,
    ...(hasCoords
      ? [
          `GEO:${lat};${lng}`,
          'X-APPLE-STRUCTURED-LOCATION;VALUE=URI;' +
            `X-ADDRESS="${escapeIcsText(address || venueName)}";` +
            `X-TITLE="${escapeIcsText(venueName)}":geo:${lat},${lng}`,
        ]
      : []),
    `DESCRIPTION:${escapeIcsText(descriptionText)}`,
    mapUrl ? `URL:${mapUrl}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n');
}

// Attempt Android Chrome handoff via intent:// while showing manual external-
// browser instructions on iOS or webviews that block automatic jumps.
function buildInAppHandoffScript(sharePageUrl) {
  return `<script>
(function() {
  var ua = navigator.userAgent || '';
  var isAndroid = /Android/i.test(ua);
  var isIos = /iPhone|iPad|iPod/i.test(ua);
  var isInApp = /LINE|FBAN|FBAV|Instagram|Twitter|MicroMessenger|KAKAOTALK|GSA|CriOS.*FB|wv/i.test(ua) ||
    (isIos && !/Safari/i.test(ua));

  if (!isInApp) return;

  var banner = document.getElementById('inapp-banner');
  if (banner) banner.style.display = 'block';

  var targetUrl = new URL(window.location.href);
  targetUrl.searchParams.set('ext', '1');
  var finalUrl = targetUrl.toString();

  if (isAndroid && !/[?&]ext=1/.test(window.location.search)) {
    var parsed = new URL(finalUrl);
    var scheme = parsed.protocol.replace(':', '');
    var intentUrl =
      'intent://' +
      parsed.host +
      parsed.pathname +
      parsed.search +
      '#Intent;scheme=' +
      scheme +
      ';package=com.android.chrome;S.browser_fallback_url=' +
      encodeURIComponent(finalUrl) +
      ';end';
    window.location.replace(intentUrl);
  }
})();
</script>`;
}

/**
 * Serves `.ics` calendar invites and HTML event pages from query parameters,
 * resolving `fullName` and `mapUrl` automatically when `v` matches `venues.js`.
 *
 * @param {import('http').IncomingMessage & { query?: Record<string, string> }} req
 * @param {import('http').ServerResponse & { status: (code: number) => any }} res
 */
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
    sport: rawSport = 'pickleball',
    title: rawTitle = '',
    ics = '',
  } = req.query || {};

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

  const venueId = String(v || '').trim();
  const venueRecord = VENUE_BY_ID.get(venueId) || null;
  const fallbackMeta = VENUE_META_BY_ID[venueId] || null;

  const venueName =
    venueRecord?.fullName ||
    venueRecord?.name ||
    venueRecord?.shortName ||
    String(rawVenue || '').trim() ||
    extractVenueFromMapUrl(rawMap) ||
    '未定';

  const address = venueRecord?.address || fallbackMeta?.address || '';
  const lat =
    typeof venueRecord?.lat === 'number' ? venueRecord.lat : fallbackMeta?.lat;
  const lng =
    typeof venueRecord?.lng === 'number' ? venueRecord.lng : fallbackMeta?.lng;
  const hasCoords = typeof lat === 'number' && typeof lng === 'number';

  const mapUrl =
    sanitizeSafeUrl(venueRecord?.mapUrl) ||
    sanitizeSafeUrl(rawMap) ||
    buildGoogleMapsFallbackUrl(address ? `${venueName} ${address}` : venueName);

  const sport = String(rawSport || 'pickleball').trim().toLowerCase();
  const sportLabelMap = { futsal: 'Futsal', football: 'Football' };
  const defaultSportLabel = sportLabelMap[sport] || 'Pickleball';

  const fallbackNote = venueRecord
    ? venueRecord.courtType === 'outdoor'
      ? sport === 'futsal' || sport === 'football'
        ? '屋外コートのため適切なシューズ推奨'
        : '屋外コートのためテニス・ハードコート用シューズ推奨'
      : '体育館のため室内専用シューズ必須'
    : '';

  const note = String(rawNote || '').trim() || fallbackNote;
  const displayDate =
    String(jpDate || '').trim() || formatJpDateFromIso(date);

  const compactDate = date.replace(/-/g, '');
  const startStr = `${compactDate}T${String(startHour).padStart(2, '0')}0000`;
  const endStr = `${compactDate}T${String(endHour).padStart(2, '0')}0000`;
  const nowStamp =
    `${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`;

  const summary =
    String(rawTitle || '').trim() ||
    `岡大dinks ${defaultSportLabel} (${venueName})`;

  const descriptionLines = [
    '岡大dinks セッション',
    displayDate ? `日時: ${displayDate} ${startHour}:00–${endHour}:00` : '',
    `会場: ${venueName}${address ? ` (${address})` : ''}`,
    note,
    mapUrl ? `Googleマップ: ${mapUrl}` : '',
  ].filter(Boolean);
  const descriptionText = descriptionLines.join('\n');

  if (ics === '1') {
    const icsPayload = buildIcsCalendar({
      compactDate,
      startStr,
      endStr,
      nowStamp,
      venueId,
      venueName,
      address,
      lat,
      lng,
      hasCoords,
      summary,
      descriptionText,
      mapUrl,
    });

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="okadaidinks-${compactDate}.ics"`
    );
    res.status(200).send(icsPayload);
    return;
  }

  const originUrl = `https://${req.headers.host}`;
  const ogImageUrl = `${originUrl}/og-image.png`;
  const pageDescription = descriptionLines.join(' · ');

  const downloadUrl = new URL(req.url, originUrl);
  downloadUrl.searchParams.set('ics', '1');

  const googleCalUrl = new URL('https://calendar.google.com/calendar/render');
  googleCalUrl.searchParams.set('action', 'TEMPLATE');
  googleCalUrl.searchParams.set('text', summary);
  googleCalUrl.searchParams.set('dates', `${startStr}/${endStr}`);
  googleCalUrl.searchParams.set('ctz', 'Asia/Tokyo');
  googleCalUrl.searchParams.set(
    'location',
    address ? `${venueName} (${address})` : venueName
  );
  googleCalUrl.searchParams.set('details', descriptionText);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(summary)}</title>
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${escapeHtml(summary)}" />
  <meta property="og:description" content="${escapeHtml(pageDescription)}" />
  <meta property="og:image" content="${escapeHtml(ogImageUrl)}" />
  <meta property="og:url" content="${escapeHtml(`${originUrl}${req.url}`)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:image" content="${escapeHtml(ogImageUrl)}" />
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #eef2f6; color: #0f172a; margin: 0; padding: 20px; display: flex; justify-content: center; }
    .card { max-width: 440px; width: 100%; background: #fff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(15,23,42,.12); border: 1px solid #cbd5e1; }
    .hdr { background: #1B365D; color: #fff; padding: 18px 20px; }
    .hdr small { color: #bef264; font-weight: 800; display: block; margin-bottom: 4px; }
    .hdr h1 { font-size: 18px; margin: 0; }
    .body { padding: 18px 20px; font-size: 14px; line-height: 1.6; }
    .row { margin-bottom: 10px; }
    .notice { display: none; background: #fef3c7; color: #78350f; border: 1px solid #f59e0b; border-radius: 12px; padding: 10px 12px; font-size: 12px; font-weight: 700; margin-bottom: 12px; }
    .btn { display: block; text-align: center; text-decoration: none; font-weight: 800; padding: 12px 16px; border-radius: 12px; margin-top: 10px; }
    .btn-primary { background: #a3e635; color: #1B365D; }
    .btn-secondary { background: #1B365D; color: #fff; }
    .btn-outline { background: #f8fafc; color: #1B365D; border: 1px solid #cbd5e1; }
  </style>
</head>
<body>
  <div class="card">
    <div class="hdr">
      <small>岡大dinks セッション案内</small>
      <h1>${escapeHtml(displayDate)} ${startHour}:00–${endHour}:00</h1>
    </div>
    <div class="body">
      <div id="inapp-banner" class="notice">
        アプリ内ブラウザではカレンダー追加が制限される場合があります。右上の「…」や共有メニューから Safari / 外部ブラウザで開いてください。
      </div>
      <div class="row"><strong>会場:</strong> ${escapeHtml(venueName)}</div>
      ${address ? `<div class="row"><strong>住所:</strong> ${escapeHtml(address)}</div>` : ''}
      ${note ? `<div class="row">${escapeHtml(note)}</div>` : ''}
      <a class="btn btn-primary" href="${escapeHtml(downloadUrl.toString())}">Apple カレンダーに追加</a>
      <a class="btn btn-secondary" href="${escapeHtml(googleCalUrl.toString())}" target="_blank" rel="noopener noreferrer">Google カレンダーに追加</a>
      ${mapUrl ? `<a class="btn btn-outline" href="${escapeHtml(mapUrl)}" target="_blank" rel="noopener noreferrer">Google マップで場所を開く</a>` : ''}
    </div>
  </div>
  ${buildInAppHandoffScript(`${originUrl}${req.url}`)}
</body>
</html>`);
}