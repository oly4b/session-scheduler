/**
 * Single source of truth for all venues across the frontend and scrapers.
 * Each venue stores a single venue-level `status` ('open' | 'booked') per hour
 * in `court_availability` (keyed by `court_detail = venue.id`), plus `hasLights`
 * and `distanceKm` (from JR Okayama Station) for court recommendation ranking.
 */
export const VENUES = [
  // ── Kurashiki City (Spacepad) ─────────────────────────────────────────────
  {
    id: 'fukuda',
    shortName: '福田公園',
    fullName: 'シマダみらいアリーナ水島（福田公園）',
    area: 'kurashiki',
    source: 'spacepad',
    courtType: 'indoor',
    hasLights: true,
    distanceKm: 22.5,
    maxStartHour: 21,
    scraperUrl:
      'https://booking.spacepad.jp/provider/50833/spaces/itjbcjdbdle4-tgj/rooms/pxMub8xjITrSyqBW/reservations/new/?from=room_reservation_button&rent_type=1',
    bookingUrl:
      'https://booking.spacepad.jp/provider/50833/spaces/itjbcjdbdle4-tgj/rooms/pxMub8xjITrSyqBW',
    mapUrl: 'https://maps.app.goo.gl/XiqAWzqDudww3Z1aA',
    targetDivisionIds: ['5558', '5559', '5560'],
    targetDivisionNames: ['1/3面(1)', '1/3面(2)', '1/3面(3)'],
  },
  {
    id: 'mizushima',
    shortName: '水島体育館',
    fullName: '水島体育館',
    area: 'kurashiki',
    source: 'spacepad',
    courtType: 'indoor',
    hasLights: true,
    distanceKm: 24.0,
    maxStartHour: 21,
    scraperUrl:
      'https://booking.spacepad.jp/provider/50833/spaces/w2xrdrqqmbh-yo2u/rooms/vo_5DKw8ofQonMDL/reservations/new/?from=room_reservation_button&rent_type=1',
    bookingUrl:
      'https://booking.spacepad.jp/provider/50833/spaces/w2xrdrqqmbh-yo2u/rooms/vo_5DKw8ofQonMDL',
    mapUrl: 'https://maps.app.goo.gl/oFoRMkbfNLMs7eHM9',
    targetDivisionIds: ['5506', '5570', '5571', '5572'],
    targetDivisionNames: ['1/4面(1)', '1/4面(2)', '1/4面(3)', '1/4面(4)'],
  },
  {
    id: 'kurashiki_gym',
    shortName: '倉敷体育館',
    fullName: '倉敷体育館',
    area: 'kurashiki',
    source: 'spacepad',
    courtType: 'indoor',
    hasLights: true,
    distanceKm: 16.5,
    maxStartHour: 21,
    scraperUrl:
      'https://booking.spacepad.jp/provider/50833/spaces/zywnbw47bh5crzg7/rooms/Wxn8mEfeUxzf2yA-/reservations/new/?from=room_reservation_button&rent_type=1',
    bookingUrl:
      'https://booking.spacepad.jp/provider/50833/spaces/zywnbw47bh5crzg7/rooms/Wxn8mEfeUxzf2yA-',
    mapUrl:
      'https://www.google.com/maps/search/?api=1&query=%E5%80%89%E6%95%B7%E4%BD%93%E8%82%B2%E9%A4%A8',
    targetDivisionIds: ['5552', '5553', '5554'],
    targetDivisionNames: ['1/3面(1)', '1/3面(2)', '1/3面(3)'],
  },
  {
    id: 'kurashiki_weightlifting',
    shortName: '倉敷運動公園WL場',
    fullName: '倉敷運動公園 ウエイトリフティング場',
    area: 'kurashiki',
    source: 'spacepad',
    courtType: 'indoor',
    hasLights: true,
    distanceKm: 17.5,
    maxStartHour: 21,
    scraperUrl:
      'https://booking.spacepad.jp/provider/50833/spaces/tcccb8_exn7v_vhn/rooms/EhSlCG1XIyCAUmOC/reservations/new/?from=room_reservation_button&rent_type=1',
    bookingUrl:
      'https://booking.spacepad.jp/provider/50833/spaces/tcccb8_exn7v_vhn/rooms/EhSlCG1XIyCAUmOC',
    mapUrl:
      'https://www.google.com/maps/search/?api=1&query=%E5%80%89%E6%95%B7%E9%81%8B%E5%8B%95%E5%85%AC%E5%9C%92%E3%82%A6%E3%82%A8%E3%82%A4%E3%83%88%E3%83%AA%E3%83%95%E3%83%86%E3%82%A3%E3%83%B3%E3%82%B0%E5%A0%B4',
    allowAnyDivision: true,
    targetDivisionIds: [],
    targetDivisionNames: [],
  },
  {
    id: 'mizushima_fureai',
    shortName: '水島ふれあいセンター',
    fullName: '水島ふれあいセンター 体育館',
    area: 'kurashiki',
    source: 'spacepad',
    courtType: 'indoor',
    hasLights: true,
    distanceKm: 24.5,
    maxStartHour: 21,
    scraperUrl:
      'https://booking.spacepad.jp/provider/50833/spaces/jxhat1pcoilh66fs/rooms/pN0c5aCnqyjh3vt9/reservations/new/?from=room_reservation_button&rent_type=1',
    bookingUrl:
      'https://booking.spacepad.jp/provider/50833/spaces/jxhat1pcoilh66fs/rooms/pN0c5aCnqyjh3vt9',
    mapUrl:
      'https://www.google.com/maps/search/?api=1&query=%E6%B0%B4%E5%B3%B6%E3%81%B5%E3%82%8C%E3%81%82%E3%81%84%E3%82%BB%E3%83%B3%E3%82%BF%E3%83%BC',
    targetDivisionIds: ['5586', '5585'],
    targetDivisionNames: ['半面(A面)', '半面(B面)'],
  },
  {
    id: 'mabi',
    shortName: '真備総合公園',
    fullName: '真備総合公園 体育館',
    area: 'kurashiki',
    source: 'spacepad',
    courtType: 'indoor',
    hasLights: true,
    distanceKm: 26.5,
    maxStartHour: 21,
    scraperUrl:
      'https://booking.spacepad.jp/provider/50833/spaces/mc6zt9acspmyus6x/rooms/igPHKy4Xxc0ObrXg/reservations/new/?from=room_reservation_button&rent_type=1',
    bookingUrl:
      'https://booking.spacepad.jp/provider/50833/spaces/mc6zt9acspmyus6x/rooms/igPHKy4Xxc0ObrXg',
    mapUrl:
      'https://www.google.com/maps/search/?api=1&query=%E7%9C%9F%E5%82%99%E7%B7%8F%E5%90%88%E5%85%AC%E5%9C%92%E4%BD%93%E8%82%B2%E9%A4%A8',
    targetDivisionIds: ['5580', '5581', '5582', '5583'],
    targetDivisionNames: ['1/4面(1)', '1/4面(2)', '1/4面(3)', '1/4面(4)'],
  },
  {
    id: 'tamashima',
    shortName: '玉島の森',
    fullName: '玉島の森 体育館',
    area: 'kurashiki',
    source: 'spacepad',
    courtType: 'indoor',
    hasLights: true,
    distanceKm: 28.5,
    maxStartHour: 21,
    scraperUrl:
      'https://booking.spacepad.jp/provider/50833/spaces/heijieghle9vabwg/rooms/odnvSBwnd92CcKA3/reservations/new/?from=room_reservation_button&rent_type=1',
    bookingUrl:
      'https://booking.spacepad.jp/provider/50833/spaces/heijieghle9vabwg/rooms/odnvSBwnd92CcKA3',
    mapUrl:
      'https://www.google.com/maps/search/?api=1&query=%E7%8E%89%E5%B3%B6%E3%81%AE%E6%A3%AE%E4%BD%93%E8%82%B2%E9%A4%A8',
    targetDivisionIds: ['5566', '5567', '5568', '5569'],
    targetDivisionNames: ['1/4面(1)', '1/4面(2)', '1/4面(3)', '1/4面(4)'],
  },
  {
    id: 'nakayama',
    shortName: '中山公園',
    fullName: '中山公園 体育館',
    area: 'kurashiki',
    source: 'spacepad',
    courtType: 'indoor',
    hasLights: true,
    distanceKm: 29.5,
    maxStartHour: 21,
    scraperUrl:
      'https://booking.spacepad.jp/provider/50833/spaces/1dc9iimlst_agk6w/rooms/8ZZqWJLzieJaRqKX/reservations/new/?from=room_reservation_button&rent_type=1',
    bookingUrl:
      'https://booking.spacepad.jp/provider/50833/spaces/1dc9iimlst_agk6w/rooms/8ZZqWJLzieJaRqKX',
    mapUrl:
      'https://www.google.com/maps/search/?api=1&query=%E5%85%90%E5%B3%B6%E4%B8%AD%E5%B1%B1%E5%85%AC%E5%9C%92%E4%BD%93%E8%82%B2%E9%A4%A8',
    targetDivisionIds: ['5538', '5539', '5540'],
    targetDivisionNames: ['1/3面(1)', '1/3面(2)', '1/3面(3)'],
  },

  // ── Okayama City (yoyacool) ───────────────────────────────────────────────
  {
    id: 'nadasaki',
    shortName: '灘崎体育センター',
    fullName: '灘崎体育センター',
    area: 'okayama',
    source: 'yoyacool',
    courtType: 'indoor',
    hasLights: true,
    distanceKm: 18.5,
    maxStartHour: 21,
    scraperUrl:
      'https://yoyacool.e-harp.jp/okayamacity/FacilityAvailability/Index/331007/0028?rc=101&ptn=3&rc2w=101',
    bookingUrl:
      'https://yoyacool.e-harp.jp/okayamacity/FacilityAvailability/Index/331007/0028?rc=101&ptn=3&rc2w=101',
    mapUrl:
      'https://www.google.com/maps/search/?api=1&query=%E7%81%98%E5%B4%8E%E4%BD%93%E8%82%B2%E3%82%BB%E3%83%B3%E3%82%BF%E3%83%BC',
  },
  {
    id: 'futsukaichi',
    shortName: '二日市公園テニス',
    fullName: '二日市公園テニスコート（照明あり）',
    area: 'okayama',
    source: 'yoyacool',
    courtType: 'outdoor',
    hasLights: true,
    distanceKm: 3.3,
    maxStartHour: 21,
    scraperUrl:
      'https://yoyacool.e-harp.jp/okayamacity/FacilityAvailability/Index/331007/0005?rc=101&ptn=3&rc2w=101',
    bookingUrl:
      'https://yoyacool.e-harp.jp/okayamacity/FacilityAvailability/Index/331007/0005?rc=101&ptn=3&rc2w=101',
    mapUrl:
      'https://www.google.com/maps/search/?api=1&query=%E4%BA%8C%E6%97%A5%E5%B8%82%E5%85%AC%E5%9C%92%E3%83%86%E3%83%8B%E3%82%B9%E3%82%B3%E3%83%BC%E3%83%88',
  },
  {
    id: 'yoshiigawa_1',
    shortName: '吉井川第1緑地',
    fullName: '吉井川第1緑地 テニスコート（〜17:00）',
    area: 'okayama',
    source: 'yoyacool',
    courtType: 'outdoor',
    hasLights: false,
    distanceKm: 11.5,
    maxStartHour: 16,
    scraperUrl:
      'https://yoyacool.e-harp.jp/okayamacity/FacilityAvailability/Index/331007/0014?ptn=3&rc2w=101',
    bookingUrl:
      'https://yoyacool.e-harp.jp/okayamacity/FacilityAvailability/Index/331007/0014?ptn=3&rc2w=101',
    mapUrl:
      'https://www.google.com/maps/search/?api=1&query=%E5%90%89%E4%BA%95%E5%B7%9D%E7%AC%AC1%E7%B7%91%E5%9C%B0+%E3%83%86%E3%83%8B%E3%82%B9%E3%82%B3%E3%83%BC%E3%83%88',
  },
  {
    id: 'hyakkengawa_a',
    shortName: '百間川緑地(A・東川原)',
    fullName: '百間川緑地 テニスコートA（東川原・ハードコート・〜17:00）',
    area: 'okayama',
    source: 'yoyacool',
    courtType: 'outdoor',
    hasLights: false,
    distanceKm: 3.2,
    maxStartHour: 16,
    scraperUrl:
      'https://yoyacool.e-harp.jp/okayamacity/FacilityAvailability/Index/331007/0022?ptn=3&rc2w=101',
    bookingUrl:
      'https://yoyacool.e-harp.jp/okayamacity/FacilityAvailability/Index/331007/0022?ptn=3&rc2w=101',
    mapUrl:
      'https://www.google.com/maps/search/?api=1&query=%E7%99%BE%E9%96%93%E5%B7%9D%E7%B7%91%E5%9C%B0+%E3%83%86%E3%83%8B%E3%82%B9%E3%82%B3%E3%83%BC%E3%83%88A+%E6%9D%B1%E5%B7%9D%E5%8E%9F',
  },
  {
    id: 'hyakkengawa_c',
    shortName: '百間川緑地(C・神下)',
    fullName: '百間川緑地 テニスコートC（神下・ハードコート・〜17:00）',
    area: 'okayama',
    source: 'yoyacool',
    courtType: 'outdoor',
    hasLights: false,
    distanceKm: 5.2,
    maxStartHour: 16,
    scraperUrl:
      'https://yoyacool.e-harp.jp/okayamacity/FacilityAvailability/Index/331007/0022?ptn=3&rc=121&rc2w=121',
    bookingUrl:
      'https://yoyacool.e-harp.jp/okayamacity/FacilityAvailability/Index/331007/0022?ptn=3&rc=121&rc2w=121',
    mapUrl:
      'https://www.google.com/maps/search/?api=1&query=%E7%99%BE%E9%96%93%E5%B7%9D%E7%B7%91%E5%9C%B0+%E3%83%86%E3%83%8B%E3%82%B9%E3%82%B3%E3%83%BC%E3%83%88C+%E7%A5%9E%E4%B8%8B',
  },
];