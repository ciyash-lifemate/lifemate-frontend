// Indian festivals/holidays shown on the Calendar screen. Two tiers:
// - FIXED_HOLIDAYS: same Gregorian date every year, generated on demand.
// - VARIABLE_FESTIVALS: lunar/solar-calendar festivals whose Gregorian date
//   shifts year to year, so they're only listed for years actually looked up
//   against a panchang source. A year with no entry here just shows the
//   fixed holidays - better than showing a wrong guessed date.
const pad = (n) => String(n).padStart(2, '0');

const FIXED_HOLIDAYS = [
  { month: 1, day: 1, name: "New Year's Day" },
  { month: 1, day: 26, name: 'Republic Day' },
  { month: 8, day: 15, name: 'Independence Day' },
  { month: 10, day: 2, name: 'Gandhi Jayanti' },
  { month: 12, day: 25, name: 'Christmas' },
];

const VARIABLE_FESTIVALS = {
  2026: [
    { date: '2026-01-14', name: 'Makar Sankranti' },
    { date: '2026-03-19', name: 'Ugadi' },
    { date: '2026-03-27', name: 'Rama Navami' },
    { date: '2026-09-14', name: 'Vinayaka Chavithi' },
    { date: '2026-10-11', name: 'Sharad Navratri begins' },
    { date: '2026-10-20', name: 'Dussehra' },
    { date: '2026-11-08', name: 'Diwali' },
  ],
};

// { 'YYYY-MM-DD': 'Festival Name' } for the given year.
export const getFestivalsForYear = (year) => {
  const map = {};
  FIXED_HOLIDAYS.forEach(({ month, day, name }) => {
    map[`${year}-${pad(month)}-${pad(day)}`] = name;
  });
  (VARIABLE_FESTIVALS[year] || []).forEach(({ date, name }) => {
    map[date] = name;
  });
  return map;
};
