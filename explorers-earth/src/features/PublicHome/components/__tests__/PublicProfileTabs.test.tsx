import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import PublicProfileTabs, { type PublicProfileTabDefinition } from "../PublicProfileTabs";

const DummyIcon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;

const tabs: PublicProfileTabDefinition[] = [
  { id: "recommendations", label: "Recommendations", icon: DummyIcon },
  { id: "gallery", label: "Gallery", icon: DummyIcon },
  { id: "business", label: "Business Details", icon: DummyIcon },
];

describe("PublicProfileTabs", () => {
  let mockScrollIntoView: vi.Mock;

  beforeEach(() => {
    mockScrollIntoView = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = mockScrollIntoView;
    document.dir = "ltr";
  });

  afterEach(() => {
    document.dir = "ltr";
    vi.restoreAllMocks();
  });

  it("keeps the active tab visible and supports arrow navigation", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<PublicProfileTabs tabs={tabs} activeTab="recommendations" onChange={onChange} />);

    const recommendations = screen.getByRole("tab", { name: "Recommendations" });
    const gallery = screen.getByRole("tab", { name: "Gallery" });
    const business = screen.getByRole("tab", { name: "Business Details" });

    // Active tab has roving tabIndex 0, inactive tabs have -1
    expect(recommendations).toHaveAttribute("tabindex", "0");
    expect(gallery).toHaveAttribute("tabindex", "-1");
    expect(business).toHaveAttribute("tabindex", "-1");

    expect(recommendations).toHaveAttribute("aria-selected", "true");
    expect(gallery).toHaveAttribute("aria-selected", "false");

    // Focus recommendations tab
    recommendations.focus();
    expect(recommendations).toHaveFocus();

    // ArrowRight moves to Gallery and automatically activates it
    await user.keyboard("{ArrowRight}");
    expect(gallery).toHaveFocus();
    expect(onChange).toHaveBeenCalledWith("gallery");
  });

  it("supports Home, End, and wraparound arrow navigation", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<PublicProfileTabs tabs={tabs} activeTab="recommendations" onChange={onChange} />);

    const recommendations = screen.getByRole("tab", { name: "Recommendations" });
    const gallery = screen.getByRole("tab", { name: "Gallery" });
    const business = screen.getByRole("tab", { name: "Business Details" });

    recommendations.focus();

    // End key moves to last tab
    await user.keyboard("{End}");
    expect(business).toHaveFocus();
    expect(onChange).toHaveBeenCalledWith("business");

    // Home key moves to first tab
    await user.keyboard("{Home}");
    expect(recommendations).toHaveFocus();
    expect(onChange).toHaveBeenCalledWith("recommendations");

    // ArrowLeft from first tab wraps around to last tab
    await user.keyboard("{ArrowLeft}");
    expect(business).toHaveFocus();
    expect(onChange).toHaveBeenCalledWith("business");
  });

  it("supports RTL layout arrow navigation without reversing DOM semantics twice", async () => {
    document.dir = "rtl";
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<PublicProfileTabs tabs={tabs} activeTab="recommendations" onChange={onChange} />);

    const recommendations = screen.getByRole("tab", { name: "Recommendations" });
    const gallery = screen.getByRole("tab", { name: "Gallery" });

    recommendations.focus();

    // In RTL, ArrowLeft moves forward (to Gallery)
    await user.keyboard("{ArrowLeft}");
    expect(gallery).toHaveFocus();
    expect(onChange).toHaveBeenCalledWith("gallery");

    // In RTL, ArrowRight moves backward
    await user.keyboard("{ArrowRight}");
    expect(recommendations).toHaveFocus();
    expect(onChange).toHaveBeenCalledWith("recommendations");
  });

  it("ensures tabs have stable ARIA roles and minimum 44px targets", () => {
    const onChange = vi.fn();
    render(<PublicProfileTabs tabs={tabs} activeTab="recommendations" onChange={onChange} />);

    const tablist = screen.getByRole("tablist", { name: "Profile sections" });
    expect(tablist).toBeInTheDocument();

    const allTabs = screen.getAllByRole("tab");
    expect(allTabs).toHaveLength(3);

    allTabs.forEach((tab) => {
      expect(tab).toHaveAttribute("id");
      expect(tab).toHaveAttribute("aria-controls");
      expect(tab.className).toContain("min-h-");
    });
  });

  it("scrolls focused tab into view for overflow handling", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<PublicProfileTabs tabs={tabs} activeTab="recommendations" onChange={onChange} />);

    const gallery = screen.getByRole("tab", { name: "Gallery" });

    await user.click(gallery);
    expect(onChange).toHaveBeenCalledWith("gallery");
    expect(mockScrollIntoView).toHaveBeenCalled();
  });
});
