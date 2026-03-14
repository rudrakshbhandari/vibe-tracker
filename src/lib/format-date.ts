import { cookies, headers } from "next/headers";

const TZ_COOKIE = "tz";

/**
 * Get the user's timezone for server-side date formatting.
 * Priority: tz cookie (set by client) > x-vercel-ip-timezone header (Vercel) > undefined.
 */
export async function getUserTimezone(): Promise<string | undefined> {
  const cookieStore = await cookies();
  const tzCookie = cookieStore.get(TZ_COOKIE)?.value;
  if (tzCookie) return tzCookie;

  const headersList = await headers();
  const vercelTz = headersList.get("x-vercel-ip-timezone");
  if (vercelTz) return vercelTz;

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
 */
export async function formatDate(
  date: Date,
  options: FormatDateOptions = {},
): Promise<string> {
  const tz = await getUserTimezone();
  return new Intl.DateTimeFormat("en-US", {
    ...options,
    ...(tz && { timeZone: tz }),
  }).format(date);
}

/**
 * Create an Intl.DateTimeFormat formatter with user's timezone for server use.
 */
export async function createDateFormatter(
  options: Intl.DateTimeFormatOptions,
): Promise<Intl.DateTimeFormat> {
  const tz = await getUserTimezone();
  return new Intl.DateTimeFormat("en-US", {
    ...options,
    ...(tz && { timeZone: tz }),
  });
}
