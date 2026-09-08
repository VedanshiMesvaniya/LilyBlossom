"use client";

import { useState, useTransition } from "react";
import { WATCH_STATUS_LABELS, type WatchStatus } from "@/lib/constants";

const STATUSES: WatchStatus[] = ["plan_to_watch", "watching", "watched", "dropped"];

/**
 * Lets a signed-in user set their personal status for one title.
 * Calls the authenticated API route; the global title record is never
 * touched from here (see docs/DATABASE.md, "personal state" section).
 */
export function TrackingControls({
  titleId,
  initialStatus
}: {
  titleId: string;
  initialStatus: WatchStatus | null;
}) {
  const [status, setStatus] = useState<WatchStatus | null>(initialStatus);
  const [isPending, startTransition] = useTransition();

  function handleSelect(next: WatchStatus) {
    startTransition(async () => {
      const response = await fetch(`/api/me/list/${titleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next })
      });
      if (response.ok) {
        setStatus(next);
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-2 font-ui text-sm">
      {STATUSES.map((option) => (
        <button
          key={option}
          type="button"
          disabled={isPending}
          onClick={() => handleSelect(option)}
          className={`rounded-full border px-3 py-1.5 ${
            status === option
              ? "border-primary bg-primary text-white"
              : "border-border bg-surface text-text-primary hover:border-primary"
          }`}
        >
          {WATCH_STATUS_LABELS[option]}
        </button>
      ))}
    </div>
  );
}
