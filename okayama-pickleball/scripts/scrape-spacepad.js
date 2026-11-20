import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const SPACEPAD_VENUES = [
  {
    name: 'シマダみらいアリーナ水島 (Fukuda Park)',
    url: 'https://booking.spacepad.jp/provider/50833/spaces/itjbcjdbdle4-tgj/rooms/pxMub8xjITrSyqBW/reservations/new/?from=room_reservation_button&rent_type=1',
    divisions: {
      '5558': 'spacepad_1/3(1)',
      '5559': 'spacepad_1/3(2)',
      '5560': 'spacepad_1/3(3)',
    },
    matchDivision: (id, cleanName) => {
      if (cleanName.includes('1/3面(1)') || id === '5558') return 'spacepad_1/3(1)';
      if (cleanName.includes('1/3面(2)') || id === '5559') return 'spacepad_1/3(2)';
      if (cleanName.includes('1/3面(3)') || id === '5560') return 'spacepad_1/3(3)';
      return null;
    },
  },
  {
    name: '水島体育館 (Mizushima Gymnasium)',
    url: 'https://booking.spacepad.jp/provider/50833/spaces/w2xrdrqqmbh-yo2u/rooms/vo_5DKw8ofQonMDL/reservations/new/?from=room_reservation_button&rent_type=1',
    divisions: {
      '5506': 'mizushima_gym_1/4(1)',
      '5570': 'mizushima_gym_1/4(2)',
      '5571': 'mizushima_gym_1/4(3)',
      '5572': 'mizushima_gym_1/4(4)',
    },
    matchDivision: (id, cleanName) => {
      if (cleanName.includes('1/4面(1)') || id === '5506') return 'mizushima_gym_1/4(1)';
      if (cleanName.includes('1/4面(2)') || id === '5570') return 'mizushima_gym_1/4(2)';
      if (cleanName.includes('1/4面(3)') || id === '5571') return 'mizushima_gym_1/4(3)';
      if (cleanName.includes('1/4面(4)') || id === '5572') return 'mizushima_gym_1/4(4)';
      return null;
    },
  },
];

const ALLOWED_START_HOURS = [12, 13, 14, 15, 16, 17, 18, 19, 20];

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

async function scrapeVenue(browser, venue, startParts, endParts) {
  const minDate = startParts.dateKey;
  const maxDate = endParts.dateKey;

  const page = await browser.newPage({
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
  });

  const openHoursByDivision = {};
  for (const label of Object.values(venue.divisions)) {
    openHoursByDivision[label] = new Map();
  }

  const capturedDates = new Set();

  page.on('response', async (res) => {
    if (!res.url().includes('v3api.spacemarket.com/graphql')) return;
    try {
      const post = JSON.parse(res.request().postData() || '{}');
      if (post.operationName !== 'divisionReservationHourlyCalendar') return;

      const json = await res.json();
      if (json.errors) return;

      const entries = json.data?.divisionReservationHourCalendar || [];
      for (const entry of entries) {
        const integration = entry.roomDivisionIntegration;
        const id = String(integration?.id || '');
        const cleanName = String(integration?.name || '')
          .replace(/（/g, '(')
          .replace(/）/g, ')')
          .replace(/\s+/g, '');

        const courtLabel = venue.matchDivision(id, cleanName);
        if (!courtLabel) continue;

        const dateMap = openHoursByDivision[courtLabel];

        for (const sched of entry.schedules || []) {
          const dateKey = sched.startedAt.slice(0, 10);
          if (dateKey < minDate || dateKey > maxDate) continue;

          capturedDates.add(dateKey);

          if (!dateMap.has(dateKey)) {
            dateMap.set(dateKey, new Set());
          }

          if (sched.status === 1 || sched.statusText === '空き') {
            const startHour = Number(sched.startedAt.slice(11, 13));
            const endHour = Number(sched.endedAt.slice(11, 13));
            for (let h = startHour; h < endHour; h += 1) {
              if (ALLOWED_START_HOURS.includes(h)) {
                dateMap.get(dateKey).add(h);
              }
            }
          }
        }
      }
    } catch {
      // Ignore non-JSON responses
    }
  });

  try {
    console.log(`\n=== Opening ${venue.name} ===`);
    await page.goto(venue.url, { waitUntil: 'networkidle', timeout: 45000 });
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

      console.log(
        `[${targetMonthPrefix}] Found ${targets.length} open dates: ${targets.map((t) => t.rawDate).join(', ') || 'none'}`
      );

      for (const target of targets) {
        const cellLoc = page
          .locator(`button[role="gridcell"][data-date="${target.rawDate}"]`)
          .first();

        if (!(await cellLoc.count())) continue;

        const responsePromise = page
          .waitForResponse(
            (res) => {
              if (!res.url().includes('v3api.spacemarket.com/graphql')) return false;
              try {
                const post = JSON.parse(res.request().postData() || '{}');
                return post.operationName === 'divisionReservationHourlyCalendar';
              } catch {
                return false;
              }
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

    await clickOpenDatesForMonth(startParts.monthPrefix);

    if (startParts.monthPrefix !== endParts.monthPrefix) {
      const midMonthSelector = `button[role="gridcell"][data-date="${endParts.year}-${endParts.month}-15"]`;

      if (!(await page.locator(midMonthSelector).count())) {
        const headerLoc = page.locator('text=/^\\d{4}年\\s*\\d{1,2}月$/').first();
        await headerLoc.locator('xpath=following::button[1]').click();
        await page.waitForTimeout(500);

        if (!(await page.locator(midMonthSelector).count())) {
          const overflowOne = page
            .locator(`button[role="gridcell"][data-date="${endParts.year}-${endParts.month}-1"]`)
            .first();
          if (await overflowOne.count()) {
            await overflowOne.click();
          }
        }

        await page.waitForSelector(midMonthSelector, { timeout: 5000 });
        await page.waitForTimeout(300);
      }

      await clickOpenDatesForMonth(endParts.monthPrefix);
    }

    console.log(
      `Captured ${venue.name} schedule for ${capturedDates.size} dates: ${Array.from(capturedDates).sort().join(', ')}`
    );
  } finally {
    await page.close();
  }

  const venueRecords = [];
  for (const courtLabel of Object.values(venue.divisions)) {
    const dateMap = openHoursByDivision[courtLabel];

    for (let offset = 0; offset < 28; offset += 1) {
      const { dateKey } = getJstParts(offset);
      const openSet = dateMap.get(dateKey) || new Set();

      for (const startHour of ALLOWED_START_HOURS) {
        const timeRange = `${String(startHour).padStart(2, '0')}:00-${String(startHour + 1).padStart(2, '0')}:00`;
        venueRecords.push({
          slot_key: `${dateKey}_${courtLabel}_${timeRange}`,
          slot_date: dateKey,
          time_range: timeRange,
          court_detail: courtLabel,
          status: openSet.has(startHour) ? 'open' : 'booked',
          updated_at: new Date().toISOString(),
        });
      }
    }
  }

  const openCount = venueRecords.filter((r) => r.status === 'open').length;
  const countsByDiv = Object.values(venue.divisions)
    .map((label) => {
      const n = venueRecords.filter((r) => r.court_detail === label && r.status === 'open').length;
      return `${label}: ${n}`;
    })
    .join(', ');

  console.log(
    `Prepared ${venueRecords.length} slots for ${venue.name} (${openCount} open [${countsByDiv}], ${venueRecords.length - openCount} booked).`
  );

  return venueRecords;
}

async function run() {
  const startParts = getJstParts(0);
  const endParts = getJstParts(27);
  const minDate = startParts.dateKey;

  const browser = await chromium.launch({ headless: true });
  const allRecords = [];

  try {
    for (const venue of SPACEPAD_VENUES) {
      const records = await scrapeVenue(browser, venue, startParts, endParts);
      allRecords.push(...records);
    }
  } finally {
    await browser.close();
  }

  if (process.argv.includes('--dry-run')) {
    console.log(`\nDry run complete (${allRecords.length} total records) — skipped Supabase writes.`);
    process.exit(0);
  }

  const allDivisionLabels = SPACEPAD_VENUES.flatMap((v) => Object.values(v.divisions));

  await supabase
    .from('court_availability')
    .delete()
    .in('court_detail', allDivisionLabels)
    .lt('slot_date', minDate);

  // Upsert in chunks of 600 to stay well within request payload limits
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

  console.log(`\nSuccessfully synced ${allRecords.length} Spacepad slots across both venues to Supabase.`);
}

run();