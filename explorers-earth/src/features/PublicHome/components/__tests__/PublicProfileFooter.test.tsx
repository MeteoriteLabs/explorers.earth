import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import PublicProfileFooter from '../PublicProfileFooter';

describe('PublicProfileFooter', () => {
  it('renders a full cardless brand mark when brandingStyle is enabled', () => {
    render(
      <BrowserRouter>
        <PublicProfileFooter brandingStyle="enabled" />
      </BrowserRouter>
    );
    expect(screen.getByRole("img", { name: "explorers.earth" })).toBeVisible();
    expect(screen.queryByTestId("footer-brand-badge")).not.toBeInTheDocument();
    
    // Check home link around logo has minimum 44px target
    const brandLink = screen.getByRole("link", { name: "explorers.earth" });
    expect(brandLink.className).toContain("min-w-[44px]");
    expect(brandLink.className).toContain("min-h-[44px]");
  });

  it('renders footer navigation links with proper aria-label and no hard-coded text-white when enabled', () => {
    render(
      <BrowserRouter>
        <PublicProfileFooter brandingStyle="enabled" />
      </BrowserRouter>
    );
    const nav = screen.getByRole("navigation", { name: "Footer" });
    expect(nav).toBeInTheDocument();

    const links = screen.getAllByRole("link");
    // Should have brand link + 3 footer links (Create your profile, Report, Privacy)
    expect(links.length).toBe(4);

    // Assert footer links meet minimum 44px target size requirements and contain no hard-coded text-white
    links.forEach((link) => {
      expect(link.className).toContain("min-h-[44px]");
      expect(link.className).not.toContain("text-white");
      expect(link.className).not.toContain("hover:text-white");
    });

    // Check separators have aria-hidden
    const separators = nav.querySelectorAll("span[aria-hidden='true']");
    expect(separators.length).toBeGreaterThanOrEqual(2);
  });

  it('renders logo only when brandingStyle is minimal', () => {
    render(
      <BrowserRouter>
        <PublicProfileFooter brandingStyle="minimal" />
      </BrowserRouter>
    );
    expect(screen.getByRole("img", { name: "explorers.earth" })).toBeVisible();
    expect(screen.queryByRole("navigation", { name: "Footer" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Create your profile/i)).not.toBeInTheDocument();
  });

  it('renders no content or whitespace when brandingStyle is disabled', () => {
    const { container } = render(
      <BrowserRouter>
        <PublicProfileFooter brandingStyle="disabled" />
      </BrowserRouter>
    );
    expect(container.firstChild).toBeNull();
  });
});
