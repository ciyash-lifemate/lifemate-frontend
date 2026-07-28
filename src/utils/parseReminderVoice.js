// Best-effort natural-language parsing for the reminder form's "fill with
// voice" button - pulls a date/time out of a spoken sentence and hands back
// whatever text is left over as the title. This is regex-based pattern
// matching, not a real NLU model, so it only recognizes common phrasings
// (relative days, weekdays, "DD Month", "at H:MMam/pm").
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

const pad = (n) => String(n).padStart(2, '0');
const toIso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const addDays = (base, days) => {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
};

const stripTime = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const resolveMonthDay = (now, day, month) => {
  const year = now.getFullYear();
  let d = new Date(year, month, day);
  if (d < stripTime(now)) d = new Date(year + 1, month, day);
  return toIso(d);
};

const DATE_MATCHERS = [
  (text, now) => {
    const m = text.match(/\bday after tomorrow\b/i);
    return m ? { date: toIso(addDays(now, 2)), match: m[0] } : null;
  },
  (text, now) => {
    const m = text.match(/\btomorrow\b/i);
    return m ? { date: toIso(addDays(now, 1)), match: m[0] } : null;
  },
  (text, now) => {
    const m = text.match(/\b(today|tonight)\b/i);
    return m ? { date: toIso(now), match: m[0] } : null;
  },
  (text, now) => {
    const m = text.match(/\bin\s+(\d+)\s+days?\b/i);
    return m ? { date: toIso(addDays(now, parseInt(m[1], 10))), match: m[0] } : null;
  },
  (text, now) => {
    const m = text.match(new RegExp(`\\bnext\\s+(${WEEKDAYS.join('|')})\\b`, 'i'));
    if (!m) return null;
    const target = WEEKDAYS.indexOf(m[1].toLowerCase());
    const diff = ((target - now.getDay() + 7) % 7) || 7;
    return { date: toIso(addDays(now, diff)), match: m[0] };
  },
  (text, now) => {
    const m = text.match(new RegExp(`\\b(${WEEKDAYS.join('|')})\\b`, 'i'));
    if (!m) return null;
    const target = WEEKDAYS.indexOf(m[1].toLowerCase());
    const diff = (target - now.getDay() + 7) % 7;
    return { date: toIso(addDays(now, diff)), match: m[0] };
  },
  (text, now) => {
    const m = text.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTHS.join('|')})\\b`, 'i'));
    if (!m) return null;
    return { date: resolveMonthDay(now, parseInt(m[1], 10), MONTHS.indexOf(m[2].toLowerCase())), match: m[0] };
  },
  (text, now) => {
    const m = text.match(new RegExp(`\\b(${MONTHS.join('|')})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, 'i'));
    if (!m) return null;
    return { date: resolveMonthDay(now, parseInt(m[2], 10), MONTHS.indexOf(m[1].toLowerCase())), match: m[0] };
  },
  (text, now) => {
    const m = text.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
    if (!m) return null;
    const day = parseInt(m[1], 10);
    const month = parseInt(m[2], 10) - 1;
    if (month < 0 || month > 11 || day < 1 || day > 31) return null;
    let year = m[3] ? parseInt(m[3], 10) : now.getFullYear();
    if (year < 100) year += 2000;
    let d = new Date(year, month, day);
    if (!m[3] && d < stripTime(now)) d = new Date(year + 1, month, day);
    return { date: toIso(d), match: m[0] };
  },
];

const to24Hour = (hour, minute, period) => {
  let h = hour;
  if (period) {
    h = hour % 12;
    if (period.toLowerCase() === 'pm') h += 12;
  }
  return `${pad(h)}:${pad(minute)}`;
};

const toTimeResult = (m) => {
  const hour = parseInt(m[1], 10);
  const minute = m[2] ? parseInt(m[2], 10) : 0;
  if (hour > 23 || minute > 59) return null;
  return { time: to24Hour(hour, minute, m[3]), match: m[0] };
};

const TIME_MATCHERS = [
  (text) => {
    const m = text.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
    return m ? toTimeResult(m) : null;
  },
  (text) => {
    const m = text.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)?\b/i);
    return m ? toTimeResult(m) : null;
  },
  (text) => {
    const m = text.match(/\b(\d{1,2})\s*(am|pm)\b/i);
    return m ? { time: to24Hour(parseInt(m[1], 10), 0, m[2]), match: m[0] } : null;
  },
];

const FILLER_PATTERNS = [
  /^(please\s+)?remind me to\s+/i,
  /^(please\s+)?remind me (that\s+)?/i,
  /^set (a |an )?reminder (for|to)\s+/i,
  /^add (a |an )?reminder (for|to)\s+/i,
  /^reminder (for|to)\s+/i,
  /^(this is|it'?s|that'?s)\s+/i,
];

const EDGE_WORD = /^(is|was|on|at|to|for|of|the|a|an|my|and)\s+|\s+(is|on|at|to|for|of|the|a|an|my|and)$/i;

// Removes the matched date/time substring from `text` - plain substring
// removal (not regex) since `match` is the literal text a matcher already
// found, and re-running it as a regex could hit an unrelated later match.
const removeMatch = (text, match) => {
  const index = text.toLowerCase().indexOf(match.toLowerCase());
  if (index === -1) return text;
  return text.slice(0, index) + ' ' + text.slice(index + match.length);
};

export const parseReminderVoice = (transcript, now = new Date()) => {
  const text = (transcript || '').trim();
  if (!text) return { title: '', date: null, time: null };

  let dateResult = null;
  for (const matcher of DATE_MATCHERS) {
    dateResult = matcher(text, now);
    if (dateResult) break;
  }

  let timeResult = null;
  for (const matcher of TIME_MATCHERS) {
    timeResult = matcher(text);
    if (timeResult) break;
  }

  let remaining = text;
  if (dateResult) remaining = removeMatch(remaining, dateResult.match);
  if (timeResult) remaining = removeMatch(remaining, timeResult.match);

  for (const pattern of FILLER_PATTERNS) {
    remaining = remaining.replace(pattern, '');
  }

  remaining = remaining.replace(/\s+/g, ' ').trim();
  let prev;
  do {
    prev = remaining;
    remaining = remaining.replace(EDGE_WORD, '').trim();
  } while (remaining !== prev && remaining.length);
  remaining = remaining.replace(/^[,.\s]+|[,.\s]+$/g, '');

  const title = remaining ? remaining[0].toUpperCase() + remaining.slice(1) : '';

  return {
    title,
    date: dateResult ? dateResult.date : null,
    time: timeResult ? timeResult.time : null,
  };
};
