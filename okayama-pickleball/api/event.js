const HTML_ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const HOUR_RE = /^\d{1,2}$/;

/**
 * Escapes special HTML characters to prevent XSS in server-rendered markup.
 *
 * @param {string} [value='']
 * @returns {string}
 */
function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (ch) => HTML_ESCAPE_MAP[ch]);
}

/**
 * Escapes RFC 5545 text delimiters (`\`, newlines, commas, semicolons) for `.ics` fields.
 *
 * @param {string} [value='']
 * @returns {string}
 */
function escapeIcs(value = '') {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

/**
 * Sanitizes an external URL to allow only `http:` and `https:` schemes.
 *
 * @param {string} rawUrl
 * @returns {string}
 */
function sanitizeHttpUrl(rawUrl) {
  if (!rawUrl) return '';
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
      ? parsed.toString()
      : '';
  } catch {
    return '';
  }
}

/**
 * Builds an RFC 5545 iCalendar payload for an `Asia/Tokyo` session event.
 *
 * @param {{
 *   uid: string,
 *   dtStart: string,
 *   dtEnd: string,
 *   title: string,
 *   venue: string,
 *   description: string,
 * }} event
 * @returns {string}
 */
function buildIcsPayload({ uid, dtStart, dtEnd, title, venue, description }) {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Okadai Dinks//Session//JA',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${escapeIcs(uid)}`,
    `DTSTAMP:${dtStart}`,
    `DTSTART;TZID=Asia/Tokyo:${dtStart}`,
    `DTEND;TZID=Asia/Tokyo:${dtEnd}`,
    `SUMMARY:${escapeIcs(title)}`,
    `LOCATION:${escapeIcs(venue)}`,
    `DESCRIPTION:${escapeIcs(description)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

/**
 * Builds a Google Calendar template URL prefilled with session metadata.
 *
 * @param {{
 *   title: string,
 *   dtStart: string,
 *   dtEnd: string,
 *   venue: string,
 *   description: string,
 * }} event
 * @returns {string}
 */
function buildGoogleCalendarUrl({ title, dtStart, dtEnd, venue, description }) {
  const url = new URL('https://calendar.google.com/calendar/render');
  url.searchParams.set('action', 'TEMPLATE');
  url.searchParams.set('text', title);
  url.searchParams.set('dates', `${dtStart}/${dtEnd}`);
  url.searchParams.set('ctz', 'Asia/Tokyo');
  url.searchParams.set('location', venue);
  url.searchParams.set('details', description);
  return url.toString();
}

/**
 * Renders the Open Graph preview page with immediate Apple/Google Calendar handoff.
 *
 * @param {{
 *   ogTitle: string,
 *   ogDesc: string,
 *   note: string,
 *   icsUrl: string,
 *   googleCalUrl: string,
 *   safeMapUrl: string,
 * }} pageData
 * @returns {string}
 */
function renderEventHtml({ ogTitle, ogDesc, note, icsUrl, googleCalUrl, safeMapUrl }) {
  const mapButton = safeMapUrl
    ? `<a class="btn btn-secondary" href="${escapeHtml(safeMapUrl)}" ` +
      'target="_blank" rel="noopener noreferrer">📍 Google Maps で場所を見る</a>'
    : '';

  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(ogTitle)}</title>
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="岡大dinks ピックルボール" />
  <meta property="og:title" content="${escapeHtml(ogTitle)}" />
  <meta property="og:description" content="${escapeHtml(ogDesc)}" />
  <meta name="twitter:card" content="summary" />
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      background: #eef2f6;
      color: #0f172a;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 16px;
    }
    .card {
      background: #fff;
      border-radius: 20px;
      max-width: 400px;
      width: 100%;
      padding: 24px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.08);
      text-align: center;
    }
    h1 { font-size: 18px; color: #1B365D; margin: 0 0 8px; }
    p { font-size: 13px; color: #475569; margin: 6px 0; line-height: 1.5; }
    .btn {
      display: block;
      width: 100%;
      box-sizing: border-box;
      padding: 12px;
      border-radius: 12px;
      font-weight: 800;
      font-size: 14px;
      text-decoration: none;
      margin-top: 10px;
    }
    .btn-primary { background: #1B365D; color: #bef264; }
    .btn-secondary { background: #f1f5f9; color: #1B365D; border: 1px solid #cbd5e1; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${escapeHtml(ogTitle)}</h1>
    <p>${escapeHtml(note)}</p>
    <a class="btn btn-primary" href="${escapeHtml(icsUrl)}">🍎 Apple / 標準カレンダーに追加</a>
    <a class="btn btn-secondary" href="${escapeHtml(googleCalUrl)}">📅 Google カレンダーに追加</a>
    ${mapButton}
  </div>
  <script>
    (function () {
      var isApple = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent || '');
      window.location.replace(isApple ? ${JSON.stringify(icsUrl)} : ${JSON.stringify(googleCalUrl)});
    })();
  </script>
</body>
</html>`;
}

/**
 * Serverless endpoint that generates Open Graph SNS previews and routes users to
 * Apple Calendar (`.ics`) or Google Calendar based on device User-Agent.
 *
 * @param {import('http').IncomingMessage & { query?: Record<string, string> }} req
 * @param {import('http').ServerResponse & {
 *   status: (code: number) => any,
 *   send: (body: string) => any,
 * }} res
 */
export default function handler(req, res) {
  const query = req.query ?? {};
  const date = DATE_RE.test(query.date || '') ? query.date : '2026-11-29';
  const startHour = HOUR_RE.test(query.start || '') ? query.start.padStart(2, '0') : '18';
  const endHour = HOUR_RE.test(query.end || '') ? query.end.padStart(2, '0') : '20';

  const jpDate = String(query.jpDate || '11月29日(日)');
  const venue = String(query.venue || '岡大dinks');
  const note = String(query.note || '');
  const safeMapUrl = sanitizeHttpUrl(String(query.map || ''));

  const compactDate = date.replace(/-/g, '');
  const dtStart = `${compactDate}T${startHour}0000`;
  const dtEnd = `${compactDate}T${endHour}0000`;
  const timeSpan = `${startHour}:00–${endHour}:00`;

  const title = `🏓 岡大dinks (${venue})`;
  const ogTitle = `🏓 岡大dinks | ${jpDate} ${timeSpan} @ ${venue}`;
  const ogDesc = [note, safeMapUrl ? `📍 Google Maps: ${safeMapUrl}` : '']
    .filter(Boolean)
    .join(' / ');
  const description = [
    `会場: ${venue}`,
    safeMapUrl ? `Map: ${safeMapUrl}` : '',
    note,
  ]
    .filter(Boolean)
    .join('\n');

  if (query.format === 'ics') {
    const ics = buildIcsPayload({
      uid: `${date}-${startHour}-${venue}@okadai-dinks`,
      dtStart,
      dtEnd,
      title,
      venue,
      description,
    });

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename="okadai-dinks-${date}.ics"`);
    return res.status(200).send(ics);
  }

  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
  const selfUrl = new URL(req.url || '/api/event', `${proto}://${host}`);
  selfUrl.searchParams.set('format', 'ics');

  const html = renderEventHtml({
    ogTitle,
    ogDesc,
    note,
    icsUrl: selfUrl.toString(),
    googleCalUrl: buildGoogleCalendarUrl({ title, dtStart, dtEnd, venue, description }),
    safeMapUrl,
  });

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(html);
}