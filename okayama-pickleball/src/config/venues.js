const SPACEPAD_BASE = 'https://booking.spacepad.jp/provider/50833';
const SPACEPAD_BOOKING_SUFFIX =
  '/reservations/new/?from=room_reservation_button&rent_type=1';
const YOYACOOL_BASE =
  'https://yoyacool.e-harp.jp/okayamacity/FacilityAvailability/Index/331007';
const MAPS_SEARCH_BASE = 'https://www.google.com/maps/search/?api=1&query=';

const DIVISION_THIRDS = ['1/3面(1)', '1/3面(2)', '1/3面(3)'];
const DIVISION_QUARTERS = ['1/4面(1)', '1/4面(2)', '1/4面(3)', '1/4面(4)'];
const DIVISION_HALVES = ['半面(A面)', '半面(B面)'];

/**
 * @typedef {{
 *   id: string,
 *   shortName: string,
 *   fullName: string,
 *   area: 'kurashiki' | 'okayama',
 *   source: 'spacepad' | 'yoyacool',
 *   courtType: 'indoor' | 'outdoor',
 *   hasLights: boolean,
 *   distanceKm: number,
 *   maxStartHour: number,
 *   scraperUrl: string,
 *   bookingUrl: string,
 *   mapUrl: string,
 *   allowAnyDivision?: boolean,
 *   targetDivisionIds?: string[],
 *   targetDivisionNames?: string[],
 * }} VenueConfig
 */

/**
 * Builds a Google Maps search URL for a Japanese facility query.
 *
 * @param {string} query
 * @returns {string}
 */
const mapsSearchUrl = (query) => `${MAPS_SEARCH_BASE}${encodeURIComponent(query)}`;

/**
 * Creates a Spacepad venue entry with derived room and reservation URLs.
 *
 * @param {{
 *   id: string,
 *   shortName: string,
 *   fullName: string,
 *   distanceKm: number,
 *   spaceId: string,
 *   roomId: string,
 *   mapUrl?: string,
 *   mapQuery?: string,
 *   allowAnyDivision?: boolean,
 *   targetDivisionIds?: string[],
 *   targetDivisionNames?: string[],
 * }} spec
 * @returns {VenueConfig}
 */
function spacepadVenue({
  id,
  shortName,
  fullName,
  distanceKm,
  spaceId,
  roomId,
  mapUrl,
  mapQuery,
  allowAnyDivision = false,
  targetDivisionIds = [],
  targetDivisionNames = [],
}) {
  const bookingUrl = `${SPACEPAD_BASE}/spaces/${spaceId}/rooms/${roomId}`;

  return {
    id,
    shortName,
    fullName,
    area: 'kurashiki',
    source: 'spacepad',
    courtType: 'indoor',
    hasLights: true,
    distanceKm,
    maxStartHour: 21,
    scraperUrl: `${bookingUrl}${SPACEPAD_BOOKING_SUFFIX}`,
    bookingUrl,
    mapUrl: mapUrl ?? mapsSearchUrl(mapQuery ?? fullName),
    allowAnyDivision,
    targetDivisionIds,
    targetDivisionNames,
  };
}

/**
 * Creates a Yoyacool venue entry with shared scraper and booking URLs.
 *
 * @param {{
 *   id: string,
 *   shortName: string,
 *   fullName: string,
 *   courtType: 'indoor' | 'outdoor',
 *   hasLights: boolean,
 *   distanceKm: number,
 *   facilityPath: string,
 *   mapQuery: string,
 * }} spec
 * @returns {VenueConfig}
 */
function yoyacoolVenue({
  id,
  shortName,
  fullName,
  courtType,
  hasLights,
  distanceKm,
  facilityPath,
  mapQuery,
}) {
  const url = `${YOYACOOL_BASE}/${facilityPath}`;

  return {
    id,
    shortName,
    fullName,
    area: 'okayama',
    source: 'yoyacool',
    courtType,
    hasLights,
    distanceKm,
    maxStartHour: hasLights ? 21 : 16,
    scraperUrl: url,
    bookingUrl: url,
    mapUrl: mapsSearchUrl(mapQuery),
  };
}

/**
 * Single source of truth for all venues across the frontend and scrapers.
 * Each venue stores a single venue-level `status` ('open' | 'booked') per hour
 * in `court_availability` (keyed by `court_detail = venue.id`), plus `hasLights`
 * and `distanceKm` (from JR Okayama Station) for court recommendation ranking.
 *
 * @type {VenueConfig[]}
 */
export const VENUES = [
  spacepadVenue({
    id: 'fukuda',
    shortName: '福田公園',
    fullName: 'シマダみらいアリーナ水島（福田公園）',
    distanceKm: 22.5,
    spaceId: 'itjbcjdbdle4-tgj',
    roomId: 'pxMub8xjITrSyqBW',
    mapUrl: 'https://maps.app.goo.gl/XiqAWzqDudww3Z1aA',
    targetDivisionIds: ['5558', '5559', '5560'],
    targetDivisionNames: DIVISION_THIRDS,
  }),
  spacepadVenue({
    id: 'mizushima',
    shortName: '水島体育館',
    fullName: '水島体育館',
    distanceKm: 24.0,
    spaceId: 'w2xrdrqqmbh-yo2u',
    roomId: 'vo_5DKw8ofQonMDL',
    mapUrl: 'https://maps.app.goo.gl/oFoRMkbfNLMs7eHM9',
    targetDivisionIds: ['5506', '5570', '5571', '5572'],
    targetDivisionNames: DIVISION_QUARTERS,
  }),
  spacepadVenue({
    id: 'kurashiki_gym',
    shortName: '倉敷体育館',
    fullName: '倉敷体育館',
    distanceKm: 16.5,
    spaceId: 'zywnbw47bh5crzg7',
    roomId: 'Wxn8mEfeUxzf2yA-',
    mapQuery: '倉敷体育館',
    targetDivisionIds: ['5552', '5553', '5554'],
    targetDivisionNames: DIVISION_THIRDS,
  }),
  spacepadVenue({
    id: 'kurashiki_weightlifting',
    shortName: '倉敷運動公園WL場',
    fullName: '倉敷運動公園 ウエイトリフティング場',
    distanceKm: 17.5,
    spaceId: 'tcccb8_exn7v_vhn',
    roomId: 'EhSlCG1XIyCAUmOC',
    mapQuery: '倉敷運動公園ウエイトリフティング場',
    allowAnyDivision: true,
  }),
  spacepadVenue({
    id: 'mizushima_fureai',
    shortName: '水島ふれあいセンター',
    fullName: '水島ふれあいセンター 体育館',
    distanceKm: 24.5,
    spaceId: 'jxhat1pcoilh66fs',
    roomId: 'pN0c5aCnqyjh3vt9',
    mapQuery: '水島ふれあいセンター',
    targetDivisionIds: ['5586', '5585'],
    targetDivisionNames: DIVISION_HALVES,
  }),
  spacepadVenue({
    id: 'mabi',
    shortName: '真備総合公園',
    fullName: '真備総合公園 体育館',
    distanceKm: 26.5,
    spaceId: 'mc6zt9acspmyus6x',
    roomId: 'igPHKy4Xxc0ObrXg',
    mapQuery: '真備総合公園体育館',
    targetDivisionIds: ['5580', '5581', '5582', '5583'],
    targetDivisionNames: DIVISION_QUARTERS,
  }),
  spacepadVenue({
    id: 'tamashima',
    shortName: '玉島の森',
    fullName: '玉島の森 体育館',
    distanceKm: 28.5,
    spaceId: 'heijieghle9vabwg',
    roomId: 'odnvSBwnd92CcKA3',
    mapQuery: '玉島の森体育館',
    targetDivisionIds: ['5566', '5567', '5568', '5569'],
    targetDivisionNames: DIVISION_QUARTERS,
  }),
  spacepadVenue({
    id: 'nakayama',
    shortName: '中山公園',
    fullName: '中山公園 体育館',
    distanceKm: 29.5,
    spaceId: '1dc9iimlst_agk6w',
    roomId: '8ZZqWJLzieJaRqKX',
    mapQuery: '児島中山公園体育館',
    targetDivisionIds: ['5538', '5539', '5540'],
    targetDivisionNames: DIVISION_THIRDS,
  }),
  yoyacoolVenue({
    id: 'nadasaki',
    shortName: '灘崎体育センター',
    fullName: '灘崎体育センター',
    courtType: 'indoor',
    hasLights: true,
    distanceKm: 18.5,
    facilityPath: '0028?rc=101&ptn=3&rc2w=101',
    mapQuery: '灘崎体育センター',
  }),
  yoyacoolVenue({
    id: 'futsukaichi',
    shortName: '二日市公園テニス',
    fullName: '二日市公園テニスコート（照明あり）',
    courtType: 'outdoor',
    hasLights: true,
    distanceKm: 3.3,
    facilityPath: '0005?rc=101&ptn=3&rc2w=101',
    mapQuery: '二日市公園テニスコート',
  }),
  yoyacoolVenue({
    id: 'yoshiigawa_1',
    shortName: '吉井川第1緑地',
    fullName: '吉井川第1緑地 テニスコート（〜17:00）',
    courtType: 'outdoor',
    hasLights: false,
    distanceKm: 11.5,
    facilityPath: '0014?ptn=3&rc2w=101',
    mapQuery: '吉井川第1緑地 テニスコート',
  }),
  yoyacoolVenue({
    id: 'hyakkengawa_a',
    shortName: '百間川緑地(A・東川原)',
    fullName: '百間川緑地 テニスコートA（東川原・ハードコート・〜17:00）',
    courtType: 'outdoor',
    hasLights: false,
    distanceKm: 3.2,
    facilityPath: '0022?ptn=3&rc2w=101',
    mapQuery: '百間川緑地 テニスコートA 東川原',
  }),
  yoyacoolVenue({
    id: 'hyakkengawa_c',
    shortName: '百間川緑地(C・神下)',
    fullName: '百間川緑地 テニスコートC（神下・ハードコート・〜17:00）',
    courtType: 'outdoor',
    hasLights: false,
    distanceKm: 5.2,
    facilityPath: '0022?ptn=3&rc=121&rc2w=121',
    mapQuery: '百間川緑地 テニスコートC 神下',
  }),
];

/**
 * Precomputed map of venue IDs (`court_detail`) to their configuration for O(1) lookup.
 *
 * @type {Map<string, VenueConfig>}
 */
export const VENUE_BY_ID = new Map(VENUES.map((venue) => [venue.id, venue]));