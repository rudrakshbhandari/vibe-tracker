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
    let processing = false;

    async function processSyncQueue() {
      if (processing || document.visibilityState === "hidden") {
        return;
      }

      processing = true;

      try {
        await fetch("/api/github/activity-sync/process", {
          method: "POST",
          cache: "no-store",
        });
      } catch {
        // Best-effort worker tick. The dashboard refresh below keeps the UI honest.
      } finally {
        router.refresh();
        processing = false;
      }
    }

    function startPolling() {
      if (document.visibilityState === "hidden" || intervalId !== null) return;
      void processSyncQueue();
      intervalId = window.setInterval(() => {
        if (document.visibilityState !== "hidden") {
          void processSyncQueue();
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
