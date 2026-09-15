import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("../../src/lib/adminApi.js", () => ({
  adminFetch: vi.fn().mockResolvedValue({ announcement: { id: "ann-new", title: "Created", status: "draft" } })
}));

vi.mock("../../src/lib/supabaseClient.js", () => ({
  supabase: { from: vi.fn() }
}));

import { adminFetch } from "../../src/lib/adminApi.js";
import { AnnouncementRow } from "../../src/pages/admin/AdminAnnouncementsPage.jsx";

const BASE_ITEM = {
  id: "ann-1",
  title: "Old title",
  summary: "Old summary",
  content: "Old content",
  cover_image: "",
  announcement_type: "Trailer",
  status: "draft"
};

beforeEach(() => {
  adminFetch.mockClear();
  adminFetch.mockResolvedValue({ announcement: { ...BASE_ITEM, title: "Corrected title" } });
});

describe("AnnouncementRow", () => {
  it("toggles status with a PATCH that only sends the status field", async () => {
    render(<AnnouncementRow item={BASE_ITEM} onChanged={() => {}} />);
    fireEvent.click(screen.getByText("Publish"));

    await waitFor(() => expect(adminFetch).toHaveBeenCalledTimes(1));
    const [path, options] = adminFetch.mock.calls[0];
    expect(path).toBe("/announcements");
    expect(options.method).toBe("PATCH");
    expect(JSON.parse(options.body)).toEqual({ id: "ann-1", status: "published" });
  });

  it("edits content fields and sends them in a PATCH keyed by id", async () => {
    const onChanged = vi.fn();
    render(<AnnouncementRow item={BASE_ITEM} onChanged={onChanged} />);

    fireEvent.click(screen.getByText("Edit"));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Corrected title" } });
    fireEvent.click(screen.getByText("Save changes"));

    await waitFor(() => expect(adminFetch).toHaveBeenCalledTimes(1));
    const [path, options] = adminFetch.mock.calls[0];
    expect(path).toBe("/announcements");
    const body = JSON.parse(options.body);
    expect(body.id).toBe("ann-1");
    expect(body.title).toBe("Corrected title");
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });
});
