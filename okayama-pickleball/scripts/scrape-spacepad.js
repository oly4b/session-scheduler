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

const SPACEPAD_VENUES = VENUES.filter((v) => v.source === 'spacepad');
const ALLOWED_START_HOURS = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
const CONCURRENCY = 3;

function getJstParts(offsetDays = 0) {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000 + offsetDays * 86400000);
  const year = jst.getUTCFullYear();
  const month = jst.getUTCMonth() + 1;
  const day = jst.getUTCDate();
  return {
    year,
    month,
    day,
    monthPrefix: `${year}-${String(month).padStart(2, '0')}`,
    dateKey: jst.toISOString().slice(0, 10),
  };
}

function normalizeDataDate(raw) {
  const parts = String(raw || '').split('-');
  if (parts.length !== 3) return '';
  return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
}

async function getOpenGridCells(page) {
  return page.evaluate(() => {
    return Array.from(
      document.querySelectorAll('button[role="gridcell"][aria-readonly="false"]')
    ).map((btn) => ({
      rawDate: btn.getAttribute('data-date') || '',
      label: btn.textContent?.trim() || '',
    }));
  });
}

function isTargetDivision(venue, integration) {
  if (venue.allowAnyDivision) return true;
  if (!integration) return false;

  const id = String(integration.id || '');
  const cleanName = String(integration.name || '')
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/\s+/g, '');

  if (venue.targetDivisionIds?.includes(id)) return true;
  if (venue.targetDivisionNames?.some((n) => cleanName.includes(n))) return true;
  return false;
}

async function scrapeVenue(browser, venue, startParts, endParts) {
  const minDate = startParts.dateKey;
  const maxDate = endParts.dateKey;

  const page = await browser.newPage({
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
  });

  const openHoursByDate = new Map();
  const capturedDates = new Set();

  function recordSchedules(schedules) {
    for (const sched of schedules || []) {
      const dateKey = sched.startedAt.slice(0, 10);
      if (dateKey < minDate || dateKey > maxDate) continue;

      capturedDates.add(dateKey);
      if (!openHoursByDate.has(dateKey)) {
        openHoursByDate.set(dateKey, new Set());
      }

      if (sched.status === 1 || sched.statusText === '空き') {
        const startHour = Number(sched.startedAt.slice(11, 13));
        const endHour = Number(sched.endedAt.slice(11, 13));
        for (let h = startHour; h < endHour; h += 1) {
          if (ALLOWED_START_HOURS.includes(h)) {
            openHoursByDate.get(dateKey).add(h);
          }
        }
      }
    }
  }

  page.on('response', async (res) => {
    if (!res.url().includes('v3api.spacemarket.com/graphql')) return;
    try {
      const json = await res.json();
      if (json.errors || !json.data) return;

      // Case 1: Divided rooms (1/4, 1/3, 半面)
      const divEntries = json.data.divisionReservationHourCalendar;
      if (Array.isArray(divEntries)) {
        for (const entry of divEntries) {
          if (!isTargetDivision(venue, entry.roomDivisionIntegration)) continue;
          recordSchedules(entry.schedules);
        }
      }

      // Case 2: Single-space rooms without court divisions (e.g., ウエイトリフティング場)
      const saasSchedules = json.data.saasReservationHourCalendar;
      if (Array.isArray(saasSchedules) && venue.allowAnyDivision) {
        recordSchedules(saasSchedules);
      }
    } catch {
      // Ignore non-JSON responses
    }
  });

  try {
    console.log(`[${venue.id}] Opening ${venue.fullName}...`);
    await page.goto(venue.scraperUrl, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForSelector('button[role="gridcell"]', { timeout: 15000 });

    const clickedRawDates = new Set();

    async function clickOpenDatesForMonth(targetMonthPrefix) {
      const openCells = await getOpenGridCells(page);
      const targets = openCells.filter((c) => {
        const norm = normalizeDataDate(c.rawDate);
        return (
          norm.startsWith(targetMonthPrefix) &&
          norm >= minDate &&
          norm <= maxDate &&
          !clickedRawDates.has(c.rawDate)
        );
      });

      for (const target of targets) {
        const cellLoc = page
          .locator(`button[role="gridcell"][data-date="${target.rawDate}"]`)
          .first();

        if (!(await cellLoc.count())) continue;

        const responsePromise = page
          .waitForResponse(
            (res) => {
              if (!res.url().includes('v3api.spacemarket.com/graphql')) return false;
              const body = res.request().postData() || '';
              return (
                body.includes('divisionReservationHourlyCalendar') ||
                body.includes('reservationHourCalendar')
              );
            },
            { timeout: 3000 }
          )
          .catch(() => null);

        await cellLoc.click({ timeout: 5000 });
        clickedRawDates.add(target.rawDate);
        await responsePromise;
        await page.waitForTimeout(150);
      }
    }

    // Pass 1: Current month dates
    await clickOpenDatesForMonth(startParts.monthPrefix);

    // Pass 2: Advance to next month if the 28-day window crosses a month boundary
    if (startParts.monthPrefix !== endParts.monthPrefix) {
      const mUnpadded = `${endParts.year}-${endParts.month}-`;
      const mPadded = `${endParts.year}-${String(endParts.month).padStart(2, '0')}-`;
      const midMonthSelector = `button[role="gridcell"][data-date="${mUnpadded}15"], button[role="gridcell"][data-date="${mPadded}15"]`;
      const openOverflowSelector = `button[role="gridcell"][aria-readonly="false"][data-date^="${mUnpadded}"], button[role="gridcell"][aria-readonly="false"][data-date^="${mPadded}"]`;

      // 1. Click the exact next-month button via aria-label="次の月"
      const nextBtn = page.locator('button[aria-label="次の月"]').first();
      if ((await nextBtn.count()) && !(await nextBtn.isDisabled())) {
        await nextBtn.click({ timeout: 3000 }).catch(() => null);
        await page.waitForSelector(midMonthSelector, { timeout: 4000 }).catch(() => null);
      }

      // 2. Fallback: click an open overflow date from next month (e.g. 2026-12-1) to trigger full month render
      if (!(await page.locator(midMonthSelector).count())) {
        const overflowTarget = page.locator(openOverflowSelector).first();
        if (await overflowTarget.count()) {
          const respPromise = page
            .waitForResponse(
              (res) => res.url().includes('v3api.spacemarket.com/graphql'),
              { timeout: 3000 }
            )
            .catch(() => null);
          await overflowTarget.click({ timeout: 3000 }).catch(() => null);
          const raw = await overflowTarget.getAttribute('data-date');
          if (raw) clickedRawDates.add(raw);
          await respPromise;
          await page.waitForSelector(midMonthSelector, { timeout: 4000 }).catch(() => null);
        }
      }

      await page.waitForTimeout(250);
      await clickOpenDatesForMonth(endParts.monthPrefix);
    }

    console.log(
      `[${venue.id}] Captured ${capturedDates.size} dates for ${venue.shortName}.`
    );
  } finally {
    await page.close();
  }

  const venueRecords = [];
  for (let offset = 0; offset < 28; offset += 1) {
    const { dateKey } = getJstParts(offset);
    const openSet = openHoursByDate.get(dateKey) || new Set();

    for (const startHour of ALLOWED_START_HOURS) {
      const timeRange = `${String(startHour).padStart(2, '0')}:00-${String(startHour + 1).padStart(2, '0')}:00`;
      const isAllowedHour = startHour <= (venue.maxStartHour ?? 21);
      venueRecords.push({
        slot_key: `${dateKey}_${venue.id}_${timeRange}`,
        slot_date: dateKey,
        time_range: timeRange,
        court_detail: venue.id,
        status: isAllowedHour && openSet.has(startHour) ? 'open' : 'booked',
        updated_at: new Date().toISOString(),
      });
    }
  }

  const openCount = venueRecords.filter((r) => r.status === 'open').length;
  console.log(
    `[${venue.id}] Prepared ${venueRecords.length} venue slots (${openCount} open, ${venueRecords.length - openCount} booked).`
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
  const startParts = getJstParts(0);
  const endParts = getJstParts(27);
  const minDate = startParts.dateKey;

  const browser = await chromium.launch({ headless: true });
  let allRecords = [];

  try {
    const nested = await runWithConcurrency(SPACEPAD_VENUES, CONCURRENCY, (venue) =>
      scrapeVenue(browser, venue, startParts, endParts)
    );
    allRecords = nested.flat();
  } finally {
    await browser.close();
  }

  if (process.argv.includes('--dry-run')) {
    console.log(`\nDry run complete (${allRecords.length} total records) — skipped Supabase writes.`);
    process.exit(0);
  }

  const venueIds = SPACEPAD_VENUES.map((v) => v.id);

  await supabase
    .from('court_availability')
    .delete()
    .in('court_detail', venueIds)
    .lt('slot_date', minDate);

  // Remove old per-court division rows so only clean venue-level rows remain
  await supabase
    .from('court_availability')
    .delete()
    .or('court_detail.like.spacepad_1/3%,court_detail.like.mizushima_gym_1/4%,court_detail.in.(1/2面A,1/2面B)');

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
    `\nSuccessfully synced ${allRecords.length} venue-level slots across ${SPACEPAD_VENUES.length} Spacepad venues.`
  );
}

run();