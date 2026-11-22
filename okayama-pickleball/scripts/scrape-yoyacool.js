import { chromium } from 'playwright';
import { VENUES } from '../src/config/venues.js';
import {
  ALLOWED_HOURS_SET,
  ALLOWED_START_HOURS,
  CONCURRENCY,
  JST_OFFSET_MS,
  SCRAPE_DAYS,
  blockNonEssentialAssets,
  createSupabaseServiceClient,
  formatTimeRange,
  getJstDateString,
  runWithConcurrency,
  syncCourtAvailability,
} from './lib/scraper-utils.js';

const OPEN_MARKERS = ['trip_origin', '空き状況のみ', '空きあり', '○'];

const DATE_LABEL_RE = /(\d{1,2})月(\d{1,2})日/;
const HOUR_RANGE_RE = /(\d{1,2})時から(\d{1,2})時/;

/**
 * @typedef {import('playwright').Browser} Browser
 * @typedef {import('playwright').Page} Page
 * @typedef {import('./lib/scraper-utils.js').CourtSlotRecord} CourtSlotRecord
 * @typedef {{
 *   id: string,
 *   source: string,
 *   shortName: string,
 *   fullName: string,
 *   scraperUrl: string,
 *   courtType?: string,
 *   hasLights?: boolean,
 *   maxStartHour?: number,
 * }} VenueConfig
 */

/**
 * Returns the latest valid 1-hour slot start hour for a venue.
 *
 * @param {VenueConfig} venue
 * @returns {number}
 */
function getEffectiveMaxStartHour(venue) {
  if (typeof venue.maxStartHour === 'number') return venue.maxStartHour;

  // Unlit outdoor courts close at 17:00; final playable block is 16:00-17:00.
  const isUnlitOutdoor = venue.courtType === 'outdoor' && venue.hasLights === false;
  return isUnlitOutdoor ? 16 : 21;
}

/**
 * Appends Yoyacool date window query parameters to a venue's base URL.
 *
 * @param {string} baseUrl
 * @param {string} startDate
 * @param {string} endDate
 * @returns {string}
 */
function buildWindowUrl(baseUrl, startDate, endDate) {
  const url = new URL(baseUrl);
  url.searchParams.set('d', startDate);
  url.searchParams.set('sd', startDate);
  url.searchParams.set('ed', endDate);
  return url.toString();
}

/**
 * Converts a Japanese month/day label (e.g., `12月5日`) into an ISO date string,
 * rolling the year forward when December queries wrap into January.
 *
 * @param {string} label
 * @returns {string | null}
 */
function resolveDateKey(label) {
  const match = label.match(DATE_LABEL_RE);
  if (!match) return null;

  const month = Number(match[1]);
  const day = Number(match[2]);
  const nowJst = new Date(Date.now() + JST_OFFSET_MS);
  const currentYear = nowJst.getUTCFullYear();
  const currentMonth = nowJst.getUTCMonth() + 1;
  const year = currentMonth === 12 && month === 1 ? currentYear + 1 : currentYear;

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Dismisses up to three blocking Vuetify modal dialogs on the current page.
 *
 * @param {Page} page
 * @returns {Promise<void>}
 */
async function dismissDialogs(page) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const closeBtn = page.locator('.v-dialog--active button').first();
    if (!(await closeBtn.count())) break;

    await closeBtn.click({ force: true }).catch(() => null);
    await page.waitForTimeout(200);
  }
}

/**
 * Scrolls virtualized Vuetify containers so lazy-mounted availability tables render,
 * then extracts all open start hours grouped by ISO date.
 *
 * @param {Page} page
 * @param {Map<string, Set<number>>} openHoursByDate
 * @param {Set<string>} capturedDates
 * @returns {Promise<void>}
 */
async function parseVisibleTables(page, openHoursByDate, capturedDates) {
  await page.evaluate(async () => {
    const scrollables = Array.from(document.querySelectorAll('*')).filter(
      (el) => el.scrollHeight > el.clientHeight + 100
    );

    for (const el of scrollables) {
      for (let y = 0; y <= el.scrollHeight; y += 900) {
        el.scrollTop = y;
        await new Promise((resolve) => setTimeout(resolve, 40));
      }
      el.scrollTop = 0;
    }
  });
  await page.waitForTimeout(300);

  const tables = await page.evaluate(() => {
    const normalize = (text) =>
      (text || '')
        .replace(/[！-～]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
        .replace(/\u3000/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    return Array.from(document.querySelectorAll('table'))
      .filter((t) => t.offsetParent !== null && t.querySelector('.AvailabilityFrameSet_frame'))
      .map((table) =>
        Array.from(table.querySelectorAll('tr')).map((tr) => {
          const firstCell = tr.querySelector('th, td');
          const frames = Array.from(
            tr.querySelectorAll('.AvailabilityFrameSet_frame')
          ).map((el) => ({
            text: normalize(el.innerText),
            title: normalize(
              el.querySelector('.AvailabilityFrameSet_frame_content')?.getAttribute('title')
            ),
            startTime: el.querySelector('time')?.getAttribute('datetime') || '',
          }));

          return {
            firstCellText: firstCell ? normalize(firstCell.innerText) : '',
            frames,
          };
        })
      );
  });

  for (const rows of tables) {
    for (const row of rows) {
      const slotDate = resolveDateKey(row.firstCellText);
      if (!slotDate || row.frames.length === 0) continue;

      capturedDates.add(slotDate);
      let openHours = openHoursByDate.get(slotDate);
      if (!openHours) {
        openHours = new Set();
        openHoursByDate.set(slotDate, openHours);
      }

      for (const frame of row.frames) {
        const hourMatch = frame.text.match(HOUR_RANGE_RE);
        let startHour;
        let endHour;

        if (hourMatch) {
          startHour = Number(hourMatch[1]);
          endHour = Number(hourMatch[2]);
        } else if (frame.startTime.length >= 13) {
          startHour = Number(frame.startTime.slice(11, 13));
          endHour = startHour + 1;
        } else {
          continue;
        }

        const labelText = `${frame.text} ${frame.title}`;
        if (!OPEN_MARKERS.some((marker) => labelText.includes(marker))) continue;

        for (let hour = startHour; hour < endHour; hour += 1) {
          if (ALLOWED_HOURS_SET.has(hour)) openHours.add(hour);
        }
      }
    }
  }
}

/**
 * Scrapes a 28-day availability window for a single Yoyacool venue and normalizes
 * every hourly slot into `open`, `booked`, or `closed` database records.
 *
 * @param {Browser} browser
 * @param {VenueConfig} venue
 * @returns {Promise<CourtSlotRecord[]>}
 */
async function scrapeYoyacoolVenue(browser, venue) {
  const page = await browser.newPage({
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
    viewport: { width: 1440, height: 12000 },
  });

  await blockNonEssentialAssets(page);

  /** @type {Map<string, Set<number>>} */
  const openHoursByDate = new Map();
  /** @type {Set<string>} */
  const capturedDates = new Set();

  const windows = [
    { start: getJstDateString(0), end: getJstDateString(13) },
    { start: getJstDateString(14), end: getJstDateString(27) },
  ];

  try {
    console.log(`[${venue.id}] Opening ${venue.fullName}...`);

    for (const { start, end } of windows) {
      const targetUrl = buildWindowUrl(venue.scraperUrl, start, end);
      await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 45_000 });
      await page.waitForSelector('.AvailabilityFrameSet_frame', { timeout: 20_000 });
      await dismissDialogs(page);
      await parseVisibleTables(page, openHoursByDate, capturedDates);
    }

    console.log(`[${venue.id}] Captured ${capturedDates.size} dates for ${venue.shortName}.`);
  } finally {
    await page.close();
  }

  const maxHour = getEffectiveMaxStartHour(venue);
  const updatedAt = new Date().toISOString();
  /** @type {CourtSlotRecord[]} */
  const records = [];
  let openCount = 0;
  let bookedCount = 0;
  let closedCount = 0;

  for (let offset = 0; offset < SCRAPE_DAYS; offset += 1) {
    const dateKey = getJstDateString(offset);
    const openSet = openHoursByDate.get(dateKey);

    for (const startHour of ALLOWED_START_HOURS) {
      const timeRange = formatTimeRange(startHour);

      /** @type {'open' | 'booked' | 'closed'} */
      let status = 'closed';
      if (startHour <= maxHour) {
        status = openSet?.has(startHour) ? 'open' : 'booked';
      }

      if (status === 'open') openCount += 1;
      else if (status === 'booked') bookedCount += 1;
      else closedCount += 1;

      records.push({
        slot_key: `${dateKey}_${venue.id}_${timeRange}`,
        slot_date: dateKey,
        time_range: timeRange,
        court_detail: venue.id,
        status,
        updated_at: updatedAt,
      });
    }
  }

  console.log(
    `[${venue.id}] Prepared ${records.length} slots ` +
      `(${openCount} open, ${bookedCount} booked, ${closedCount} closed).`
  );

  return records;
}

/**
 * Scrapes all Yoyacool venues and syncs their 28-day court availability to Supabase.
 *
 * @returns {Promise<void>}
 */
async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  const supabase = isDryRun ? null : createSupabaseServiceClient();

  const yoyacoolVenues = VENUES.filter((venue) => venue.source === 'yoyacool');
  const minDate = getJstDateString(0);
  const browser = await chromium.launch({ headless: true });

  /** @type {CourtSlotRecord[]} */
  let allRecords;
  try {
    const nested = await runWithConcurrency(yoyacoolVenues, CONCURRENCY, (venue) =>
      scrapeYoyacoolVenue(browser, venue)
    );
    allRecords = nested.flat();
  } finally {
    await browser.close();
  }

  if (!supabase) {
    console.log(`[yoyacool] Dry run complete (${allRecords.length} records).`);
    return;
  }

  await syncCourtAvailability(supabase, {
    venueIds: yoyacoolVenues.map((venue) => venue.id),
    minDate,
    records: allRecords,
  });

  console.log(
    `[yoyacool] Synced ${allRecords.length} slots across ${yoyacoolVenues.length} venues.`
  );
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[yoyacool] Fatal error: ${message}`);
  process.exitCode = 1;
}