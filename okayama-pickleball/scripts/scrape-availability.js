import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const ALLOWED_COURTS = new Set(['1/2面A', '1/2面B']);

function getJstDateString(offsetDays = 0) {
  const now = new Date();
  const jstTime = new Date(now.getTime() + 9 * 60 * 60 * 1000 + offsetDays * 86400000);
  return jstTime.toISOString().slice(0, 10);
}

function buildTargetUrl() {
  const startDate = getJstDateString(0);
  const endDate = getJstDateString(13);
  const params = new URLSearchParams({
    ptn: '3',
    d: startDate,
    rc: '141',
    sd: startDate,
    ed: endDate,
    rc2w: '141',
  });
  return `https://yoyacool.e-harp.jp/okayamacity/FacilityAvailability/Index/331007/0031?${params.toString()}`;
}

// Convert full-width ASCII (e.g., １／２面Ａ) to half-width (1/2面A)
function normalizeText(str) {
  return str
    .replace(/[！-～]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTargetCourt(label) {
  const normalized = normalizeText(label);
  const match = normalized.match(/1\/2\s*面?\s*([AB])/i);
  if (!match) return null;
  const courtName = `1/2面${match[1].toUpperCase()}`;
  return ALLOWED_COURTS.has(courtName) ? courtName : null;
}

function mapSymbolToStatus(text) {
  const cleaned = text.replace(/\s+/g, '');
  if (cleaned.includes('○') || cleaned.includes('〇') || cleaned.includes('空き')) return 'open';
  if (cleaned.includes('△')) return 'partial';
  if (cleaned.includes('休館') || cleaned.includes('保守')) return 'closed';
  return 'booked';
}
// Split any multi-hour range (e.g. "09:00-11:00") into 1-hour blocks ("09:00-10:00", "10:00-11:00")
function expandToHourlyRanges(startStr, endStr) {
  const startHour = parseInt(startStr.split(':')[0], 10);
  const endHour = parseInt(endStr.split(':')[0], 10);
  const ranges = [];
  for (let h = startHour; h < endHour; h++) {
    const from = `${String(h).padStart(2, '0')}:00`;
    const to = `${String(h + 1).padStart(2, '0')}:00`;
    ranges.push(`${from}-${to}`);
  }
  return ranges.length > 0 ? ranges : [`${startStr}-${endStr}`];
}

async function run() {
  const url = buildTargetUrl();
  console.log(`Fetching: ${url}`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
  });

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForSelector('table', { timeout: 20000 });
    await page.waitForTimeout(1500);

    const rawGrid = await page.evaluate(() => {
      const tables = Array.from(document.querySelectorAll('table'));
      return tables.map((table) =>
        Array.from(table.querySelectorAll('tr')).map((tr) =>
          Array.from(tr.querySelectorAll('th, td')).map((cell) => ({
            text: cell.innerText.trim(),
            aria: cell.getAttribute('aria-label') || cell.getAttribute('title') || '',
          }))
        )
      );
    });

    const records = [];

    for (const rows of rawGrid) {
      if (rows.length < 2) continue;

      // Detect date columns from header rows
      const dateHeaders = [];
      for (const row of rows.slice(0, 3)) {
        const matches = row.filter((c) => /\d{1,2}\/\d{1,2}|\d{1,2}日/.test(c.text));
        if (matches.length >= 7) {
          let dayOffset = 0;
          for (const cell of row) {
            if (/\d{1,2}\/\d{1,2}|\d{1,2}日/.test(cell.text)) {
              dateHeaders.push({
                slotDate: getJstDateString(dayOffset),
              });
              dayOffset += 1;
            }
          }
          break;
        }
      }

      if (dateHeaders.length === 0) continue;

      let currentCourt = null;

      for (const row of rows) {
        if (row.length <= dateHeaders.length) continue;

        const labelCells = row.slice(0, row.length - dateHeaders.length);
        const statusCells = row.slice(row.length - dateHeaders.length);

        const rawRowLabel = labelCells.map((c) => c.text).filter(Boolean).join(' ');
        const normalizedLabel = normalizeText(rawRowLabel);

        // Update active court whenever a court section header appears (handles rowspan groups)
        if (/全面|1\/2/.test(normalizedLabel)) {
          currentCourt = extractTargetCourt(normalizedLabel); // null if 全面 or other section
        }

        // Skip rows outside 1/2面A and 1/2面B
        if (!currentCourt) continue;

        const timeMatch = normalizedLabel.match(/(\d{1,2}:\d{2})\s*[〜~\-－]\s*(\d{1,2}:\d{2})/);
        if (!timeMatch) continue;
        const timeRange = `${timeMatch[1]}-${timeMatch[2]}`;

        statusCells.forEach((cell, idx) => {
          const dateInfo = dateHeaders[idx];
          if (!dateInfo) return;

          const status = mapSymbolToStatus(`${cell.text} ${cell.aria}`);
          const hourlyRanges = expandToHourlyRanges(timeMatch[1], timeMatch[2]);

            for (const hourRange of hourlyRanges) {
                const slotKey = `${dateInfo.slotDate}_${currentCourt}_${hourRange}`;
                records.push({
                slot_key: slotKey,
                slot_date: dateInfo.slotDate,
                time_range: hourRange,
                court_detail: currentCourt,
                status,
                updated_at: new Date().toISOString(),
                });
            }
        });
      }
    }

    console.log(`Parsed ${records.length} slots for 1/2面A and 1/2面B`);

    if (records.length === 0) {
      console.warn('No 1/2面A or 1/2面B rows matched. First table snapshot:');
      console.log(JSON.stringify(rawGrid[0]?.slice(0, 8), null, 2));
      process.exit(0);
    }

    const { error } = await supabase
      .from('court_availability')
      .upsert(records, { onConflict: 'slot_key' });

    if (error) {
      console.error('Supabase upsert error:', error);
      process.exit(1);
    }

    console.log('Successfully synced 1/2面A and 1/2面B availability to Supabase.');
  } finally {
    await browser.close();
  }
}

run();