import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("../../src/lib/adminApi.js", () => ({
  adminFetch: vi.fn().mockResolvedValue({})
}));

vi.mock("../../src/lib/supabaseClient.js", () => ({
  supabase: { from: vi.fn() }
}));

import { adminFetch } from "../../src/lib/adminApi.js";
import { ReviewItem } from "../../src/pages/admin/AdminReviewPage.jsx";

const BASE_ITEM = {
  id: "ci-1",
  raw_title: "A Brand New Show",
  state: "uncertain",
  match_confidence: 0.62,
  payload: {
    title: "A Brand New Show",
    type: "Series",
    year: 2025,
    status: "Announced",
    description: "Original description.",
    poster_url: "https://example.invalid/poster.jpg"
  }
};

beforeEach(() => {
  adminFetch.mockClear();
});

describe("ReviewItem", () => {
  it("publishes with no body when no edits are made", async () => {
    render(<ReviewItem item={BASE_ITEM} onResolved={() => {}} />);
    fireEvent.click(screen.getByText("Publish"));

    await waitFor(() => expect(adminFetch).toHaveBeenCalledTimes(1));
    expect(adminFetch).toHaveBeenCalledWith("/review/ci-1/publish", { method: "POST" });
  });

  it("shows Save & merge only for an uncertain match", () => {
    render(<ReviewItem item={BASE_ITEM} onResolved={() => {}} />);
    fireEvent.click(screen.getByText("Edit"));
    expect(screen.getByText("Save & merge")).toBeInTheDocument();
  });

  it("hides Save & merge and the Merge button for a non uncertain item", () => {
    render(<ReviewItem item={{ ...BASE_ITEM, state: "new" }} onResolved={() => {}} />);
    expect(screen.queryByText("Merge")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Edit"));
    expect(screen.queryByText("Save & merge")).not.toBeInTheDocument();
  });

  it("sends the edited fields as the publish request body", async () => {
    render(<ReviewItem item={BASE_ITEM} onResolved={() => {}} />);
    fireEvent.click(screen.getByText("Edit"));

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "The Corrected Title" } });
    fireEvent.change(screen.getByLabelText("Year"), { target: { value: "2026" } });
    fireEvent.click(screen.getByText("Save & publish"));

    await waitFor(() => expect(adminFetch).toHaveBeenCalledTimes(1));
    const [path, options] = adminFetch.mock.calls[0];
    expect(path).toBe("/review/ci-1/publish");
    const body = JSON.parse(options.body);
    expect(body.title).toBe("The Corrected Title");
    expect(body.year).toBe(2026);
  });

  it("sends edits to the merge endpoint when Save & merge is pressed", async () => {
    render(<ReviewItem item={BASE_ITEM} onResolved={() => {}} />);
    fireEvent.click(screen.getByText("Edit"));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "The Corrected Title" } });
    fireEvent.click(screen.getByText("Save & merge"));

    await waitFor(() => expect(adminFetch).toHaveBeenCalledTimes(1));
    const [path] = adminFetch.mock.calls[0];
    expect(path).toBe("/review/ci-1/merge");
  });
});
