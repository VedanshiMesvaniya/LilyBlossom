"use client";

import { useState } from "react";

export function RunCrawlButton() {
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");

  async function handleClick() {
    setStatus("running");
    try {
      const response = await fetch("/api/admin/crawler/run", { method: "POST" });
      setStatus(response.ok ? "done" : "error");
    } catch {
      setStatus("error");
    }
  }

  const label =
    status === "running" ? "Starting crawler..." : status === "done" ? "Completed" : status === "error" ? "Failed, try again" : "Run Crawl Now";

  return (
    <button
      onClick={handleClick}
      disabled={status === "running"}
      className="rounded-full bg-primary px-4 py-2 text-sm text-white hover:bg-primary-hover disabled:opacity-60"
    >
      {label}
    </button>
  );
}
