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

function getJstDateString(offsetDays = 0) {
  const now = new Date();
  const jstTime = new Date(now.getTime() + 9 * 60 * 60 * 1000 + offsetDays * 86400000);
  return jstTime.toISOString().slice(0, 10);
}

function getJstYear() {
  const now = new Date();
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).getUTCFullYear();
}

function buildTargetUrl(startOffset = 0) {
  const startDate = getJstDateString(startOffset);
  const endDate = getJstDateString(startOffset + 13); // yoyacool renders 14-day blocks
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

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
    viewport: { width: 1440, height: 2400 },
  });

  try {
    const recordsMap = new Map();

    // Fetch two consecutive 14-day blocks: Days 0–13 (Weeks 1–2) and Days 14–27 (Weeks 3–4)
    for (const startOffset of [0, 14]) {
      const url = buildTargetUrl(startOffset);
      console.log(`Fetching block (offset +${startOffset}d): ${url}`);

      await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
      await page.waitForSelector('.AvailabilityFrameSet_frame', { timeout: 20000 });

      // Scroll down in steps to force any virtual/lazy-rendered rows to mount
      await page.evaluate(async () => {
        for (let y = 0; y <= document.body.scrollHeight; y += 600) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 150));
        }
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(1000);

      // Collect rows from ALL visible availability tables on the page
      const allTablesRows = await page.evaluate(() => {
        const normalize = (s) =>
          (s || '')
            .replace(/[！-～]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
            .replace(/ /g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        const visibleTables = Array.from(document.querySelectorAll('table')).filter(
          (t) => t.offsetParent !== null && normalize(t.innerText).includes('サブアリーナ')
        );

        return visibleTables.map((table) =>
          Array.from(table.querySelectorAll('tr')).map((tr) => {
            const rowText = normalize(tr.innerText);
            const cells = Array.from(tr.querySelectorAll('th, td'));
            const frames = Array.from(tr.querySelectorAll('.AvailabilityFrameSet_frame')).map((el) =>
              normalize(el.innerText)
            );

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

          for (const frameText of row.frames) {
            const hourMatch = frameText.match(/(\d{1,2})時から(\d{1,2})時/);
            if (!hourMatch) continue;

            const startHour = Number(hourMatch[1]);
            const endHour = Number(hourMatch[2]);
            if (!ALLOWED_START_HOURS.has(startHour)) continue;

            let status = 'booked';
            if (
              frameText.includes('trip_origin') ||
              frameText.includes('空き状況のみ') ||
              frameText.includes('空きあり') ||
              frameText.includes('○')
            ) {
              status = 'open';
            } else if (
              frameText.includes('hotel') ||
              frameText.includes('休館') ||
              frameText.includes('保守')
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

    const records = Array.from(recordsMap.values());
    const courtCounts = records.reduce((acc, r) => {
      acc[r.court_detail] = (acc[r.court_detail] || 0) + 1;
      return acc;
    }, {});
    const uniqueDates = [...new Set(records.map((r) => r.slot_date))].sort();

    console.log(`Parsed ${records.length} total slots:`, courtCounts);
    console.log(`Dates scraped (${uniqueDates.length}): ${uniqueDates.join(', ')}`);

    if (records.length === 0) {
      process.exit(0);
    }

    // 1. Remove past dates so the table stays capped at ~504 rows (28 days)
    const { error: deleteError } = await supabase
      .from('court_availability')
      .delete()
      .lt('slot_date', getJstDateString(0));

    if (deleteError) {
      console.error('Supabase prune error:', deleteError);
    }

    // 2. Upsert the current 28-day (4-week) window
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