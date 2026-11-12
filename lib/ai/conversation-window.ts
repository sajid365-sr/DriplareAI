export type ConversationFetchMode = "recent" | "date_range" | "all_available";

export type ConversationDateBounds = {
  from?: Date;
  to?: Date;
};

export const MAX_CONVERSATIONS_PER_SOURCE = 100;

export function isDateOnly(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function isValidDateRange(fromDate: unknown, toDate: unknown): boolean {
  return isDateOnly(fromDate) && isDateOnly(toDate) && fromDate <= toDate;
}

export function getConversationDateBounds(
  mode: ConversationFetchMode | undefined,
  fromDate?: string,
  toDate?: string
): ConversationDateBounds {
  if (mode !== "date_range") return {};
  return {
    ...(fromDate ? { from: new Date(`${fromDate}T00:00:00.000Z`) } : {}),
    ...(toDate ? { to: new Date(`${toDate}T23:59:59.999Z`) } : {}),
  };
}

export function isWithinConversationDateBounds(
  value: string | Date,
  bounds: ConversationDateBounds
): boolean {
  const date = value instanceof Date ? value : new Date(value);
  return !Number.isNaN(date.getTime())
    && (!bounds.from || date >= bounds.from)
    && (!bounds.to || date <= bounds.to);
}

export function getConversationLimit(mode: ConversationFetchMode | undefined, count: number): number {
  return mode && mode !== "recent"
    ? MAX_CONVERSATIONS_PER_SOURCE
    : Math.min(MAX_CONVERSATIONS_PER_SOURCE, Math.max(1, Math.floor(Number(count))));
}
