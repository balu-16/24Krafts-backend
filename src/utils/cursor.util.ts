/**
 * Cursor-based pagination utilities
 * Cursor format: base64(timestamp|id)
 */

export interface CursorData {
  timestamp: string;
  id: string;
}

export function encodeCursor(timestamp: Date | string, id: string | number): string {
  const ts = timestamp instanceof Date ? timestamp.toISOString() : timestamp;
  const cursorString = `${ts}|${id}`;
  return Buffer.from(cursorString).toString('base64');
}

export function decodeCursor(cursor: string): CursorData | null {
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
    const [timestamp, id] = decoded.split('|');
    if (!timestamp || !id) return null;
    return { timestamp, id };
  } catch {
    return null;
  }
}

export interface PaginatedResponse<T> {
  data: T[];
  nextCursor: string | null;
}

export function createPaginatedResponse<T>(
  data: T[],
  limit: number,
  getCursor: (item: T) => string,
): PaginatedResponse<T> {
  const hasMore = data.length > limit;
  const items = hasMore ? data.slice(0, limit) : data;
  const nextCursor = hasMore ? getCursor(data[limit - 1]) : null;

  return {
    data: items,
    nextCursor,
  };
}

