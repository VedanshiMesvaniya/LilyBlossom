import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Pagination } from "../../src/components/Pagination.jsx";

describe("Pagination", () => {
  it("renders nothing when everything fits on one page", () => {
    const { container } = render(<Pagination page={1} pageSize={24} count={10} onPageChange={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("disables Previous on the first page and Next on the last page", () => {
    render(<Pagination page={1} pageSize={10} count={25} onPageChange={() => {}} />);
    expect(screen.getByText("Previous")).toBeDisabled();
    expect(screen.getByText("Next")).not.toBeDisabled();
  });

  it("calls onPageChange with the next page number", () => {
    const onPageChange = vi.fn();
    render(<Pagination page={2} pageSize={10} count={25} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByText("Next"));
    expect(onPageChange).toHaveBeenCalledWith(3);
    fireEvent.click(screen.getByText("Previous"));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });
});
