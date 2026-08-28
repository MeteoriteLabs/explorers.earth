export type AnalyticsTimeFilter =
  | { type: 'today' }
  | { type: 'last7days' }
  | { type: 'last30days' }
  | { type: 'last90days' }
  | { type: 'custom'; startDate: string; endDate: string };

export interface AnalyticsTimeFilterState {
  /**
   * @deprecated Temporary Date-based compatibility for AnalyticsDashboard.
   * Remove in Task 2 when its controls store canonical date-only strings.
   */
  type: AnalyticsTimeFilter['type'];
  startDate?: Date;
  endDate?: Date;
}

export interface AnalyticsDateRange {
  startDate: Date;
  endDate: Date;
  fromDate: string;
  toDate: string;
}

const MAX_ANALYTICS_CALENDAR_DAYS = 93;

const startOfDay = (value: Date) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const endOfDay = (value: Date) => {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
};

export function parseLocalDateInput(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText) - 1;
  const day = Number(dayText);
  const date = new Date(year, month, day);
  return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day
    ? date
    : null;
}

export function formatLocalDateInput(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const inclusiveCalendarDays = (startDate: Date, endDate: Date) =>
  Math.floor(
    (Date.UTC(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()) -
      Date.UTC(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())) /
      (24 * 60 * 60 * 1000),
  ) + 1;

const toRange = (startDate: Date, endDate: Date): AnalyticsDateRange => ({
  startDate: startOfDay(startDate),
  endDate: endOfDay(endDate),
  fromDate: formatLocalDateInput(startDate),
  toDate: formatLocalDateInput(endDate),
});

export function getAnalyticsDateRange(
  filter: AnalyticsTimeFilter | AnalyticsTimeFilterState,
  now = new Date(),
): AnalyticsDateRange | null {
  const today = startOfDay(now);

  if (filter.type === 'custom') {
    const startDate =
      typeof filter.startDate === 'string'
        ? parseLocalDateInput(filter.startDate)
        : filter.startDate && startOfDay(filter.startDate);
    const endDate =
      typeof filter.endDate === 'string'
        ? parseLocalDateInput(filter.endDate)
        : filter.endDate && startOfDay(filter.endDate);
    if (!startDate || !endDate) return null;
    const inclusiveDays = inclusiveCalendarDays(startDate, endDate);
    if (inclusiveDays < 1 || inclusiveDays > MAX_ANALYTICS_CALENDAR_DAYS) return null;
    return toRange(startDate, endDate);
  }

  const daysBack =
    filter.type === 'last7days' ? 6 : filter.type === 'last30days' ? 29 : filter.type === 'last90days' ? 89 : 0;
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - daysBack);
  return toRange(startDate, today);
}
