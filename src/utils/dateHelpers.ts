/**
 * Shared date utility functions.
 * Single source of truth — import from here instead of re-defining locally.
 */

/** Returns today's date as YYYY-MM-DD (UTC). */
export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Returns an arbitrary Date as YYYY-MM-DD (UTC). */
export function dateKeyFor(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Formats YYYY-MM-DD as a short weekday label, e.g. "Mon". */
export function dayLabel(dateKey: string): string {
  return new Date(dateKey + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' });
}

/** Returns the last 7 days as YYYY-MM-DD strings, oldest first. */
export function getLast7Days(): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return dateKeyFor(d);
  });
}

/** Returns the last 30 days as YYYY-MM-DD strings, oldest first. */
export function getLast30Days(): string[] {
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    return dateKeyFor(d);
  });
}

/** Returns the ISO week start (Monday) as YYYY-MM-DD. */
export function getWeekKey(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return dateKeyFor(monday);
}

/** Returns the current month as YYYY-MM. */
export function getMonthKey(): string {
  return new Date().toISOString().slice(0, 7);
}

/** Returns a Date set to midnight today (local). */
export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Returns a Date set to midnight on the most recent Monday (local). */
export function startOfWeek(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return d;
}

/** Returns current time as HH:MM:SS (locale-formatted). */
export function nowTimeStr(): string {
  return new Date().toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
