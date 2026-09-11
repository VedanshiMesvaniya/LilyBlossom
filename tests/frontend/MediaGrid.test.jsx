import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MediaGrid } from "../../src/components/MediaGrid.jsx";

const SAMPLE_ITEMS = [
  { slug: "a-show", type: "series", title: "A Show", year: 2024, country: "KR", posterUrl: null, releaseStatus: "Airing" },
  { slug: "a-movie", type: "movie", title: "A Movie", year: 2023, country: "JP", posterUrl: null, releaseStatus: "Completed" }
];

function renderGrid(props) {
  return render(
    <MemoryRouter>
      <MediaGrid items={[]} emptyLabel="Nothing here." {...props} />
    </MemoryRouter>
  );
}

describe("MediaGrid", () => {
  it("shows an error message and nothing else when error is set", () => {
    renderGrid({ error: "Something broke", items: SAMPLE_ITEMS });
    expect(screen.getByText(/could not load this list/i)).toBeInTheDocument();
    expect(screen.queryByText("A Show")).not.toBeInTheDocument();
  });

  it("shows skeleton placeholders while loading, not the empty label", () => {
    renderGrid({ loading: true });
    expect(screen.queryByText("Nothing here.")).not.toBeInTheDocument();
  });

  it("shows the empty label when there are no items and it is not loading", () => {
    renderGrid({ items: [] });
    expect(screen.getByText("Nothing here.")).toBeInTheDocument();
  });

  it("renders one card per item once loaded", () => {
    renderGrid({ items: SAMPLE_ITEMS });
    expect(screen.getByText("A Show")).toBeInTheDocument();
    expect(screen.getByText("A Movie")).toBeInTheDocument();
  });
});
