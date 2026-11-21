import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { VENUES } from '../src/config/venues.js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const YOYACOOL_VENUES = VENUES.filter((v) => v.source === 'yoyacool');
const ALLOWED_START_HOURS = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
const ALLOWED_HOURS_SET = new Set(ALLOWED_START_HOURS);
const UNLIT_OUTDOOR_IDS = new Set(['yoshiigawa_1', 'hyakkengawa_a', 'hyakkengawa_c']);
const CONCURRENCY = 3;

function getJstDateString(offsetDays = 0) {
  const jstTime = new Date(Date.now() + 9 * 60 * 60 * 1000 + offsetDays * 86400000);
  return jstTime.toISOString().slice(0, 10);
}

function getEffectiveMaxStartHour(venue) {
  if (typeof venue.maxStartHour === 'number') {
    return venue.maxStartHour;
  }
  if (UNLIT_OUTDOOR_IDS.has(venue.id) || (venue.courtType === 'outdoor' && venue.hasLights === false)) {
    return 16; // Last 1-hour block starting at 16:00 (16:00–17:00); closed from 17:00 onward
  }
  return 21;
}

function buildWindowUrl(baseUrl, startDate, endDate) {
  const url = new URL(baseUrl);
  url.searchParams.set('d', startDate);
  url.searchParams.set('sd', startDate);
  url.searchParams.set('ed', endDate);
  return url.toString();
}

function resolveDateKey(text) {
  const match = text.match(/(\d{1,2})月(\d{1,2})日/);
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);

  const nowJst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const currentYear = nowJst.getUTCFullYear();
  const currentMonth = nowJst.getUTCMonth() + 1;
  const year = currentMonth === 12 && month === 1 ? currentYear + 1 : currentYear;

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

async function dismissDialogs(page) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const dialogBtn = page.locator('.v-dialog--active button').first();
    if (!(await dialogBtn.count())) break;
    await dialogBtn.click({ force: true }).catch(() => null);
    await page.waitForTimeout(200);
  }
}

async function parseVisibleTables(page, openHoursByDate, capturedDates) {
  // Scroll internal Vuetify containers so all court tables mount
  await page.evaluate(async () => {
    const scrollables = Array.from(document.querySelectorAll('*')).filter(
      (el) => el.scrollHeight > el.clientHeight + 100
    );
    for (const el of scrollables) {
      for (let y = 0; y <= el.scrollHeight; y += 900) {
        el.scrollTop = y;
        await new Promise((r) => setTimeout(r, 40));
      }
      el.scrollTop = 0;
    }
  });
  await page.waitForTimeout(300);

  const allTablesRows = await page.evaluate(() => {
    const normalize = (s) =>
      (s || '')
        .replace(/[！-～]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
        .replace(/\u3000/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const visibleTables = Array.from(document.querySelectorAll('table')).filter(
      (t) => t.offsetParent !== null && t.querySelector('.AvailabilityFrameSet_frame')
    );

    return visibleTables.map((table) =>
      Array.from(table.querySelectorAll('tr')).map((tr) => {
        const cells = Array.from(tr.querySelectorAll('th, td'));
        const frames = Array.from(tr.querySelectorAll('.AvailabilityFrameSet_frame')).map((el) => ({
          text: normalize(el.innerText),
          title: normalize(
            el.querySelector('.AvailabilityFrameSet_frame_content')?.getAttribute('title') || ''
          ),
          startTime: el.querySelector('time')?.getAttribute('datetime') || '',
        }));

        return {
          firstCellText: cells[0] ? normalize(cells[0].innerText) : '',
          frames,
        };
      })
    );
  });

  for (const tableRows of allTablesRows) {
    for (const row of tableRows) {
      if (!/\d{1,2}月\d{1,2}日/.test(row.firstCellText)) continue;

      const slotDate = resolveDateKey(row.firstCellText);
      if (!slotDate || row.frames.length === 0) continue;

      capturedDates.add(slotDate);
      if (!openHoursByDate.has(slotDate)) {
        openHoursByDate.set(slotDate, new Set());
      }

      for (const frame of row.frames) {
        let startHour = null;
        let endHour = null;

        const hourMatch = frame.text.match(/(\d{1,2})時から(\d{1,2})時/);
        if (hourMatch) {
          startHour = Number(hourMatch[1]);
          endHour = Number(hourMatch[2]);
        } else if (frame.startTime && frame.startTime.length >= 13) {
          startHour = Number(frame.startTime.slice(11, 13));
          endHour = startHour + 1;
        } else {
          continue;
        }

        const combined = `${frame.text} ${frame.title}`;
        const isOpen =
          combined.includes('trip_origin') ||
          combined.includes('空き状況のみ') ||
          combined.includes('空きあり') ||
          combined.includes('○');

        if (isOpen) {
          for (let h = startHour; h < endHour; h += 1) {
            if (ALLOWED_HOURS_SET.has(h)) {
              openHoursByDate.get(slotDate).add(h);
            }
          }
        }
      }
    }
  }
}

async function scrapeYoyacoolVenue(browser, venue) {
  const page = await browser.newPage({
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
    viewport: { width: 1440, height: 12000 },
  });

  await page.route('**/*', (route) => {
    const type = route.request().resourceType();
    if (type === 'image' || type === 'font' || type === 'media') {
      return route.abort();
    }
    return route.continue();
  });

  const openHoursByDate = new Map();
  const capturedDates = new Set();

  const windows = [
    { label: 'Weeks 1–2', start: getJstDateString(0), end: getJstDateString(13) },
    { label: 'Weeks 3–4', start: getJstDateString(14), end: getJstDateString(27) },
  ];

  try {
    console.log(`[${venue.id}] Opening ${venue.fullName}...`);

    for (const win of windows) {
      const targetUrl = buildWindowUrl(venue.scraperUrl, win.start, win.end);
      await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 45000 });
      await page.waitForSelector('.AvailabilityFrameSet_frame', { timeout: 20000 });
      await dismissDialogs(page);
      await parseVisibleTables(page, openHoursByDate, capturedDates);
    }

    console.log(`[${venue.id}] Captured ${capturedDates.size} dates for ${venue.shortName}.`);
  } finally {
    await page.close();
  }

  const maxHour = getEffectiveMaxStartHour(venue);
  const venueRecords = [];

  for (let offset = 0; offset < 28; offset += 1) {
    const dateKey = getJstDateString(offset);
    const openSet = openHoursByDate.get(dateKey) || new Set();

    for (const startHour of ALLOWED_START_HOURS) {
      const timeRange = `${String(startHour).padStart(2, '0')}:00-${String(startHour + 1).padStart(2, '0')}:00`;
      const isWithinOperatingHours = startHour <= maxHour;

      let status = 'closed';
      if (isWithinOperatingHours) {
        status = openSet.has(startHour) ? 'open' : 'booked';
      }

      venueRecords.push({
        slot_key: `${dateKey}_${venue.id}_${timeRange}`,
        slot_date: dateKey,
        time_range: timeRange,
        court_detail: venue.id,
        status,
        updated_at: new Date().toISOString(),
      });
    }
  }

  const openCount = venueRecords.filter((r) => r.status === 'open').length;
  const bookedCount = venueRecords.filter((r) => r.status === 'booked').length;
  const closedCount = venueRecords.filter((r) => r.status === 'closed').length;
  console.log(
    `[${venue.id}] Prepared ${venueRecords.length} venue slots (${openCount} open, ${bookedCount} booked, ${closedCount} closed).`
  );

  return venueRecords;
}

async function runWithConcurrency(items, limit, worker) {
  const results = [];
  const executing = new Set();
  for (const item of items) {
    const p = Promise.resolve().then(() => worker(item));
    results.push(p);
    executing.add(p);
    p.finally(() => executing.delete(p));
    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }
  return Promise.all(results);
}

async function run() {
  const minDate = getJstDateString(0);
  const browser = await chromium.launch({ headless: true });
  let allRecords = [];

  try {
    const nested = await runWithConcurrency(YOYACOOL_VENUES, CONCURRENCY, (venue) =>
      scrapeYoyacoolVenue(browser, venue)
    );
    allRecords = nested.flat();
  } finally {
    await browser.close();
  }

  if (process.argv.includes('--dry-run')) {
    console.log(`\nDry run complete (${allRecords.length} total records) — skipped Supabase writes.`);
    process.exit(0);
  }

  const venueIds = YOYACOOL_VENUES.map((v) => v.id);

  await supabase
    .from('court_availability')
    .delete()
    .in('court_detail', venueIds)
    .lt('slot_date', minDate);

  for (let i = 0; i < allRecords.length; i += 600) {
    const chunk = allRecords.slice(i, i + 600);
    const { error } = await supabase
      .from('court_availability')
      .upsert(chunk, { onConflict: 'slot_key' });

    if (error) {
      console.error('Supabase upsert error:', error);
      process.exit(1);
    }
  }

  console.log(
    `\nSuccessfully synced ${allRecords.length} venue-level slots across ${YOYACOOL_VENUES.length} yoyacool venues.`
  );
}

run();