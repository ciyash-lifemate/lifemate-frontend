// The backend (mysql2 with dateStrings: true) returns DATETIME/TIMESTAMP
// columns as "YYYY-MM-DD HH:mm:ss" in UTC, with no timezone marker - valid in
// Hermes but not reliably parsed by `new Date()` on strict engines (e.g.
// web/Safari), which want an ISO "T", and without an explicit "Z" it gets
// parsed as local time instead of UTC, skewing every timestamp by the
// device's UTC offset.
export const parseServerDate = (value) => {
  if (!value) return null;
  const d = new Date(`${String(value).replace(' ', 'T')}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
};

// Formats a Date as a 12-hour clock time, e.g. "2:05 PM".
// Shared by chat bubbles, notifications and reminder rows so the time format
// stays identical everywhere it's shown.
export const formatClockTime = (date) => {
  const hours = date.getHours() % 12 || 12;
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const period = date.getHours() >= 12 ? 'PM' : 'AM';
  return `${hours}:${minutes} ${period}`;
};
