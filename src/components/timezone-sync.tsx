"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

const TZ_COOKIE = "tz";
const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

export function getBrowserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

function getCookieValue(cookieString: string, name: string) {
  return cookieString
    .split("; ")
    .find((cookie) => cookie.startsWith(`${name}=`))
    ?.split("=")[1] ?? null;
}

/**
 * Sets the user's timezone cookie so server-rendered dates use local time.
 * Runs once on mount; triggers a refresh when the cookie is first set.
 */
export function TimezoneSync() {
  const router = useRouter();
  const didSet = useRef(false);

  useEffect(() => {
    if (didSet.current) return;

    const tz = getBrowserTimezone();
    if (!tz) return;

    let alreadySet = false;

    try {
      alreadySet = getCookieValue(document.cookie, TZ_COOKIE) === tz;
    } catch {
      return;
    }

    if (!alreadySet) {
      try {
        document.cookie = `${TZ_COOKIE}=${tz}; path=/; max-age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
      } catch {
        return;
      }
      didSet.current = true;
      router.refresh();
    }
  }, [router]);

  return null;
}
