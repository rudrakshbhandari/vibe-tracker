import { cookies, headers } from "next/headers";

const TZ_COOKIE = "tz";

/**
 * Validate that a timezone string is supported by Intl.
 * Vercel's x-vercel-ip-timezone or edge cases can return invalid values
 * that cause RangeError and crash the server.
 */
function isSupportedTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the user's timezone for server-side date formatting.
 * Priority: tz cookie (set by client) > x-vercel-ip-timezone header (Vercel) > undefined.
 * Wraps cookies()/headers() in try/catch — they can throw outside request scope (e.g. prerender).
 */
export async function getUserTimezone(): Promise<string | undefined> {
  try {
    const cookieStore = await cookies();
    const tzCookie = cookieStore.get(TZ_COOKIE)?.value;
    if (tzCookie && isSupportedTimezone(tzCookie)) return tzCookie;

    const headersList = await headers();
    const vercelTz = headersList.get("x-vercel-ip-timezone");
    if (vercelTz && isSupportedTimezone(vercelTz)) return vercelTz;
  } catch {
    // cookies()/headers() can throw outside request scope
  }
  return undefined;
}

type FormatDateOptions = {
  month?: "numeric" | "2-digit" | "long" | "short" | "narrow";
  day?: "numeric" | "2-digit";
  hour?: "numeric" | "2-digit";
  minute?: "numeric" | "2-digit";
  year?: "numeric" | "2-digit";
};

/**
 * Format a date in the user's local timezone when available.
 * Falls back to runtime default (often UTC on server) when timezone is unknown.
 * Wraps Intl usage in try/catch so any RangeError (e.g. invalid tz edge cases)
 * does not crash the server.
 */
export async function formatDate(
  date: Date,
  options: FormatDateOptions = {},
): Promise<string> {
  try {
    const tz = await getUserTimezone();
    return new Intl.DateTimeFormat("en-US", {
      ...options,
      ...(tz && { timeZone: tz }),
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-US", options).format(date);
  }
}

/**
 * Create an Intl.DateTimeFormat formatter with user's timezone for server use.
 * Falls back to formatter without timezone if Intl throws (e.g. invalid tz).
 */
export async function createDateFormatter(
  options: Intl.DateTimeFormatOptions,
): Promise<Intl.DateTimeFormat> {
  try {
    const tz = await getUserTimezone();
    return new Intl.DateTimeFormat("en-US", {
      ...options,
      ...(tz && { timeZone: tz }),
    });
  } catch {
    return new Intl.DateTimeFormat("en-US", options);
  }
}
