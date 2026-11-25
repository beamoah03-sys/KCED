import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Inbox } from "lucide-react";
import { DataTable, ListState } from "@/components/page";
import { UrgencyBadge } from "@/features/service_request/components/UrgencyBadge";

describe("ListState", () => {
  const props = { onRetry: vi.fn(), emptyIcon: Inbox, emptyTitle: "Nothing here", emptyText: "Add one." };

  it("shows the error and a working Retry button", () => {
    render(
      <ListState {...props} loading={false} error="Network down" empty={false}>
        <p>content</p>
      </ListState>,
    );
    expect(screen.getByText("Network down")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(props.onRetry).toHaveBeenCalled();
  });

  it("shows the empty state, then the content", () => {
    const { rerender } = render(
      <ListState {...props} loading={false} error={null} empty>
        <p>content</p>
      </ListState>,
    );
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
    rerender(
      <ListState {...props} loading={false} error={null} empty={false}>
        <p>content</p>
      </ListState>,
    );
    expect(screen.getByText("content")).toBeInTheDocument();
  });
});

describe("DataTable", () => {
  it("renders rows and calls onRowClick", () => {
    const onRowClick = vi.fn();
    render(
      <DataTable
        rows={[{ id: "1", name: "Unity Hall" }]}
        rowKey={(r) => r.id}
        onRowClick={onRowClick}
        columns={[{ header: "Name", cell: (r) => r.name }]}
      />,
    );
    fireEvent.click(screen.getByText("Unity Hall"));
    expect(onRowClick).toHaveBeenCalledWith({ id: "1", name: "Unity Hall" });
  });
});

describe("UrgencyBadge", () => {
  it("hides 'normal' when quiet and shows emergencies", () => {
    const { container } = render(<UrgencyBadge urgency="normal" quiet />);
    expect(container).toBeEmptyDOMElement();
    render(<UrgencyBadge urgency="emergency" />);
    expect(screen.getByText("Emergency")).toBeInTheDocument();
  });
});
