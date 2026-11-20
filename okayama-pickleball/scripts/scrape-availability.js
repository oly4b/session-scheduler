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
const ALLOWED_START_HOURS = new Set([12, 13, 14, 15, 16, 17, 18, 19, 20]);

const TARGET_URL =
  'https://yoyacool.e-harp.jp/okayamacity/FacilityAvailability/Index/331007/0031?ptn=3&rc=141&rc2w=141';

function getJstDateString(offsetDays = 0) {
  const now = new Date();
  const jstTime = new Date(now.getTime() + 9 * 60 * 60 * 1000 + offsetDays * 86400000);
  return jstTime.toISOString().slice(0, 10);
}

function getJstYear() {
  const now = new Date();
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).getUTCFullYear();
}

function resolveDateKey(text) {
  const match = text.match(/(\d{1,2})月(\d{1,2})日/);
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);

  const nowJst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const currentYear = getJstYear();
  const currentMonth = nowJst.getUTCMonth() + 1;
  const year = currentMonth === 12 && month === 1 ? currentYear + 1 : currentYear;

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

async function parseVisibleTables(page, recordsMap) {
  // Scroll any internal Vuetify containers (html has h-noScroll) so all sections mount
  await page.evaluate(async () => {
    const scrollables = Array.from(document.querySelectorAll('*')).filter(
      (el) => el.scrollHeight > el.clientHeight + 100
    );
    for (const el of scrollables) {
      for (let y = 0; y <= el.scrollHeight; y += 800) {
        el.scrollTop = y;
        await new Promise((r) => setTimeout(r, 80));
      }
      el.scrollTop = 0;
    }
  });
  await page.waitForTimeout(800);

  const allTablesRows = await page.evaluate(() => {
    const normalize = (s) =>
      (s || '')
        .replace(/[！-～]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
        .replace(/\u3000/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const visibleTables = Array.from(document.querySelectorAll('table')).filter(
      (t) => t.offsetParent !== null && normalize(t.innerText).includes('サブアリーナ')
    );

    return visibleTables.map((table) =>
      Array.from(table.querySelectorAll('tr')).map((tr) => {
        const rowText = normalize(tr.innerText);
        const cells = Array.from(tr.querySelectorAll('th, td'));
        const frames = Array.from(tr.querySelectorAll('.AvailabilityFrameSet_frame')).map((el) => ({
          text: normalize(el.innerText),
          title: normalize(
            el.querySelector('.AvailabilityFrameSet_frame_content')?.getAttribute('title') || ''
          ),
          startTime: el.querySelector('time')?.getAttribute('datetime') || '',
        }));

        return {
          rowText,
          firstCellText: cells[0] ? normalize(cells[0].innerText) : '',
          frames,
        };
      })
    );
  });

  for (const tableRows of allTablesRows) {
    let currentCourt = null;

    for (const row of tableRows) {
      const hasDate = /\d{1,2}月\d{1,2}日/.test(row.firstCellText);

      // Section banner rows have "サブアリーナ" + court label, and NO date
      if (!hasDate && row.rowText.includes('サブアリーナ')) {
        const courtMatch = row.rowText.match(/1\/2\s*面?\s*([AB])/i);
        if (courtMatch) {
          currentCourt = `1/2面${courtMatch[1].toUpperCase()}`;
        } else {
          currentCourt = null;
        }
        continue;
      }

      if (!hasDate || !ALLOWED_COURTS.has(currentCourt)) continue;

      const slotDate = resolveDateKey(row.firstCellText);
      if (!slotDate || row.frames.length === 0) continue;

      for (const frame of row.frames) {
        let startHour = null;
        let endHour = null;

        if (frame.startTime && frame.startTime.length >= 13) {
          startHour = Number(frame.startTime.slice(11, 13));
          endHour = startHour + 1;
        } else {
          const hourMatch = frame.text.match(/(\d{1,2})時から(\d{1,2})時/);
          if (!hourMatch) continue;
          startHour = Number(hourMatch[1]);
          endHour = Number(hourMatch[2]);
        }

        if (!ALLOWED_START_HOURS.has(startHour)) continue;

        const combined = `${frame.text} ${frame.title}`;
        let status = 'booked';
        if (
          combined.includes('trip_origin') ||
          combined.includes('空き状況のみ') ||
          combined.includes('空きあり') ||
          combined.includes('○')
        ) {
          status = 'open';
        } else if (
          combined.includes('hotel') ||
          combined.includes('休館') ||
          combined.includes('保守')
        ) {
          status = 'closed';
        }

        const timeRange = `${String(startHour).padStart(2, '0')}:00-${String(endHour).padStart(
          2,
          '0'
        )}:00`;
        const slotKey = `${slotDate}_${currentCourt}_${timeRange}`;

        recordsMap.set(slotKey, {
          slot_key: slotKey,
          slot_date: slotDate,
          time_range: timeRange,
          court_detail: currentCourt,
          status,
          updated_at: new Date().toISOString(),
        });
      }
    }
  }
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
    viewport: { width: 1440, height: 12000 },
  });

  try {
    const recordsMap = new Map();

    // 1. Load Weeks 1–2 (Days 0–13)
    console.log(`Opening yoyacool (Weeks 1–2): ${TARGET_URL}`);
    await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForSelector('.AvailabilityFrameSet_frame', { timeout: 20000 });

    // Dismiss first-visit tutorial modal blocking pointer events
    const skipBtn = page.locator('.v-dialog--active button', { hasText: 'スキップ' }).first();
    if (await skipBtn.count()) {
      await skipBtn.click();
      await page.waitForTimeout(400);
    }

    const firstHeader = await page
      .locator('.AvailabilityFrames')
      .first()
      .innerText()
      .then((t) => t.split('\n')[0].trim());
    console.log(`Weeks 1–2 header: ${firstHeader}`);

    await parseVisibleTables(page, recordsMap);

    // 2. Click "次の２週間" to load Weeks 3–4 (Days 14–27)
    const nextBtn = page
      .locator('button.AvailabilityDateSelection_sideBtn:visible', { hasText: '次の２週間' })
      .first();

    if (await nextBtn.count()) {
      console.log('Clicking "次の２週間" to load Weeks 3–4...');
      await nextBtn.click();

      await page
        .waitForFunction(
          (prev) => {
            const el = document.querySelector('.AvailabilityFrames');
            const cur = (el?.innerText || '').split('\n')[0].trim();
            return cur !== '' && cur !== prev;
          },
          firstHeader,
          { timeout: 15000 }
        )
        .catch(() => null);

      await page.waitForLoadState('networkidle').catch(() => null);
      await page.waitForTimeout(1000);

      const secondHeader = await page
        .locator('.AvailabilityFrames')
        .first()
        .innerText()
        .then((t) => t.split('\n')[0].trim());
      console.log(`Weeks 3–4 header: ${secondHeader}`);

      await parseVisibleTables(page, recordsMap);
    }

    const minDate = getJstDateString(0);
    const maxDate = getJstDateString(27);
    const records = Array.from(recordsMap.values()).filter(
      (r) => r.slot_date >= minDate && r.slot_date <= maxDate
    );

    const courtCounts = records.reduce((acc, r) => {
      acc[`${r.court_detail} (${r.status})`] = (acc[`${r.court_detail} (${r.status})`] || 0) + 1;
      return acc;
    }, {});
    const uniqueDates = [...new Set(records.map((r) => r.slot_date))].sort();

    console.log(`Parsed ${records.length} total slots:`, courtCounts);
    console.log(`Dates scraped (${uniqueDates.length}): ${uniqueDates.join(', ')}`);

    if (records.length === 0) {
      process.exit(0);
    }

    // Remove past dates only for Seto Gym so Spacepad rows are untouched
    const { error: deleteError } = await supabase
      .from('court_availability')
      .delete()
      .in('court_detail', ['1/2面A', '1/2面B'])
      .lt('slot_date', minDate);

    if (deleteError) {
      console.error('Supabase prune error:', deleteError);
    }

    // Upsert the current 28-day (4-week) window
    const { error } = await supabase
      .from('court_availability')
      .upsert(records, { onConflict: 'slot_key' });

    if (error) {
      console.error('Supabase upsert error:', error);
      process.exit(1);
    }

    console.log('Successfully synced 4 weeks (28 days) of 1/2面A and 1/2面B availability to Supabase.');
  } finally {
    await browser.close();
  }
}

run();