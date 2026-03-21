"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function ActivitySyncRefresh({ active }: { active: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!active) {
      return;
    }

    let intervalId: number | null = null;

    function startPolling() {
      if (document.visibilityState === "hidden" || intervalId !== null) return;
      intervalId = window.setInterval(() => {
        if (document.visibilityState !== "hidden") {
          router.refresh();
        }
      }, 8000);
    }

    function stopPolling() {
      if (intervalId !== null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        stopPolling();
      } else {
        startPolling();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    startPolling();

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      stopPolling();
    };
  }, [active, router]);

  return null;
}
