"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

const TZ_COOKIE = "tz";
const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

/**
 * Sets the user's timezone cookie so server-rendered dates use local time.
 * Runs once on mount; triggers a refresh when the cookie is first set.
 */
export function TimezoneSync() {
  const router = useRouter();
  const didSet = useRef(false);

  useEffect(() => {
    if (didSet.current) return;

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz) return;

    const existing = document.cookie
      .split("; ")
      .find((c) => c.startsWith(`${TZ_COOKIE}=`));
    const alreadySet = existing?.split("=")[1] === tz;

    if (!alreadySet) {
      document.cookie = `${TZ_COOKIE}=${tz}; path=/; max-age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
      didSet.current = true;
      router.refresh();
    }
  }, [router]);

  return null;
}
