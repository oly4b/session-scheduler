import { chromium } from 'playwright';
import { VENUES } from '../src/config/venues.js';
import {
  ALLOWED_HOURS_SET,
  ALLOWED_START_HOURS,
  CONCURRENCY,
  SCRAPE_DAYS,
  blockNonEssentialAssets,
  createSupabaseServiceClient,
  formatTimeRange,
  getCurrentJstHour,
  getJstParts,
  isSlotPastCurrentJst,
  runWithConcurrency,
  syncCourtAvailability,
} from './lib/scraper-utils.js';

const GRAPHQL_ENDPOINT = 'v3api.spacemarket.com/graphql';
const LEGACY_DIVISION_FILTER = [
  'court_detail.like.spacepad_1/3%',
  'court_detail.like.mizushima_gym_1/4%',
  'court_detail.in.(1/2面A,1/2面B)',
].join(',');

/**
 * @typedef {import('playwright').Browser} Browser
 * @typedef {import('playwright').Page} Page
 * @typedef {import('playwright').Response} Response
 * @typedef {import('./lib/scraper-utils.js').JstDateParts} JstDateParts
 * @typedef {import('./lib/scraper-utils.js').CourtSlotRecord} CourtSlotRecord
 * @typedef {{
 *   id: string,
 *   source: string,
 *   shortName: string,
 *   fullName: string,
 *   scraperUrl: string,
 *   maxStartHour?: number,
 *   allowAnyDivision?: boolean,
 *   targetDivisionIds?: string[],
 *   targetDivisionNames?: string[],
 * }} VenueConfig
 */

/**
 * Zero-pads unpadded `YYYY-M-D` calendar attributes into `YYYY-MM-DD`.
 *
 * @param {string | null} rawDate
 * @returns {string}
 */
function normalizeDataDate(rawDate) {
  const parts = String(rawDate || '').split('-');
  if (parts.length !== 3) return '';

  return (
    `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`
  );
}

/**
 * Checks whether a Spacepad room division matches the configured venue target.
 *
 * @param {VenueConfig} venue
 * @param {{ id?: string | number, name?: string } | null | undefined} integration
 * @returns {boolean}
 */
function isTargetDivision(venue, integration) {
  if (venue.allowAnyDivision) return true;
  if (!integration) return false;

  const id = String(integration.id || '');
  if (venue.targetDivisionIds?.includes(id)) return true;

  const normalizedName = String(integration.name || '')
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/\s+/g, '');

  return Boolean(
    venue.targetDivisionNames?.some((target) =>
      normalizedName.includes(target)
    )
  );
}

/**
 * Waits for a Spacepad GraphQL calendar response triggered by a UI interaction.
 *
 * @param {Page} page
 * @param {boolean} [requireCalendarQuery=false]
 * @returns {Promise<Response | null>}
 */
function waitForCalendarGraphql(page, requireCalendarQuery = false) {
  return page
    .waitForResponse(
      (res) => {
        if (!res.url().includes(GRAPHQL_ENDPOINT)) return false;
        if (!requireCalendarQuery) return true;

        const body = res.request().postData() || '';
        return (
          body.includes('divisionReservationHourlyCalendar') ||
          body.includes('reservationHourCalendar')
        );
      },
      { timeout: 3000 }
    )
    .catch(() => null);
}

/**
 * Clicks all unvisited open calendar cells within `monthPrefix` and
 * `[minDate, maxDate]`.
 *
 * @param {Page} page
 * @param {string} monthPrefix
 * @param {string} minDate
 * @param {string} maxDate
 * @param {Set<string>} clickedRawDates
 * @returns {Promise<void>}
 */
async function clickOpenDatesForMonth(
  page,
  monthPrefix,
  minDate,
  maxDate,
  clickedRawDates
) {
  const rawDates = await page.evaluate(() =>
    Array.from(
      document.querySelectorAll(
        'button[role="gridcell"][aria-readonly="false"]'
      )
    ).map((btn) => btn.getAttribute('data-date') || '')
  );

  for (const rawDate of rawDates) {
    if (!rawDate || clickedRawDates.has(rawDate)) continue;

    const normalized = normalizeDataDate(rawDate);
    if (!normalized.startsWith(monthPrefix)) continue;
    if (normalized < minDate || normalized > maxDate) continue;

    const cell = page
      .locator(`button[role="gridcell"][data-date="${rawDate}"]`)
      .first();
    if (!(await cell.count())) continue;

    const graphqlResponse = waitForCalendarGraphql(page, true);
    await cell.click({ timeout: 5000 });
    clickedRawDates.add(rawDate);
    await graphqlResponse;
    await page.waitForTimeout(150);
  }
}

/**
 * Advances the Spacepad date picker to the next calendar month when the 28-day
 * window crosses a month boundary.
 *
 * @param {Page} page
 * @param {JstDateParts} endParts
 * @param {Set<string>} clickedRawDates
 * @returns {Promise<void>}
 */
async function advanceToNextMonth(page, endParts, clickedRawDates) {
  const unpaddedPrefix = `${endParts.year}-${endParts.month}-`;
  const paddedPrefix =
    `${endParts.year}-${String(endParts.month).padStart(2, '0')}-`;
  const midMonthSelector =
    `button[role="gridcell"][data-date="${unpaddedPrefix}15"], ` +
    `button[role="gridcell"][data-date="${paddedPrefix}15"]`;
  const overflowSelector =
    `button[role="gridcell"][aria-readonly="false"][data-date^="${unpaddedPrefix}"], ` +
    `button[role="gridcell"][aria-readonly="false"][data-date^="${paddedPrefix}"]`;

  const nextMonthBtn = page.locator('button[aria-label="次の月"]').first();
  if ((await nextMonthBtn.count()) && !(await nextMonthBtn.isDisabled())) {
    await nextMonthBtn.click({ timeout: 3000 }).catch(() => null);
    await page
      .waitForSelector(midMonthSelector, { timeout: 4000 })
      .catch(() => null);
  }

  if (!(await page.locator(midMonthSelector).count())) {
    const overflowCell = page.locator(overflowSelector).first();
    if (await overflowCell.count()) {
      const graphqlResponse = waitForCalendarGraphql(page, false);
      await overflowCell.click({ timeout: 3000 }).catch(() => null);

      const rawDate = await overflowCell.getAttribute('data-date');
      if (rawDate) clickedRawDates.add(rawDate);

      await graphqlResponse;
      await page
        .waitForSelector(midMonthSelector, { timeout: 4000 })
        .catch(() => null);
    }
  }

  await page.waitForTimeout(250);
}

/**
 * Intercepts Spacepad GraphQL responses across a 28-day window for one venue,
 * skipping already-passed hours today and normalizing remaining slots.
 *
 * @param {Browser} browser
 * @param {VenueConfig} venue
 * @param {JstDateParts} startParts
 * @param {JstDateParts} endParts
 * @param {number} currentJstHour
 * @returns {Promise<CourtSlotRecord[]>}
 */
async function scrapeSpacepadVenue(
  browser,
  venue,
  startParts,
  endParts,
  currentJstHour
) {
  const minDate = startParts.dateKey;
  const maxDate = endParts.dateKey;
  const page = await browser.newPage({
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
  });

  await blockNonEssentialAssets(page);

  /** @type {Map<string, Set<number>>} */
  const openHoursByDate = new Map();
  /** @type {Set<string>} */
  const capturedDates = new Set();

  function recordSchedules(schedules) {
    for (const schedule of schedules || []) {
      const dateKey = schedule.startedAt.slice(0, 10);
      if (dateKey < minDate || dateKey > maxDate) continue;

      capturedDates.add(dateKey);
      if (schedule.status !== 1 && schedule.statusText !== '空き') continue;

      let openHours = openHoursByDate.get(dateKey);
      if (!openHours) {
        openHours = new Set();
        openHoursByDate.set(dateKey, openHours);
      }

      const startHour = Number(schedule.startedAt.slice(11, 13));
      const endHour = Number(schedule.endedAt.slice(11, 13));
      for (let hour = startHour; hour < endHour; hour += 1) {
        if (
          ALLOWED_HOURS_SET.has(hour) &&
          !isSlotPastCurrentJst(dateKey, hour, minDate, currentJstHour)
        ) {
          openHours.add(hour);
        }
      }
    }
  }

  page.on('response', async (response) => {
    if (!response.url().includes(GRAPHQL_ENDPOINT)) return;

    try {
      const payload = await response.json();
      if (payload.errors || !payload.data) return;

      const divisionCalendars = payload.data.divisionReservationHourCalendar;
      if (Array.isArray(divisionCalendars)) {
        for (const entry of divisionCalendars) {
          if (isTargetDivision(venue, entry.roomDivisionIntegration)) {
            recordSchedules(entry.schedules);
          }
        }
      }

      // Single-space rooms return schedules without court divisions.
      const saasSchedules = payload.data.saasReservationHourCalendar;
      if (Array.isArray(saasSchedules) && venue.allowAnyDivision) {
        recordSchedules(saasSchedules);
      }
    } catch {
      // Ignore non-JSON or aborted GraphQL preflight responses.
    }
  });

  try {
    console.log(`[${venue.id}] Opening ${venue.fullName}...`);
    await page.goto(venue.scraperUrl, {
      waitUntil: 'networkidle',
      timeout: 45_000,
    });
    await page.waitForSelector('button[role="gridcell"]', {
      timeout: 15_000,
    });

    /** @type {Set<string>} */
    const clickedRawDates = new Set();

    await clickOpenDatesForMonth(
      page,
      startParts.monthPrefix,
      minDate,
      maxDate,
      clickedRawDates
    );

    if (startParts.monthPrefix !== endParts.monthPrefix) {
      await advanceToNextMonth(page, endParts, clickedRawDates);
      await clickOpenDatesForMonth(
        page,
        endParts.monthPrefix,
        minDate,
        maxDate,
        clickedRawDates
      );
    }

    console.log(
      `[${venue.id}] Captured ${capturedDates.size} dates for ${venue.shortName}.`
    );
  } finally {
    await page.close();
  }

  const maxHour = venue.maxStartHour ?? 21;
  const updatedAt = new Date().toISOString();
  /** @type {CourtSlotRecord[]} */
  const records = [];
  let openCount = 0;
  let bookedCount = 0;
  let closedCount = 0;
  let skippedPastCount = 0;

  for (let offset = 0; offset < SCRAPE_DAYS; offset += 1) {
    const { dateKey } = getJstParts(offset);
    const openSet = openHoursByDate.get(dateKey);

    for (const startHour of ALLOWED_START_HOURS) {
      if (isSlotPastCurrentJst(dateKey, startHour, minDate, currentJstHour)) {
        skippedPastCount += 1;
        continue;
      }

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
      `(${openCount} open, ${bookedCount} booked, ${closedCount} closed, ` +
      `${skippedPastCount} past skipped).`
  );

  return records;
}

/**
 * Scrapes all Spacepad venues and syncs their 28-day court availability to
 * Supabase.
 *
 * @returns {Promise<void>}
 */
async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  const supabase = isDryRun ? null : createSupabaseServiceClient();

  const spacepadVenues = VENUES.filter((venue) => venue.source === 'spacepad');
  const startParts = getJstParts(0);
  const endParts = getJstParts(SCRAPE_DAYS - 1);
  const currentJstHour = getCurrentJstHour();
  const browser = await chromium.launch({ headless: true });

  /** @type {CourtSlotRecord[]} */
  let allRecords;
  try {
    const nested = await runWithConcurrency(
      spacepadVenues,
      CONCURRENCY,
      (venue) =>
        scrapeSpacepadVenue(
          browser,
          venue,
          startParts,
          endParts,
          currentJstHour
        )
    );
    allRecords = nested.flat();
  } finally {
    await browser.close();
  }

  if (!supabase) {
    console.log(
      `[spacepad] Dry run complete (${allRecords.length} records).`
    );
    return;
  }

  await syncCourtAvailability(supabase, {
    venueIds: spacepadVenues.map((venue) => venue.id),
    minDate: startParts.dateKey,
    records: allRecords,
    legacyOrFilter: LEGACY_DIVISION_FILTER,
  });

  console.log(
    `[spacepad] Synced ${allRecords.length} slots across ` +
      `${spacepadVenues.length} venues.`
  );
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[spacepad] Fatal error: ${message}`);
  process.exitCode = 1;
}