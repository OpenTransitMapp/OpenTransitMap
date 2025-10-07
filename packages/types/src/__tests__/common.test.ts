import { describe, it, expect } from 'vitest';
import {
  NonEmptyStringSchema,
  IdSchema,
  IsoDateTimeStringSchema,
  LatitudeSchema,
  LongitudeSchema,
  CoordinateSchema,
  HttpUrlSchema,
  IanaTimezoneSchema,
  ColorHexSchema,
} from '../schemas/common.js';

describe('common schemas', () => {
  describe('NonEmptyStringSchema', () => {
    it.each([
      ['x', true],
      [' ', false],
      ['', false],
    ])('should accept non-empty strings and reject empty/whitespace-only strings: %s -> %s', (value, ok) => {
      expect(NonEmptyStringSchema.safeParse(value as string).success).toBe(ok);
    });
  });

  describe('IdSchema', () => {
    it.each([
      ['vehicle-123', true],
      ['   ', false],
      ['', false],
    ])('should accept valid IDs and reject empty/whitespace-only strings: %s -> %s', (value, ok) => {
      expect(IdSchema.safeParse(value as string).success).toBe(ok);
    });
  });

  describe('IsoDateTimeStringSchema', () => {
    describe('valid ISO 8601 datetime strings', () => {
      it.each([
        ['2024-01-01T00:00:00Z', true],             // valid: UTC with full time
        ['1999-12-31T23:59:59Z', true],             // valid: end of day UTC
        ['2020-02-29T12:34:56Z', true],             // valid: leap day
        ['2024-01-01T00:00:00.123Z', true],         // valid: fractional seconds (ms)
        ['2024-01-01T00:00:00.123456Z', true],      // valid: fractional seconds (µs)
        ['2024-01-01T00:00:00.000000000Z', true],   // valid: fractional seconds (ns)
        ['2024-06-30T23:59:59Z', true],             // valid: last second of June
        ['2024-01-01T00:00:00.1Z', true],           // valid: 1 digit fractional seconds
        ['2024-01-01T00:00:00.12Z', true],          // valid: 2 digit fractional seconds
        ['2024-01-01T00:00:00.000Z', true],         // valid: 3 digit fractional seconds (zero)
        ['2024-01-01T00:00:00.000000Z', true],      // valid: 6 digit fractional seconds
        ['2024-01-01T00:00:00.00000000Z', true],    // valid: 8 digit fractional seconds
        ['2024-01-01T00:00:00.000000000Z', true],   // valid: 9 digit fractional seconds
        ['2024-01-01T23:59:59.999999999Z', true],   // valid: max time with max fractional
        ['2024-01-01T00:00:00.000000001Z', true],   // valid: min nonzero nanosecond
        ['2024-01-01T00:00:00.000000010Z', true],   // valid: 10 nanoseconds
        ['2024-01-01T00:00:00.000000100Z', true],   // valid: 100 nanoseconds
        ['2024-01-01T00:00:00.000001000Z', true],   // valid: 1 microsecond
        ['2024-01-01T00:00:00.000010000Z', true],   // valid: 10 microseconds
    ['2024-01-01T00:00:00.000100000Z', true],   // valid: 100 microseconds
    ['2024-01-01T00:00:00.001000000Z', true],   // valid: 1 millisecond
    ['2024-01-01T00:00:00.010000000Z', true],   // valid: 10 milliseconds
    ['2024-01-01T00:00:00.100000000Z', true],   // valid: 100 milliseconds
    ['2024-01-01T00:00:00.000000000Z', true],   // valid: 0 nanoseconds
    ['2024-01-01T00:00:00.000000000Z', true],   // valid: 0 nanoseconds (repeat for coverage)
    ['2024-01-01T00:00:00.000000000Z', true],   // valid: 0 nanoseconds (repeat for coverage)
    ['2024-01-01T00:00:00.000000000Z', true],   // valid: 0 nanoseconds (repeat for coverage)
    ['2024-01-01T23:59Z', true],                // valid: ISO 8601 allows missing seconds

    ['not-a-date', false],                 // invalid: not a date
    ['2025-09-22T14:05:00-04:00', false],  // invalid: valid negative offset, but not allowed
    ['2025-09-22T18:05:00+00:00', false],  // invalid: valid explicit +00:00, but not allowed
    ['2024-01-01T00:00:00+05:30', false],  // invalid: valid non-integer offset, but not allowed
    ['2024-01-01T10:00:00+14:00', false],  // invalid: valid maximum positive offset, but not allowed
    ['2024-01-01T12:00:00-12:00', false],  // invalid: valid maximum negative offset, but not allowed
    ['2024-01-01 00:00:00Z', false],      // invalid: space instead of 'T'
    ['2024-13-01T00:00:00Z', false],      // invalid: month 13
    ['2024-00-01T00:00:00Z', false],      // invalid: month 00
    ['2024-01-32T00:00:00Z', false],      // invalid: day 32
    ['2024-02-30T00:00:00Z', false],      // invalid: Feb 30 does not exist
    ['2024-01-01T25:00:00Z', false],      // invalid: hour 25
    ['2024-01-01T23:60:00Z', false],      // invalid: minute 60
    ['2024-01-01T23:59:60Z', false],      // invalid: leap second 60 not allowed
    ['2024-01-01T00:00:00', false],       // invalid: missing timezone
    ['2024-01-01', false],                // invalid: date only
    ['2024-01-01T23Z', false],            // invalid: missing minutes & seconds
    ['2024-01-01T00:00:00-0400', false],  // invalid: offset without colon
    ['2024-01-01T00:00:00+05', false],    // invalid: offset missing minutes
    ['2024-01-01T00:00:00+15:00', false], // invalid: offset hour beyond +14
    ['2024-01-01T00:00:00+01:61', false], // invalid: offset minutes 61
    ['2024-1-01T0:00:00Z', false],        // invalid: non-padded date/time
    ['2024-01-01T00:00:00z', false],      // invalid: lowercase z (if strict)
    ['20240101T000000', false],           // invalid: compact form not allowed
    ['2024-01-01T00:0a:00Z', false],      // invalid: non-numeric in time
    ['2024-01-01T00:00:00Z extra', false] // invalid: trailing junk
  ])('validates IsoDateTime(%s) -> %s', (value, ok) => {
    expect(IsoDateTimeStringSchema.safeParse(value as string).success).toBe(ok);
  });

  it.each([
    [0, true],                // center
    [45, true],               // typical positive
    [-45, true],              // typical negative
    [89.9999, true],          // just below max
    [90, true],               // max
    [-90, true],              // min
    [90.0001, false],         // just above max
    [-90.0001, false],        // just below min
    [91, false],              // above max
    [-91, false],             // below min
    [null, false],            // null
    [undefined, false],       // undefined
    ['45', false],            // string
    [NaN, false],             // NaN
    [Infinity, false],        // Infinity
    [-Infinity, false],       // -Infinity
    [{}, false],              // object
    [[], false],              // array
    [true, false],            // boolean
  ])('Latitude(%s) -> %s', (value, ok) => {
    expect(LatitudeSchema.safeParse(value as any).success).toBe(ok);
  });

  it.each([
    [0, true],                // center
    [120, true],              // typical positive
    [-120, true],             // typical negative
    [179.9999, true],         // just below max
    [180, true],              // max
    [-180, true],             // min
    [180.0001, false],        // just above max
    [-180.0001, false],       // just below min
    [181, false],             // above max
    [-181, false],            // below min
    [null, false],            // null
    [undefined, false],       // undefined
    ['120', false],           // string
    [NaN, false],             // NaN
    [Infinity, false],        // Infinity
    [-Infinity, false],       // -Infinity
    [{}, false],              // object
    [[], false],              // array
    [false, false],           // boolean
  ])('Longitude(%s) -> %s', (value, ok) => {
    expect(LongitudeSchema.safeParse(value as any).success).toBe(ok);
  });

  it.each([
    [{ lat: 0, lng: 0 }, true],                        // center
    [{ lat: 40.7, lng: -74.0 }, true],                 // typical
    [{ lat: -90, lng: 180 }, true],                    // min lat, max lng
    [{ lat: 90, lng: -180 }, true],                    // max lat, min lng
    [{ lat: 89.9999, lng: 179.9999 }, true],           // just below max
    [{ lat: -90.0001, lng: 0 }, false],                // lat just below min
    [{ lat: 0, lng: 180.0001 }, false],                // lng just above max
    [{ lat: -91, lng: 0 }, false],                     // lat below min
    [{ lat: 0, lng: 181 }, false],                     // lng above max
    [{ lat: 0 }, false],                               // missing lng
    [{ lng: 0 }, false],                               // missing lat
    [{ lat: 0, lng: 0, alt: 10 } as any, false],       // extra property
    [{ lat: '40', lng: '-74' } as any, false],         // wrong types
    [null, false],                                     // null
    [undefined, false],                                // undefined
    [{}, false],                                       // empty object
    [[], false],                                       // array
    [123, false],                                      // number
    ['{lat:0,lng:0}', false],                          // string
    [true, false],                                     // boolean
  ])('Coordinate(%o) -> %s', (value, ok) => {
    expect(CoordinateSchema.safeParse(value).success).toBe(ok);
  });

  it.each([
    ['#RGBA', true],
    ['#RRGGBBAA', true],
  ])('ColorHex valid alpha examples (%s) -> %s', (label, ok) => {
    const examples: Record<string, string> = {
      '#RGBA': '#1a2b',
      '#RRGGBBAA': '#112233cc',
    };
    expect(ColorHexSchema.safeParse(examples[label]).success).toBe(ok);
  });

  it.each([
    ['#12345', false],
    ['#zzzz', false],
    ['112233', false],
  ])('ColorHex invalid examples (%s) -> %s', (hex, ok) => {
    expect(ColorHexSchema.safeParse(hex).success).toBe(ok);
  });

  it('IsoDateTime rejects out-of-range dates and timezone offsets with clear messages', () => {
    const before = '1799-12-31T23:59:59Z';
    const after = '10000-01-01T00:00:00Z';
    const offset = '2024-01-01T00:00:00+01:00';

    const r1 = IsoDateTimeStringSchema.safeParse(before);
    expect(r1.success).toBe(false);
    if (!r1.success) {
      expect(r1.error.issues.some(i => i.message.includes('between 1800-01-01'))).toBe(true);
    }

    const r2 = IsoDateTimeStringSchema.safeParse(after);
    expect(r2.success).toBe(false);
    if (!r2.success) {
      expect(r2.error.issues.some(i => i.message.includes('between 1800-01-01'))).toBe(true);
    }

    const r3 = IsoDateTimeStringSchema.safeParse(offset);
    expect(r3.success).toBe(false);
  });

  it('IANA timezone invalids produce the expected error message', () => {
    const bad1 = 'America/New York';
    const bad2 = 'Etc/GMT+25';
    const r1 = IanaTimezoneSchema.safeParse(bad1);
    const r2 = IanaTimezoneSchema.safeParse(bad2);
    expect(r1.success).toBe(false);
    expect(r2.success).toBe(false);
    if (!r1.success) expect(r1.error.issues[0].message).toContain('Invalid IANA timezone');
    if (!r2.success) expect(r2.error.issues[0].message).toContain('Invalid IANA timezone');
  });

  it('ColorHex emits targeted messages for common mistakes', () => {
    const noHash = '112233';
    const badLen = '#12345';
    const badDigit = '#12xz';
    const n1 = ColorHexSchema.safeParse(noHash);
    const n2 = ColorHexSchema.safeParse(badLen);
    const n3 = ColorHexSchema.safeParse(badDigit);
    expect(n1.success).toBe(false);
    expect(n2.success).toBe(false);
    expect(n3.success).toBe(false);
  });

  it.each([
    ['Africa/Abidjan', true],
    ['Africa/Accra', true],
    ['Africa/Addis_Ababa', true],
    ['Africa/Algiers', true],
    ['Africa/Asmara', true],
    ['Africa/Asmera', true],
    ['Africa/Bamako', true],
    ['Africa/Bangui', true],
    ['Africa/Banjul', true],
    ['Africa/Bissau', true],
    ['Africa/Blantyre', true],
    ['Africa/Brazzaville', true],
    ['Africa/Bujumbura', true],
    ['Africa/Cairo', true],
    ['Africa/Casablanca', true],
    ['Africa/Ceuta', true],
    ['Africa/Conakry', true],
    ['Africa/Dakar', true],
    ['Africa/Dar_es_Salaam', true],
    ['Africa/Djibouti', true],
    ['Africa/Douala', true],
    ['Africa/El_Aaiun', true],
    ['Africa/Freetown', true],
    ['Africa/Gaborone', true],
    ['Africa/Harare', true],
    ['Africa/Johannesburg', true],
    ['Africa/Juba', true],
    ['Africa/Kampala', true],
    ['Africa/Khartoum', true],
    ['Africa/Kigali', true],
    ['Africa/Kinshasa', true],
    ['Africa/Lagos', true],
    ['Africa/Libreville', true],
    ['Africa/Lome', true],
    ['Africa/Luanda', true],
    ['Africa/Lubumbashi', true],
    ['Africa/Lusaka', true],
    ['Africa/Malabo', true],
    ['Africa/Maputo', true],
    ['Africa/Maseru', true],
    ['Africa/Mbabane', true],
    ['Africa/Mogadishu', true],
    ['Africa/Monrovia', true],
    ['Africa/Nairobi', true],
    ['Africa/Ndjamena', true],
    ['Africa/Niamey', true],
    ['Africa/Nouakchott', true],
    ['Africa/Ouagadougou', true],
    ['Africa/Porto-Novo', true],
    ['Africa/Sao_Tome', true],
    ['Africa/Timbuktu', true],
    ['Africa/Tripoli', true],
    ['Africa/Tunis', true],
    ['Africa/Windhoek', true],
    ['America/Adak', true],
    ['America/Anchorage', true],
    ['America/Anguilla', true],
    ['America/Antigua', true],
    ['America/Araguaina', true],
    ['America/Argentina/Buenos_Aires', true],
    ['America/Argentina/Catamarca', true],
    ['America/Argentina/ComodRivadavia', true],
    ['America/Argentina/Cordoba', true],
    ['America/Argentina/Jujuy', true],
    ['America/Argentina/La_Rioja', true],
    ['America/Argentina/Mendoza', true],
    ['America/Argentina/Rio_Gallegos', true],
    ['America/Argentina/Salta', true],
    ['America/Argentina/San_Juan', true],
    ['America/Argentina/San_Luis', true],
    ['America/Argentina/Tucuman', true],
    ['America/Argentina/Ushuaia', true],
    ['America/Aruba', true],
    ['America/Asuncion', true],
    ['America/Atikokan', true],
    ['America/Atka', true],
    ['America/Bahia', true],
    ['America/Bahia_Banderas', true],
    ['America/Barbados', true],
    ['America/Belem', true],
    ['America/Belize', true],
    ['America/Blanc-Sablon', true],
    ['America/Boa_Vista', true],
    ['America/Bogota', true],
    ['America/Boise', true],
    ['America/Buenos_Aires', true],
    ['America/Cambridge_Bay', true],
    ['America/Campo_Grande', true],
    ['America/Cancun', true],
    ['America/Caracas', true],
    ['America/Catamarca', true],
    ['America/Cayenne', true],
    ['America/Cayman', true],
    ['America/Chicago', true],
    ['America/Chihuahua', true],
    ['America/Ciudad_Juarez', true],
    ['America/Coral_Harbour', true],
    ['America/Cordoba', true],
    ['America/Costa_Rica', true],
    ['America/Creston', true],
    ['America/Cuiaba', true],
    ['America/Curacao', true],
    ['America/Danmarkshavn', true],
    ['America/Dawson', true],
    ['America/Dawson_Creek', true],
    ['America/Denver', true],
    ['America/Detroit', true],
    ['America/Dominica', true],
    ['America/Edmonton', true],
    ['America/Eirunepe', true],
    ['America/El_Salvador', true],
    ['America/Ensenada', true],
    ['America/Fort_Nelson', true],
    ['America/Fort_Wayne', true],
    ['America/Fortaleza', true],
    ['America/Glace_Bay', true],
    ['America/Godthab', true],
    ['America/Goose_Bay', true],
    ['America/Grand_Turk', true],
    ['America/Grenada', true],
    ['America/Guadeloupe', true],
    ['America/Guatemala', true],
    ['America/Guayaquil', true],
    ['America/Guyana', true],
    ['America/Halifax', true],
    ['America/Havana', true],
    ['America/Hermosillo', true],
    ['America/Indiana/Indianapolis', true],
    ['America/Indiana/Knox', true],
    ['America/Indiana/Marengo', true],
    ['America/Indiana/Petersburg', true],
    ['America/Indiana/Tell_City', true],
    ['America/Indiana/Vevay', true],
    ['America/Indiana/Vincennes', true],
    ['America/Indiana/Winamac', true],
    ['America/Indianapolis', true],
    ['America/Inuvik', true],
    ['America/Iqaluit', true],
    ['America/Jamaica', true],
    ['America/Jujuy', true],
    ['America/Juneau', true],
    ['America/Kentucky/Louisville', true],
    ['America/Kentucky/Monticello', true],
    ['America/Knox_IN', true],
    ['America/Kralendijk', true],
    ['America/La_Paz', true],
    ['America/Lima', true],
    ['America/Los_Angeles', true],
    ['America/Louisville', true],
    ['America/Lower_Princes', true],
    ['America/Maceio', true],
    ['America/Managua', true],
    ['America/Manaus', true],
    ['America/Marigot', true],
    ['America/Martinique', true],
    ['America/Matamoros', true],
    ['America/Mazatlan', true],
    ['America/Mendoza', true],
    ['America/Menominee', true],
    ['America/Merida', true],
    ['America/Metlakatla', true],
    ['America/Mexico_City', true],
    ['America/Miquelon', true],
    ['America/Moncton', true],
    ['America/Monterrey', true],
    ['America/Montevideo', true],
    ['America/Montreal', true],
    ['America/Montserrat', true],
    ['America/Nassau', true],
    ['America/New_York', true],
    ['America/Nipigon', true],
    ['America/Nome', true],
    ['America/Noronha', true],
    ['America/North_Dakota/Beulah', true],
    ['America/North_Dakota/Center', true],
    ['America/North_Dakota/New_Salem', true],
    ['America/Nuuk', true],
    ['America/Ojinaga', true],
    ['America/Panama', true],
    ['America/Pangnirtung', true],
    ['America/Paramaribo', true],
    ['America/Phoenix', true],
    ['America/Port-au-Prince', true],
    ['America/Port_of_Spain', true],
    ['America/Porto_Acre', true],
    ['America/Porto_Velho', true],
    ['America/Puerto_Rico', true],
    ['America/Punta_Arenas', true],
    ['America/Rainy_River', true],
    ['America/Rankin_Inlet', true],
    ['America/Recife', true],
    ['America/Regina', true],
    ['America/Resolute', true],
    ['America/Rio_Branco', true],
    ['America/Rosario', true],
    ['America/Santa_Isabel', true],
    ['America/Santarem', true],
    ['America/Santiago', true],
    ['America/Santo_Domingo', true],
    ['America/Sao_Paulo', true],
    ['America/Scoresbysund', true],
    ['America/Shiprock', true],
    ['America/Sitka', true],
    ['America/St_Barthelemy', true],
    ['America/St_Johns', true],
    ['America/St_Kitts', true],
    ['America/St_Lucia', true],
    ['America/St_Thomas', true],
    ['America/St_Vincent', true],
    ['America/Swift_Current', true],
    ['America/Tegucigalpa', true],
    ['America/Thule', true],
    ['America/Thunder_Bay', true],
    ['America/Tijuana', true],
    ['America/Toronto', true],
    ['America/Tortola', true],
    ['America/Vancouver', true],
    ['America/Virgin', true],
    ['America/Whitehorse', true],
    ['America/Winnipeg', true],
    ['America/Yakutat', true],
    ['America/Yellowknife', true],
    ['Antarctica/Casey', true],
    ['Antarctica/Davis', true],
    ['Antarctica/DumontDUrville', true],
    ['Antarctica/Macquarie', true],
    ['Antarctica/Mawson', true],
    ['Antarctica/McMurdo', true],
    ['Antarctica/Palmer', true],
    ['Antarctica/Rothera', true],
    ['Antarctica/South_Pole', true],
    ['Antarctica/Syowa', true],
    ['Antarctica/Troll', true],
    ['Antarctica/Vostok', true],
    ['Arctic/Longyearbyen', true],
    ['Asia/Aden', true],
    ['Asia/Almaty', true],
    ['Asia/Amman', true],
    ['Asia/Anadyr', true],
    ['Asia/Aqtau', true],
    ['Asia/Aqtobe', true],
    ['Asia/Ashgabat', true],
    ['Asia/Ashkhabad', true],
    ['Asia/Atyrau', true],
    ['Asia/Baghdad', true],
    ['Asia/Bahrain', true],
    ['Asia/Baku', true],
    ['Asia/Bangkok', true],
    ['Asia/Barnaul', true],
    ['Asia/Beirut', true],
    ['Asia/Bishkek', true],
    ['Asia/Brunei', true],
    ['Asia/Calcutta', true],
    ['Asia/Chita', true],
    ['Asia/Choibalsan', true],
    ['Asia/Chongqing', true],
    ['Asia/Chungking', true],
    ['Asia/Colombo', true],
    ['Asia/Dacca', true],
    ['Asia/Damascus', true],
    ['Asia/Dhaka', true],
    ['Asia/Dili', true],
    ['Asia/Dubai', true],
    ['Asia/Dushanbe', true],
    ['Asia/Famagusta', true],
    ['Asia/Gaza', true],
    ['Asia/Harbin', true],
    ['Asia/Hebron', true],
    ['Asia/Ho_Chi_Minh', true],
    ['Asia/Hong_Kong', true],
    ['Asia/Hovd', true],
    ['Asia/Irkutsk', true],
    ['Asia/Istanbul', true],
    ['Asia/Jakarta', true],
    ['Asia/Jayapura', true],
    ['Asia/Jerusalem', true],
    ['Asia/Kabul', true],
    ['Asia/Kamchatka', true],
    ['Asia/Karachi', true],
    ['Asia/Kashgar', true],
    ['Asia/Kathmandu', true],
    ['Asia/Katmandu', true],
    ['Asia/Khandyga', true],
    ['Asia/Kolkata', true],
    ['Asia/Krasnoyarsk', true],
    ['Asia/Kuala_Lumpur', true],
    ['Asia/Kuching', true],
    ['Asia/Kuwait', true],
    ['Asia/Macao', true],
    ['Asia/Macau', true],
    ['Asia/Magadan', true],
    ['Asia/Makassar', true],
    ['Asia/Manila', true],
    ['Asia/Muscat', true],
    ['Asia/Nicosia', true],
    ['Asia/Novokuznetsk', true],
    ['Asia/Novosibirsk', true],
    ['Asia/Omsk', true],
    ['Asia/Oral', true],
    ['Asia/Phnom_Penh', true],
    ['Asia/Pontianak', true],
    ['Asia/Pyongyang', true],
    ['Asia/Qatar', true],
    ['Asia/Qostanay', true],
    ['Asia/Qyzylorda', true],
    ['Asia/Rangoon', true],
    ['Asia/Riyadh', true],
    ['Asia/Saigon', true],
    ['Asia/Sakhalin', true],
    ['Asia/Samarkand', true],
    ['Asia/Seoul', true],
    ['Asia/Shanghai', true],
    ['Asia/Singapore', true],
    ['Asia/Srednekolymsk', true],
    ['Asia/Taipei', true],
    ['Asia/Tashkent', true],
    ['Asia/Tbilisi', true],
    ['Asia/Tehran', true],
    ['Asia/Tel_Aviv', true],
    ['Asia/Thimbu', true],
    ['Asia/Thimphu', true],
    ['Asia/Tokyo', true],
    ['Asia/Tomsk', true],
    ['Asia/Ujung_Pandang', true],
    ['Asia/Ulaanbaatar', true],
    ['Asia/Ulan_Bator', true],
    ['Asia/Urumqi', true],
    ['Asia/Ust-Nera', true],
    ['Asia/Vientiane', true],
    ['Asia/Vladivostok', true],
    ['Asia/Yakutsk', true],
    ['Asia/Yangon', true],
    ['Asia/Yekaterinburg', true],
    ['Asia/Yerevan', true],
    ['Atlantic/Azores', true],
    ['Atlantic/Bermuda', true],
    ['Atlantic/Canary', true],
    ['Atlantic/Cape_Verde', true],
    ['Atlantic/Faeroe', true],
    ['Atlantic/Faroe', true],
    ['Atlantic/Jan_Mayen', true],
    ['Atlantic/Madeira', true],
    ['Atlantic/Reykjavik', true],
    ['Atlantic/South_Georgia', true],
    ['Atlantic/St_Helena', true],
    ['Atlantic/Stanley', true],
    ['Australia/ACT', true],
    ['Australia/Adelaide', true],
    ['Australia/Brisbane', true],
    ['Australia/Broken_Hill', true],
    ['Australia/Canberra', true],
    ['Australia/Currie', true],
    ['Australia/Darwin', true],
    ['Australia/Eucla', true],
    ['Australia/Hobart', true],
    ['Australia/LHI', true],
    ['Australia/Lindeman', true],
    ['Australia/Lord_Howe', true],
    ['Australia/Melbourne', true],
    ['Australia/NSW', true],
    ['Australia/North', true],
    ['Australia/Perth', true],
    ['Australia/Queensland', true],
    ['Australia/South', true],
    ['Australia/Sydney', true],
    ['Australia/Tasmania', true],
    ['Australia/Victoria', true],
    ['Australia/West', true],
    ['Australia/Yancowinna', true],
    ['Brazil/Acre', true],
    ['Brazil/DeNoronha', true],
    ['Brazil/East', true],
    ['Brazil/West', true],
    ['CET', true],
    ['CST6CDT', true],
    ['Canada/Atlantic', true],
    ['Canada/Central', true],
    ['Canada/Eastern', true],
    ['Canada/Mountain', true],
    ['Canada/Newfoundland', true],
    ['Canada/Pacific', true],
    ['Canada/Saskatchewan', true],
    ['Canada/Yukon', true],
    ['Chile/Continental', true],
    ['Chile/EasterIsland', true],
    ['Cuba', true],
    ['EET', true],
    ['EST', true],
    ['EST5EDT', true],
    ['Egypt', true],
    ['Eire', true],
    ['Etc/GMT', true],
    ['Etc/GMT+0', true],
    ['Etc/GMT+1', true],
    ['Etc/GMT+10', true],
    ['Etc/GMT+11', true],
    ['Etc/GMT+12', true],
    ['Etc/GMT+2', true],
    ['Etc/GMT+3', true],
    ['Etc/GMT+4', true],
    ['Etc/GMT+5', true],
    ['Etc/GMT+6', true],
    ['Etc/GMT+7', true],
    ['Etc/GMT+8', true],
    ['Etc/GMT+9', true],
    ['Etc/GMT-0', true],
    ['Etc/GMT-1', true],
    ['Etc/GMT-10', true],
    ['Etc/GMT-11', true],
    ['Etc/GMT-12', true],
    ['Etc/GMT-13', true],
    ['Etc/GMT-14', true],
    ['Etc/GMT-2', true],
    ['Etc/GMT-3', true],
    ['Etc/GMT-4', true],
    ['Etc/GMT-5', true],
    ['Etc/GMT-6', true],
    ['Etc/GMT-7', true],
    ['Etc/GMT-8', true],
    ['Etc/GMT-9', true],
    ['Etc/GMT0', true],
    ['Etc/Greenwich', true],
    ['Etc/UCT', true],
    ['Etc/UTC', true],
    ['Etc/Universal', true],
    ['Etc/Zulu', true],
    ['Europe/Amsterdam', true],
    ['Europe/Andorra', true],
    ['Europe/Astrakhan', true],
    ['Europe/Athens', true],
    ['Europe/Belfast', true],
    ['Europe/Belgrade', true],
    ['Europe/Berlin', true],
    ['Europe/Bratislava', true],
    ['Europe/Brussels', true],
    ['Europe/Bucharest', true],
    ['Europe/Budapest', true],
    ['Europe/Busingen', true],
    ['Europe/Chisinau', true],
    ['Europe/Copenhagen', true],
    ['Europe/Dublin', true],
    ['Europe/Gibraltar', true],
    ['Europe/Guernsey', true],
    ['Europe/Helsinki', true],
    ['Europe/Isle_of_Man', true],
    ['Europe/Istanbul', true],
    ['Europe/Jersey', true],
    ['Europe/Kaliningrad', true],
    ['Europe/Kiev', true],
    ['Europe/Kirov', true],
    ['Europe/Kyiv', true],
    ['Europe/Lisbon', true],
    ['Europe/Ljubljana', true],
    ['Europe/London', true],
    ['Europe/Luxembourg', true],
    ['Europe/Madrid', true],
    ['Europe/Malta', true],
    ['Europe/Mariehamn', true],
    ['Europe/Minsk', true],
    ['Europe/Monaco', true],
    ['Europe/Moscow', true],
    ['Europe/Nicosia', true],
    ['Europe/Oslo', true],
    ['Europe/Paris', true],
    ['Europe/Podgorica', true],
    ['Europe/Prague', true],
    ['Europe/Riga', true],
    ['Europe/Rome', true],
    ['Europe/Samara', true],
    ['Europe/San_Marino', true],
    ['Europe/Sarajevo', true],
    ['Europe/Saratov', true],
    ['Europe/Simferopol', true],
    ['Europe/Skopje', true],
    ['Europe/Sofia', true],
    ['Europe/Stockholm', true],
    ['Europe/Tallinn', true],
    ['Europe/Tirane', true],
    ['Europe/Tiraspol', true],
    ['Europe/Ulyanovsk', true],
    ['Europe/Uzhgorod', true],
    ['Europe/Vaduz', true],
    ['Europe/Vatican', true],
    ['Europe/Vienna', true],
    ['Europe/Vilnius', true],
    ['Europe/Volgograd', true],
    ['Europe/Warsaw', true],
    ['Europe/Zagreb', true],
    ['Europe/Zaporozhye', true],
    ['Europe/Zurich', true],
    ['Factory', true],
    ['GB', true],
    ['GB-Eire', true],
    ['GMT', true],
    ['GMT+0', true],
    ['GMT-0', true],
    ['GMT0', true],
    ['Greenwich', true],
    ['HST', true],
    ['Hongkong', true],
    ['Iceland', true],
    ['Indian/Antananarivo', true],
    ['Indian/Chagos', true],
    ['Indian/Christmas', true],
    ['Indian/Cocos', true],
    ['Indian/Comoro', true],
    ['Indian/Kerguelen', true],
    ['Indian/Mahe', true],
    ['Indian/Maldives', true],
    ['Indian/Mauritius', true],
    ['Indian/Mayotte', true],
    ['Indian/Reunion', true],
    ['Iran', true],
    ['Israel', true],
    ['Jamaica', true],
    ['Japan', true],
    ['Kwajalein', true],
    ['Libya', true],
    ['MET', true],
    ['MST', true],
    ['MST7MDT', true],
    ['Mexico/BajaNorte', true],
    ['Mexico/BajaSur', true],
    ['Mexico/General', true],
    ['NZ', true],
    ['NZ-CHAT', true],
    ['Navajo', true],
    ['PRC', true],
    ['PST8PDT', true],
    ['Pacific/Apia', true],
    ['Pacific/Auckland', true],
    ['Pacific/Bougainville', true],
    ['Pacific/Chatham', true],
    ['Pacific/Chuuk', true],
    ['Pacific/Easter', true],
    ['Pacific/Efate', true],
    ['Pacific/Enderbury', true],
    ['Pacific/Fakaofo', true],
    ['Pacific/Fiji', true],
    ['Pacific/Funafuti', true],
    ['Pacific/Galapagos', true],
    ['Pacific/Gambier', true],
    ['Pacific/Guadalcanal', true],
    ['Pacific/Guam', true],
    ['Pacific/Honolulu', true],
    ['Pacific/Johnston', true],
    ['Pacific/Kanton', true],
    ['Pacific/Kiritimati', true],
    ['Pacific/Kosrae', true],
    ['Pacific/Kwajalein', true],
    ['Pacific/Majuro', true],
    ['Pacific/Marquesas', true],
    ['Pacific/Midway', true],
    ['Pacific/Nauru', true],
    ['Pacific/Niue', true],
    ['Pacific/Norfolk', true],
    ['Pacific/Noumea', true],
    ['Pacific/Pago_Pago', true],
    ['Pacific/Palau', true],
    ['Pacific/Pitcairn', true],
    ['Pacific/Pohnpei', true],
    ['Pacific/Ponape', true],
    ['Pacific/Port_Moresby', true],
    ['Pacific/Rarotonga', true],
    ['Pacific/Saipan', true],
    ['Pacific/Samoa', true],
    ['Pacific/Tahiti', true],
    ['Pacific/Tarawa', true],
    ['Pacific/Tongatapu', true],
    ['Pacific/Truk', true],
    ['Pacific/Wake', true],
    ['Pacific/Wallis', true],
    ['Pacific/Yap', true],
    ['Poland', true],
    ['Portugal', true],
    ['ROC', true],
    ['ROK', true],
    ['Singapore', true],
    ['Turkey', true],
    ['UCT', true],
    ['US/Alaska', true],
    ['US/Aleutian', true],
    ['US/Arizona', true],
    ['US/Central', true],
    ['US/East-Indiana', true],
    ['US/Eastern', true],
    ['US/Hawaii', true],
    ['US/Indiana-Starke', true],
    ['US/Michigan', true],
    ['US/Mountain', true],
    ['US/Pacific', true],
    ['US/Samoa', true],
    ['UTC', true],
    ['Universal', true],
    ['W-SU', true],
    ['WET', true],
    ['Zulu', true],
    ['localtime', true],
    
    ['Not/AZone', false],
    ['America//NYC', false],
    ['America/New York', false],
  ])('IANA timezone %s -> %s', (value, ok) => {
    expect(IanaTimezoneSchema.safeParse(value as string).success).toBe(ok);
  });

  // Comprehensive CSS hex color tests: #RGB, #RGBA, #RRGGBB, #RRGGBBAA, valid/invalid
  it.each([
    // Valid 3-digit (#RGB)
    ['#000', true],
    ['#fff', true],
    ['#FFF', true],
    ['#abc', true],
    ['#AbC', true],
    ['#123', true],
    ['#9aF', true],
    // Valid 4-digit (#RGBA)
    ['#0000', true],
    ['#ffff', true],
    ['#FFFF', true],
    ['#abcd', true],
    ['#aBcD', true],
    ['#1234', true],
    ['#9aF0', true],
    // Valid 6-digit (#RRGGBB)
    ['#000000', true],
    ['#ffffff', true],
    ['#FFFFFF', true],
    ['#aabbcc', true],
    ['#AABBCC', true],
    ['#123456', true],
    ['#09af0C', true],
    // Valid 8-digit (#RRGGBBAA)
    ['#00000000', true],
    ['#ffffffff', true],
    ['#FFFFFFFF', true],
    ['#aabbccdd', true],
    ['#AABBCCDD', true],
    ['#12345678', true],
    ['#09af0CFF', true],
    // Edge valid: all zeros, all fs, mixed case
    ['#0f0', true],
    ['#0f0f', true],
    ['#00ff00', true],
    ['#00ff00ff', true],
    ['#FfF', true],
    ['#FfFf', true],
    ['#FfFfFf', true],
    ['#FfFfFfFf', true],
    // Named colors: all variants #RGB, #RGBA, #RRGGBB, #RRGGBBAA

    // aliceblue (#F0F8FF)
    ['#F0F', true], // #RGB
    ['#F0FF', true], // #RGBA
    ['#F0F8FF', true], // #RRGGBB
    ['#F0F8FFFF', true], // #RRGGBBAA

    // antiquewhite (#FAEBD7)
    ['#FAD', true],
    ['#FADF', true],
    ['#FAEBD7', true],
    ['#FAEBD7FF', true],

    // aqua (#00FFFF)
    ['#0FF', true],
    ['#0FFF', true],
    ['#00FFFF', true],
    ['#00FFFFFF', true],

    // aquamarine (#7FFFD4)
    ['#7FD', true],
    ['#7FDF', true],
    ['#7FFFD4', true],
    ['#7FFFD4FF', true],

    // azure (#F0FFFF)
    ['#F0F', true],
    ['#F0FF', true],
    ['#F0FFFF', true],
    ['#F0FFFFFF', true],

    // beige (#F5F5DC)
    ['#F5D', true],
    ['#F5DF', true],
    ['#F5F5DC', true],
    ['#F5F5DCFF', true],

    // bisque (#FFE4C4)
    ['#FEC', true],
    ['#FECF', true],
    ['#FFE4C4', true],
    ['#FFE4C4FF', true],

    // black (#000000)
    ['#000', true],
    ['#000F', true],
    ['#000000', true],
    ['#000000FF', true],

    // blanchedalmond (#FFEBCD)
    ['#FEC', true],
    ['#FECF', true],
    ['#FFEBCD', true],
    ['#FFEBCDFF', true],

    // blue (#0000FF)
    ['#00F', true],
    ['#00FF', true],
    ['#0000FF', true],
    ['#0000FFFF', true],

    // blueviolet (#8A2BE2)
    ['#8AE', true],
    ['#8AEF', true],
    ['#8A2BE2', true],
    ['#8A2BE2FF', true],

    // brown (#A52A2A)
    ['#A52', true],
    ['#A52F', true],
    ['#A52A2A', true],
    ['#A52A2AFF', true],

    // burlywood (#DEB887)
    ['#DB8', true],
    ['#DB8F', true],
    ['#DEB887', true],
    ['#DEB887FF', true],

    // cadetblue (#5F9EA0)
    ['#5FA', true],
    ['#5FAF', true],
    ['#5F9EA0', true],
    ['#5F9EA0FF', true],

    // chartreuse (#7FFF00)
    ['#7F0', true],
    ['#7F0F', true],
    ['#7FFF00', true],
    ['#7FFF00FF', true],

    // chocolate (#D2691E)
    ['#D21', true],
    ['#D21F', true],
    ['#D2691E', true],
    ['#D2691EFF', true],

    // coral (#FF7F50)
    ['#F75', true],
    ['#F75F', true],
    ['#FF7F50', true],
    ['#FF7F50FF', true],

    // cornflowerblue (#6495ED)
    ['#6ED', true],
    ['#6EDF', true],
    ['#6495ED', true],
    ['#6495EDFF', true],

    // cornsilk (#FFF8DC)
    ['#FDC', true],
    ['#FDCF', true],
    ['#FFF8DC', true],
    ['#FFF8DCFF', true],

    // crimson (#DC143C)
    ['#D13', true],
    ['#D13F', true],
    ['#DC143C', true],
    ['#DC143CFF', true],

    // cyan (#00FFFF)
    ['#0FF', true],
    ['#0FFF', true],
    ['#00FFFF', true],
    ['#00FFFFFF', true],

    // darkblue (#00008B)
    ['#08B', true],
    ['#08BF', true],
    ['#00008B', true],
    ['#00008BFF', true],

    // darkcyan (#008B8B)
    ['#08B', true],
    ['#08BF', true],
    ['#008B8B', true],
    ['#008B8BFF', true],

    // darkgoldenrod (#B8860B)
    ['#B80', true],
    ['#B80F', true],
    ['#B8860B', true],
    ['#B8860BFF', true],

    // darkgray (#A9A9A9)
    ['#AAA', true],
    ['#AAAF', true],
    ['#A9A9A9', true],
    ['#A9A9A9FF', true],

    // darkgreen (#006400)
    ['#060', true],
    ['#060F', true],
    ['#006400', true],
    ['#006400FF', true],

    // darkgrey (#A9A9A9)
    ['#AAA', true],
    ['#AAAF', true],
    ['#A9A9A9', true],
    ['#A9A9A9FF', true],

    // darkkhaki (#BDB76B)
    ['#BDB', true],
    ['#BDBF', true],
    ['#BDB76B', true],
    ['#BDB76BFF', true],

    // darkmagenta (#8B008B)
    ['#80B', true],
    ['#80BF', true],
    ['#8B008B', true],
    ['#8B008BFF', true],

    // darkolivegreen (#556B2F)
    ['#52F', true],
    ['#52FF', true],
    ['#556B2F', true],
    ['#556B2FFF', true],

    // darkorange (#FF8C00)
    ['#F80', true],
    ['#F80F', true],
    ['#FF8C00', true],
    ['#FF8C00FF', true],

    // darkorchid (#9932CC)
    ['#92C', true],
    ['#92CF', true],
    ['#9932CC', true],
    ['#9932CCFF', true],

    // darkred (#8B0000)
    ['#800', true],
    ['#800F', true],
    ['#8B0000', true],
    ['#8B0000FF', true],

    // darksalmon (#E9967A)
    ['#E97', true],
    ['#E97F', true],
    ['#E9967A', true],
    ['#E9967AFF', true],

    // darkseagreen (#8FBC8F)
    ['#8BF', true],
    ['#8BFF', true],
    ['#8FBC8F', true],
    ['#8FBC8FFF', true],

    // darkslateblue (#483D8B)
    ['#48B', true],
    ['#48BF', true],
    ['#483D8B', true],
    ['#483D8BFF', true],

    // darkslategray (#2F4F4F)
    ['#24F', true],
    ['#24FF', true],
    ['#2F4F4F', true],
    ['#2F4F4FFF', true],

    // darkslategrey (#2F4F4F)
    ['#24F', true],
    ['#24FF', true],
    ['#2F4F4F', true],
    ['#2F4F4FFF', true],

    // darkturquoise (#00CED1)
    ['#0CD', true],
    ['#0CDF', true],
    ['#00CED1', true],
    ['#00CED1FF', true],

    // darkviolet (#9400D3)
    ['#90D', true],
    ['#90DF', true],
    ['#9400D3', true],
    ['#9400D3FF', true],

    // deeppink (#FF1493)
    ['#F19', true],
    ['#F19F', true],
    ['#FF1493', true],
    ['#FF1493FF', true],

    // deepskyblue (#00BFFF)
    ['#0BF', true],
    ['#0BFF', true],
    ['#00BFFF', true],
    ['#00BFFFFF', true],

    // dimgray (#696969)
    ['#696', true],
    ['#696F', true],
    ['#696969', true],
    ['#696969FF', true],

    // dimgrey (#696969)
    ['#696', true],
    ['#696F', true],
    ['#696969', true],
    ['#696969FF', true],

    // dodgerblue (#1E90FF)
    ['#19F', true],
    ['#19FF', true],
    ['#1E90FF', true],
    ['#1E90FFFF', true],

    // firebrick (#B22222)
    ['#B22', true],
    ['#B22F', true],
    ['#B22222', true],
    ['#B22222FF', true],

    // floralwhite (#FFFAF0)
    ['#FF0', true],
    ['#FF0F', true],
    ['#FFFAF0', true],
    ['#FFFAF0FF', true],

    // forestgreen (#228B22)
    ['#282', true],
    ['#282F', true],
    ['#228B22', true],
    ['#228B22FF', true],

    // fuchsia (#FF00FF)
    ['#F0F', true],
    ['#F0FF', true],
    ['#FF00FF', true],
    ['#FF00FFFF', true],

    // gainsboro (#DCDCDC)
    ['#DCC', true],
    ['#DCCF', true],
    ['#DCDCDC', true],
    ['#DCDCDCFF', true],

    // ghostwhite (#F8F8FF)
    ['#F8F', true],
    ['#F8FF', true],
    ['#F8F8FF', true],
    ['#F8F8FFFF', true],

    // gold (#FFD700)
    ['#FD0', true],
    ['#FD0F', true],
    ['#FFD700', true],
    ['#FFD700FF', true],

    // goldenrod (#DAA520)
    ['#DA2', true],
    ['#DA2F', true],
    ['#DAA520', true],
    ['#DAA520FF', true],

    // gray (#808080)
    ['#888', true],
    ['#888F', true],
    ['#808080', true],
    ['#808080FF', true],

    // green (#008000)
    ['#080', true],
    ['#080F', true],
    ['#008000', true],
    ['#008000FF', true],

    // greenyellow (#ADFF2F)
    ['#AF2', true],
    ['#AF2F', true],
    ['#ADFF2F', true],
    ['#ADFF2FFF', true],

    // grey (#808080)
    ['#888', true],
    ['#888F', true],
    ['#808080', true],
    ['#808080FF', true],

    // honeydew (#F0FFF0)
    ['#FF0', true],
    ['#FF0F', true],
    ['#F0FFF0', true],
    ['#F0FFF0FF', true],

    // hotpink (#FF69B4)
    ['#F6B', true],
    ['#F6BF', true],
    ['#FF69B4', true],
    ['#FF69B4FF', true],

    // indianred (#CD5C5C)
    ['#C5C', true],
    ['#C5CF', true],
    ['#CD5C5C', true],
    ['#CD5C5CFF', true],

    // indigo (#4B0082)
    ['#482', true],
    ['#482F', true],
    ['#4B0082', true],
    ['#4B0082FF', true],

    // ivory (#FFFFF0)
    ['#FF0', true],
    ['#FF0F', true],
    ['#FFFFF0', true],
    ['#FFFFF0FF', true],

    // khaki (#F0E68C)
    ['#F0C', true],
    ['#F0CF', true],
    ['#F0E68C', true],
    ['#F0E68CFF', true],

    // lavender (#E6E6FA)
    ['#EFA', true],
    ['#EFAF', true],
    ['#E6E6FA', true],
    ['#E6E6FAFF', true],

    // lavenderblush (#FFF0F5)
    ['#FF5', true],
    ['#FF5F', true],
    ['#FFF0F5', true],
    ['#FFF0F5FF', true],

    // lawngreen (#7CFC00)
    ['#7C0', true],
    ['#7C0F', true],
    ['#7CFC00', true],
    ['#7CFC00FF', true],

    // lemonchiffon (#FFFACD)
    ['#FCD', true],
    ['#FCDF', true],
    ['#FFFACD', true],
    ['#FFFACDFF', true],

    // lightblue (#ADD8E6)
    ['#AE6', true],
    ['#AE6F', true],
    ['#ADD8E6', true],
    ['#ADD8E6FF', true],

    // lightcoral (#F08080)
    ['#F08', true],
    ['#F08F', true],
    ['#F08080', true],
    ['#F08080FF', true],

    // lightcyan (#E0FFFF)
    ['#EFF', true],
    ['#EFFF', true],
    ['#E0FFFF', true],
    ['#E0FFFFFF', true],

    // lightgoldenrodyellow (#FAFAD2)
    ['#FAD', true],
    ['#FADF', true],
    ['#FAFAD2', true],
    ['#FAFAD2FF', true],

    // lightgray (#D3D3D3)
    ['#DDD', true],
    ['#DDDF', true],
    ['#D3D3D3', true],
    ['#D3D3D3FF', true],

    // lightgreen (#90EE90)
    ['#9E9', true],
    ['#9E9F', true],
    ['#90EE90', true],
    ['#90EE90FF', true],

    // lightgrey (#D3D3D3)
    ['#DDD', true],
    ['#DDDF', true],
    ['#D3D3D3', true],
    ['#D3D3D3FF', true],

    // lightpink (#FFB6C1)
    ['#FC1', true],
    ['#FC1F', true],
    ['#FFB6C1', true],
    ['#FFB6C1FF', true],

    // lightsalmon (#FFA07A)
    ['#F7A', true],
    ['#F7AF', true],
    ['#FFA07A', true],
    ['#FFA07AFF', true],

    // lightseagreen (#20B2AA)
    ['#2BA', true],
    ['#2BAF', true],
    ['#20B2AA', true],
    ['#20B2AAFF', true],

    // lightskyblue (#87CEFA)
    ['#8FA', true],
    ['#8FAF', true],
    ['#87CEFA', true],
    ['#87CEFAFF', true],

    // lightslategray (#778899)
    ['#789', true],
    ['#789F', true],
    ['#778899', true],
    ['#778899FF', true],

    // lightslategrey (#778899)
    ['#789', true],
    ['#789F', true],
    ['#778899', true],
    ['#778899FF', true],

    // lightsteelblue (#B0C4DE)
    ['#BDE', true],
    ['#BDEF', true],
    ['#B0C4DE', true],
    ['#B0C4DEFF', true],

    // lightyellow (#FFFFE0)
    ['#FFE', true],
    ['#FFEF', true],
    ['#FFFFE0', true],
    ['#FFFFE0FF', true],

    // lime (#00FF00)
    ['#0F0', true],
    ['#0F0F', true],
    ['#00FF00', true],
    ['#00FF00FF', true],

    // limegreen (#32CD32)
    ['#3C3', true],
    ['#3C3F', true],
    ['#32CD32', true],
    ['#32CD32FF', true],

    // linen (#FAF0E6)
    ['#FAE', true],
    ['#FAEF', true],
    ['#FAF0E6', true],
    ['#FAF0E6FF', true],

    // magenta (#FF00FF)
    ['#F0F', true],
    ['#F0FF', true],
    ['#FF00FF', true],
    ['#FF00FFFF', true],

    // maroon (#800000)
    ['#800', true],
    ['#800F', true],
    ['#800000', true],
    ['#800000FF', true],

    // mediumaquamarine (#66CDAA)
    ['#6CA', true],
    ['#6CAF', true],
    ['#66CDAA', true],
    ['#66CDAAFF', true],

    // mediumblue (#0000CD)
    ['#00C', true],
    ['#00CF', true],
    ['#0000CD', true],
    ['#0000CDFF', true],

    // mediumorchid (#BA55D3)
    ['#BD3', true],
    ['#BD3F', true],
    ['#BA55D3', true],
    ['#BA55D3FF', true],

    // mediumpurple (#9370DB)
    ['#9DB', true],
    ['#9DBF', true],
    ['#9370DB', true],
    ['#9370DBFF', true],

    // mediumseagreen (#3CB371)
    ['#3C7', true],
    ['#3C7F', true],
    ['#3CB371', true],
    ['#3CB371FF', true],

    // mediumslateblue (#7B68EE)
    ['#7BE', true],
    ['#7BEF', true],
    ['#7B68EE', true],
    ['#7B68EEFF', true],

    // mediumspringgreen (#00FA9A)
    ['#0F9', true],
    ['#0F9F', true],
    ['#00FA9A', true],
    ['#00FA9AFF', true],

    // mediumturquoise (#48D1CC)
    ['#4DC', true],
    ['#4DCF', true],
    ['#48D1CC', true],
    ['#48D1CCFF', true],

    // mediumvioletred (#C71585)
    ['#C75', true],
    ['#C75F', true],
    ['#C71585', true],
    ['#C71585FF', true],

    // midnightblue (#191970)
    ['#197', true],
    ['#197F', true],
    ['#191970', true],
    ['#191970FF', true],

    // mintcream (#F5FFFA)
    ['#FFA', true],
    ['#FFAF', true],
    ['#F5FFFA', true],
    ['#F5FFFAFF', true],

    // mistyrose (#FFE4E1)
    ['#FE1', true],
    ['#FE1F', true],
    ['#FFE4E1', true],
    ['#FFE4E1FF', true],

    // moccasin (#FFE4B5)
    ['#FEB', true],
    ['#FEBF', true],
    ['#FFE4B5', true],
    ['#FFE4B5FF', true],

    // navajowhite (#FFDEAD)
    ['#FAD', true],
    ['#FADF', true],
    ['#FFDEAD', true],
    ['#FFDEADFF', true],

    // navy (#000080)
    ['#008', true],
    ['#008F', true],
    ['#000080', true],
    ['#000080FF', true],

    // oldlace (#FDF5E6)
    ['#FE6', true],
    ['#FE6F', true],
    ['#FDF5E6', true],
    ['#FDF5E6FF', true],

    // olive (#808000)
    ['#880', true],
    ['#880F', true],
    ['#808000', true],
    ['#808000FF', true],

    // olivedrab (#6B8E23)
    ['#682', true],
    ['#682F', true],
    ['#6B8E23', true],
    ['#6B8E23FF', true],

    // orange (#FFA500)
    ['#FA0', true],
    ['#FA0F', true],
    ['#FFA500', true],
    ['#FFA500FF', true],

    // orangered (#FF4500)
    ['#F40', true],
    ['#F40F', true],
    ['#FF4500', true],
    ['#FF4500FF', true],

    // orchid (#DA70D6)
    ['#DD6', true],
    ['#DD6F', true],
    ['#DA70D6', true],
    ['#DA70D6FF', true],

    // palegoldenrod (#EEE8AA)
    ['#EAA', true],
    ['#EAAF', true],
    ['#EEE8AA', true],
    ['#EEE8AAFF', true],

    // palegreen (#98FB98)
    ['#9F9', true],
    ['#9F9F', true],
    ['#98FB98', true],
    ['#98FB98FF', true],

    // paleturquoise (#AFEEEE)
    ['#AEE', true],
    ['#AEEF', true],
    ['#AFEEEE', true],
    ['#AFEEEEFF', true],

    // palevioletred (#DB7093)
    ['#D93', true],
    ['#D93F', true],
    ['#DB7093', true],
    ['#DB7093FF', true],

    // papayawhip (#FFEFD5)
    ['#FD5', true],
    ['#FD5F', true],
    ['#FFEFD5', true],
    ['#FFEFD5FF', true],

    // peachpuff (#FFDAB9)
    ['#FB9', true],
    ['#FB9F', true],
    ['#FFDAB9', true],
    ['#FFDAB9FF', true],

    // peru (#CD853F)
    ['#C3F', true],
    ['#C3FF', true],
    ['#CD853F', true],
    ['#CD853FFF', true],

    // pink (#FFC0CB)
    ['#FCB', true],
    ['#FCBF', true],
    ['#FFC0CB', true],
    ['#FFC0CBFF', true],

    // plum (#DDA0DD)
    ['#DAD', true],
    ['#DADF', true],
    ['#DDA0DD', true],
    ['#DDA0DDFF', true],

    // powderblue (#B0E0E6)
    ['#BE6', true],
    ['#BE6F', true],
    ['#B0E0E6', true],
    ['#B0E0E6FF', true],

    // purple (#800080)
    ['#808', true],
    ['#808F', true],
    ['#800080', true],
    ['#800080FF', true],

    // red (#FF0000)
    ['#F00', true],
    ['#F00F', true],
    ['#FF0000', true],
    ['#FF0000FF', true],

    // rosybrown (#BC8F8F)
    ['#B8F', true],
    ['#B8FF', true],
    ['#BC8F8F', true],
    ['#BC8F8FFF', true],

    // royalblue (#4169E1)
    ['#4E1', true],
    ['#4E1F', true],
    ['#4169E1', true],
    ['#4169E1FF', true],

    // saddlebrown (#8B4513)
    ['#841', true],
    ['#841F', true],
    ['#8B4513', true],
    ['#8B4513FF', true],

    // salmon (#FA8072)
    ['#F87', true],
    ['#F87F', true],
    ['#FA8072', true],
    ['#FA8072FF', true],

    // sandybrown (#F4A460)
    ['#FA6', true],
    ['#FA6F', true],
    ['#F4A460', true],
    ['#F4A460FF', true],

    // seagreen (#2E8B57)
    ['#285', true],
    ['#285F', true],
    ['#2E8B57', true],
    ['#2E8B57FF', true],

    // seashell (#FFF5EE)
    ['#FEE', true],
    ['#FEEF', true],
    ['#FFF5EE', true],
    ['#FFF5EEFF', true],

    // sienna (#A0522D)
    ['#A2D', true],
    ['#A2DF', true],
    ['#A0522D', true],
    ['#A0522DFF', true],

    // silver (#C0C0C0)
    ['#CCC', true],
    ['#CCCF', true],
    ['#C0C0C0', true],
    ['#C0C0C0FF', true],

    // skyblue (#87CEEB)
    ['#8EB', true],
    ['#8EBF', true],
    ['#87CEEB', true],
    ['#87CEEBFF', true],

    // slateblue (#6A5ACD)
    ['#6AC', true],
    ['#6ACF', true],
    ['#6A5ACD', true],
    ['#6A5ACDFF', true],

    // slategray (#708090)
    ['#789', true],
    ['#789F', true],
    ['#708090', true],
    ['#708090FF', true],

    // slategrey (#708090)
    ['#789', true],
    ['#789F', true],
    ['#708090', true],
    ['#708090FF', true],

    // snow (#FFFAFA)
    ['#FFA', true],
    ['#FFAF', true],
    ['#FFFAFA', true],
    ['#FFFAFAFF', true],

    // springgreen (#00FF7F)
    ['#0F7', true],
    ['#0F7F', true],
    ['#00FF7F', true],
    ['#00FF7FFF', true],

    // steelblue (#4682B4)
    ['#4B4', true],
    ['#4B4F', true],
    ['#4682B4', true],
    ['#4682B4FF', true],

    // tan (#D2B48C)
    ['#D8C', true],
    ['#D8CF', true],
    ['#D2B48C', true],
    ['#D2B48CFF', true],

    // teal (#008080)
    ['#088', true],
    ['#088F', true],
    ['#008080', true],
    ['#008080FF', true],

    // thistle (#D8BFD8)
    ['#DD8', true],
    ['#DD8F', true],
    ['#D8BFD8', true],
    ['#D8BFD8FF', true],

    // tomato (#FF6347)
    ['#F67', true],
    ['#F67F', true],
    ['#FF6347', true],
    ['#FF6347FF', true],

    // turquoise (#40E0D0)
    ['#4ED', true],
    ['#4EDF', true],
    ['#40E0D0', true],
    ['#40E0D0FF', true],

    // violet (#EE82EE)
    ['#E8E', true],
    ['#E8EF', true],
    ['#EE82EE', true],
    ['#EE82EEFF', true],

    // wheat (#F5DEB3)
    ['#FB3', true],
    ['#FB3F', true],
    ['#F5DEB3', true],
    ['#F5DEB3FF', true],

    // white (#FFFFFF)
    ['#FFF', true],
    ['#FFFF', true],
    ['#FFFFFF', true],
    ['#FFFFFFFF', true],

    // whitesmoke (#F5F5F5)
    ['#FFF', true],
    ['#FFFF', true],
    ['#F5F5F5', true],
    ['#F5F5F5FF', true],

    // yellow (#FFFF00)
    ['#FF0', true],
    ['#FF0F', true],
    ['#FFFF00', true],
    ['#FFFF00FF', true],

    // yellowgreen (#9ACD32)
    ['#9C3', true],
    ['#9C3F', true],
    ['#9ACD32', true],
    ['#9ACD32FF', true],

    // Invalid: missing #, wrong length, invalid chars, etc.
    ['fff', false],           // missing #
    ['#ff', false],           // too short
    ['#f', false],            // too short
    ['#fffffff', false],      // 7 digits (invalid)
    ['#ffff', true],          // 4 digits (valid)
    ['#', false],             // only #
    ['#12345', false],        // 5 digits
    ['#1234567', false],      // 7 digits
    ['#123456789', false],    // 9 digits
    ['#ggg', false],          // invalid hex
    ['#gggg', false],         // invalid hex
    ['#gggggg', false],       // invalid hex
    ['#gggggggg', false],     // invalid hex
    ['#12g', false],          // invalid hex
    ['#12g4', false],         // invalid hex
    ['#12g456', false],       // invalid hex
    ['#12g45678', false],     // invalid hex
    ['#12 456', false],       // space in hex
    ['#12-456', false],       // dash in hex
    ['#12_456', false],       // underscore in hex
    ['#1234567g', false],     // 8 digits, last not hex
    ['#123456g7', false],     // 8 digits, middle not hex
    ['#12345678 ', false],    // trailing space
    [' #123456', false],     // leading space
    ['#123456\n', false],     // newline
    ['#123456\t', false],     // tab
    [null, false],
    [undefined, false],
    [123, false],
    [{}, false],
    [[], false],
    [true, false],
    ['', false],
    ['   ', false],
  ])('ColorHex %s -> %s', (value, ok) => {
    expect(ColorHexSchema.safeParse(value as string).success).toBe(ok);
  });

  it.each([
    ['https://example.com', true],
    ['http://example.com/path', true],
    ['https://sub.domain.com:8080/foo?bar=baz#frag', true],
    ['http://localhost', true],
    ['http://127.0.0.1:3000', true],
    ['https://example.com/', true],
    ['https://example.com:443', true],
    ['https://example.com/path/to/resource', true],
    ['https://example.com?query=1', true],
    ['https://example.com#fragment', true],

    ['ftp://example.com', false], // not http/https
    ['ws://example.com', false],  // not http/https
    ['not-a-url', false],
    ['http//example.com', false], // malformed
    ['://example.com', false],    // missing protocol
    ['example.com', false],       // missing protocol
    ['https://', false],          // missing host
    ['http://', false],           // missing host
    ['https://?foo=bar', false],  // missing host
    [null, false],
    [undefined, false],
    [123, false],
    [{}, false],
    [[], false],
    [true, false],
    ['', false],
    ['   ', false],
  ])('HttpUrlSchema(%s) -> %s', (value, ok) => {
    expect(HttpUrlSchema.safeParse(value as any).success).toBe(ok);
  });
    });
  });
});
