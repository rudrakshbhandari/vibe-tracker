"use client";

import Link from "next/link";
import { useState } from "react";
import { formatDateLabel } from "@/lib/format-date-label";

type SocialInviteCardProps = {
  token: string;
  inviter: {
    login: string;
    displayName: string | null;
  };
  status: string;
  expiresAt: string;
};

export function SocialInviteCard({
  token,
  inviter,
  status,
  expiresAt,
}: SocialInviteCardProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function respond(action: "accept" | "decline") {
    setSubmitting(true);
    setMessage(null);

    const response = await fetch("/api/social/friends/respond", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token,
        action,
      }),
    });

    const payload = (await response.json()) as { error?: string; status?: string };
    setSubmitting(false);

    if (!response.ok) {
      setMessage(payload.error ?? "Unable to respond to this invite.");
      return;
    }

    setMessage(action === "accept" ? "You are connected now." : "Invite declined.");
  }

  return (
    <div className="dashboard-shell">
      <div className="space-y-3">
        <span className="eyebrow eyebrow-subtle">Social invite</span>
        <h1 className="page-title">Join @{inviter.login}&apos;s circle.</h1>
        <p className="page-description">
          {inviter.displayName ?? inviter.login} wants to compare shipped-work momentum with you. This link expires on {formatDateLabel(expiresAt)}.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          className="button-primary"
          onClick={() => void respond("accept")}
          disabled={submitting || status !== "PENDING"}
        >
          Join circle
        </button>
        <button
          type="button"
          className="button-secondary"
          onClick={() => void respond("decline")}
          disabled={submitting || status !== "PENDING"}
        >
          Not now
        </button>
        <Link href="/social" className="button-secondary">
          Back to social
        </Link>
      </div>

      <p className="mt-4 text-sm text-muted">
        {message ??
          (status === "PENDING"
            ? "Accept to create the friend link on both sides."
            : `This invite is ${status.toLowerCase()}.`)}
      </p>
    </div>
  );
}
