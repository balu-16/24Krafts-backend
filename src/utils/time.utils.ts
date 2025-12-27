/**
 * Time utilities for handling IST (Indian Standard Time) timezone
 */

/**
 * Get current time for storage/comparison
 * Returns ISO string (UTC) suitable for Supabase timestamptz
 */
export function getCurrentIST(): string {
  const now = new Date();
  return formatISTOffset(now);
}

/**
 * Get current time in IST for comparison
 * Returns ISO string that can be used for Supabase queries
 */
export function getCurrentISTForComparison(): string {
  return getCurrentIST();
}

/**
 * Get OTP expiration time (10 minutes from now)
 * Returns ISO string (UTC) for storing in database
 */
export function getOTPExpirationIST(): string {
  const now = new Date();
  const expirationTime = 10 * 60 * 1000; // 10 minutes
  const expiry = new Date(now.getTime() + expirationTime);
  return formatISTOffset(expiry);
}

/**
 * Format date to IST string for display
 */
export function formatToIST(date: Date): string {
  return formatISTOffset(date);
}

/**
 * Check if a date is expired (in IST)
 */
export function isExpired(expiryDate: Date | string): boolean {
  const expiry = typeof expiryDate === 'string' ? new Date(expiryDate) : expiryDate;
  const now = new Date();
  return expiry < now;
}

/**
 * Helper object for common timestamp operations in IST
 */
export const ISTTimestamp = {
  now: (): string => getCurrentIST(),
  expiresIn: (minutes: number): string => {
    const now = new Date();
    const expirationTime = minutes * 60 * 1000;
    const expiry = new Date(now.getTime() + expirationTime);
    return formatISTOffset(expiry);
  },
  fromDate: (date: Date): string => formatISTOffset(date),
};

function formatISTOffset(date: Date): string {
  // Convert to IST by adding offset from UTC
  const utcMs = date.getTime() + date.getTimezoneOffset() * 60000;
  const istMs = utcMs + 5.5 * 60 * 60 * 1000; // +05:30
  const ist = new Date(istMs);
  const yyyy = ist.getFullYear();
  const mm = String(ist.getMonth() + 1).padStart(2, '0');
  const dd = String(ist.getDate()).padStart(2, '0');
  const HH = String(ist.getHours()).padStart(2, '0');
  const MM = String(ist.getMinutes()).padStart(2, '0');
  const SS = String(ist.getSeconds()).padStart(2, '0');
  // Return timestamptz-compatible string with explicit IST offset
  return `${yyyy}-${mm}-${dd} ${HH}:${MM}:${SS}+05:30`;
}

