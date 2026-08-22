import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  motion: new Proxy({}, {
    get: (_target, tag: string) => ({ children, initial: _initial, animate: _animate, exit: _exit, transition: _transition, ...props }: any) => {
      const Tag = tag as keyof JSX.IntrinsicElements;
      return <Tag {...props}>{children}</Tag>;
    },
  }),
}));
vi.mock("../../components/ui/MediaViewer", () => ({ default: () => null }));
vi.mock("../../hooks/useMediaViewer", () => ({
  useMediaViewer: () => ({ isOpen: false, currentIndex: 0, openViewer: vi.fn(), closeViewer: vi.fn() }),
  convertToMediaItems: (items: unknown[]) => items,
}));

import AppDetailModal from "../AppsAndTools/components/public/AppDetailModal";
import BookDetailModal from "../Books/components/public/BookDetailModal";
import GameDetailModal from "../Games/components/public/GameDetailModal";
import MovieDetailModal from "../Movies/components/public/MovieDetailModal";
import PersonDetailModal from "../People/components/public/PersonDetailModal";
import ProductDetailModal from "../Products/components/public/ProductDetailModal";

const cases = [
  {
    family: "app",
    documentId: "app-doc-1",
    renderModal: (onShare: (documentId: string) => void) => (
      <AppDetailModal app={{ documentId: "app-doc-1", title: "Focus App", screenshots: [], platforms: [] } as any} open onClose={vi.fn()} onShare={onShare} />
    ),
  },
  {
    family: "product",
    documentId: "product-doc-1",
    renderModal: (onShare: (documentId: string) => void) => (
      <ProductDetailModal product={{ documentId: "product-doc-1", title: "Field Camera", images: [], specifications: {} } as any} open onClose={vi.fn()} onShare={onShare} />
    ),
  },
  {
    family: "person",
    documentId: "person-doc-1",
    renderModal: (onShare: (documentId: string) => void) => (
      <PersonDetailModal person={{ documentId: "person-doc-1", full_name: "Asha Rao", media_details: { imageDetails: [] } } as any} open onClose={vi.fn()} onShare={onShare} />
    ),
  },
  {
    family: "movie",
    documentId: "movie-doc-1",
    renderModal: (onShare: (documentId: string) => void) => (
      <MovieDetailModal movie={{ documentId: "movie-doc-1", title: "Arrival", genres: [], Media: [], watch_providers: [], media_details: { imageDetails: [] } } as any} open onClose={vi.fn()} onShare={onShare} />
    ),
  },
  {
    family: "book",
    documentId: "book-doc-1",
    renderModal: (onShare: (documentId: string) => void) => (
      <BookDetailModal book={{ documentId: "book-doc-1", title: "Kindred", authors: [], Media: [], buy_links: [], media_details: { imageDetails: [] } } as any} open onClose={vi.fn()} onShare={onShare} />
    ),
  },
  {
    family: "game",
    documentId: "game-doc-1",
    renderModal: (onShare: (documentId: string) => void) => (
      <GameDetailModal game={{ documentId: "game-doc-1", title: "Journey", genres: [], platforms: [], screenshot_ids: [] } as any} open onClose={vi.fn()} onShare={onShare} />
    ),
  },
] as const;

describe("public recommendation detail modal analytics", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
  });

  it.each(cases)("reports the stable $family document ID before sharing", ({ documentId, renderModal }) => {
    const onShare = vi.fn();
    render(renderModal(onShare));

    fireEvent.click(screen.getByRole("button", { name: "Share" }));

    expect(onShare).toHaveBeenCalledWith(documentId);
    expect(onShare.mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(navigator.share).mock.invocationCallOrder[0]);
  });
});
