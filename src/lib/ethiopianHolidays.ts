// Ethiopian public holidays + working-hours math (ported from Netlink portal)
// Working windows: Mon-Fri 7:30-11:30 & 13:00-23:00, Sat 7:30-11:30, Sun + holidays = full overtime

export interface EthiopianHoliday {
  date: string; // YYYY-MM-DD
  name: string;
  nameAmharic: string;
}

const HOLIDAYS_BY_YEAR: Record<number, EthiopianHoliday[]> = {
  2025: [
    { date: '2025-01-07', name: 'Ethiopian Christmas (Genna)', nameAmharic: 'ገና' },
    { date: '2025-01-19', name: 'Ethiopian Epiphany (Timkat)', nameAmharic: 'ጥምቀት' },
    { date: '2025-03-02', name: 'Adwa Victory Day', nameAmharic: 'የአድዋ ድል በዓል' },
    { date: '2025-03-30', name: 'Eid al-Fitr', nameAmharic: 'ዒድ አል ፈጥር' },
    { date: '2025-04-18', name: 'Ethiopian Good Friday', nameAmharic: 'ስቅለት' },
    { date: '2025-04-20', name: 'Ethiopian Easter (Fasika)', nameAmharic: 'ፋሲካ' },
    { date: '2025-06-06', name: 'Eid al-Adha', nameAmharic: 'ዒድ አል አድሐ' },
    { date: '2025-09-11', name: 'Ethiopian New Year (Enkutatash)', nameAmharic: 'እንቁጣጣሽ' },
    { date: '2025-09-27', name: 'Meskel', nameAmharic: 'መስቀል' },
    { date: '2025-10-05', name: 'Mawlid', nameAmharic: 'መውሊድ' },
  ],
  2026: [
    { date: '2026-01-07', name: 'Ethiopian Christmas (Genna)', nameAmharic: 'ገና' },
    { date: '2026-01-19', name: 'Ethiopian Epiphany (Timkat)', nameAmharic: 'ጥምቀት' },
    { date: '2026-03-02', name: 'Adwa Victory Day', nameAmharic: 'የአድዋ ድል በዓል' },
    { date: '2026-03-20', name: 'Eid al-Fitr', nameAmharic: 'ዒድ አል ፈጥር' },
    { date: '2026-04-10', name: 'Ethiopian Good Friday', nameAmharic: 'ስቅለት' },
    { date: '2026-04-12', name: 'Ethiopian Easter (Fasika)', nameAmharic: 'ፋሲካ' },
    { date: '2026-05-26', name: 'Eid al-Adha', nameAmharic: 'ዒድ አል አድሐ' },
    { date: '2026-08-26', name: 'Mawlid', nameAmharic: 'መውሊድ' },
    { date: '2026-09-11', name: 'Ethiopian New Year (Enkutatash)', nameAmharic: 'እንቁጣጣሽ' },
    { date: '2026-09-27', name: 'Meskel', nameAmharic: 'መስቀል' },
  ],
  2027: [
    { date: '2027-01-07', name: 'Ethiopian Christmas (Genna)', nameAmharic: 'ገና' },
    { date: '2027-01-19', name: 'Ethiopian Epiphany (Timkat)', nameAmharic: 'ጥምቀት' },
    { date: '2027-03-02', name: 'Adwa Victory Day', nameAmharic: 'የአድዋ ድል በዓል' },
    { date: '2027-03-09', name: 'Eid al-Fitr', nameAmharic: 'ዒድ አል ፈጥር' },
    { date: '2027-04-23', name: 'Ethiopian Good Friday', nameAmharic: 'ስቅለት' },
    { date: '2027-04-25', name: 'Ethiopian Easter (Fasika)', nameAmharic: 'ፋሲካ' },
    { date: '2027-05-16', name: 'Eid al-Adha', nameAmharic: 'ዒድ አል አድሐ' },
    { date: '2027-09-12', name: 'Ethiopian New Year (Enkutatash)', nameAmharic: 'እንቁጣጣሽ' },
    { date: '2027-09-14', name: 'Mawlid', nameAmharic: 'መውሊድ' },
    { date: '2027-09-27', name: 'Meskel', nameAmharic: 'መስቀል' },
  ],
};

export function getHolidaysForYear(year: number): EthiopianHoliday[] {
  return HOLIDAYS_BY_YEAR[year] || [];
}

export function isEthiopianHoliday(date: Date | string): EthiopianHoliday | null {
  const dateStr = typeof date === 'string' ? date.slice(0, 10) : date.toISOString().slice(0, 10);
  const year = parseInt(dateStr.slice(0, 4));
  return getHolidaysForYear(year).find((h) => h.date === dateStr) || null;
}

export function getUpcomingHolidays(daysAhead = 30): EthiopianHoliday[] {
  const now = new Date();
  const limit = new Date();
  limit.setDate(now.getDate() + daysAhead);
  const years = new Set([now.getFullYear(), limit.getFullYear()]);
  const all: EthiopianHoliday[] = [];
  years.forEach((y) => all.push(...getHolidaysForYear(y)));
  return all
    .filter((h) => {
      const d = new Date(h.date);
      return d >= now && d <= limit;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Compute regular (non-overtime) hours within a clock-in/out session.
 * Mon-Fri windows: 7:30-11:30, 13:00-23:00. Sat: 7:30-11:30. Sunday/holidays: 0 (all overtime).
 */
export function calculateRegularHours(clockIn: Date, clockOut: Date): number {
  const day = clockIn.getDay();
  const dateStr = clockIn.toISOString().slice(0, 10);
  if (day === 0 || isEthiopianHoliday(dateStr)) return 0;

  const windows: { start: number; end: number }[] =
    day === 6 ? [{ start: 7.5, end: 11.5 }] : [{ start: 7.5, end: 11.5 }, { start: 13, end: 23 }];

  const inHour = clockIn.getHours() + clockIn.getMinutes() / 60;
  const outHour = clockOut.getHours() + clockOut.getMinutes() / 60;

  let regular = 0;
  for (const w of windows) {
    const s = Math.max(inHour, w.start);
    const e = Math.min(outHour, w.end);
    if (e > s) regular += e - s;
  }
  return parseFloat(regular.toFixed(2));
}

export function splitWorkHours(clockIn: Date, clockOut: Date): { total: number; regular: number; overtime: number } {
  const total = parseFloat(((clockOut.getTime() - clockIn.getTime()) / 3600000).toFixed(2));
  const regular = calculateRegularHours(clockIn, clockOut);
  const overtime = parseFloat(Math.max(0, total - regular).toFixed(2));
  return { total, regular, overtime };
}
