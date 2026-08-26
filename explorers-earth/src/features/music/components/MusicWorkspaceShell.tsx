import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export interface MusicWorkspaceShellProps {
  player: ReactNode; search: ReactNode; queue: ReactNode; history: ReactNode;
  loading?: boolean; stale?: boolean; empty?: boolean;
}

export function MusicWorkspaceShell({ player, search, queue, history, loading = false, stale = false, empty = false }: MusicWorkspaceShellProps) {
  const [tab, setTab] = useState<"queue" | "history">("queue");
  const [mobile, setMobile] = useState<"player" | "queue" | "search" | "more">("queue");
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const searchRegion = useRef<HTMLElement>(null);
  const [focusSearch, setFocusSearch] = useState(false);
  useEffect(() => {
    if (!focusSearch || mobile !== "search") return;
    searchRegion.current?.querySelector<HTMLElement>('input[type="search"], input, button, [tabindex]:not([tabindex="-1"])')?.focus();
    setFocusSearch(false);
  }, [focusSearch, mobile]);
  const choose = (next: "queue" | "history", focus = false) => { setTab(next); if (focus) tabs.current[next === "queue" ? 0 : 1]?.focus(); };
  const onKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + 2) % 2;
    const next = nextIndex === 0 ? "queue" : "history";
    choose(next, true);
  };
  return <div role="region" aria-label="Music workspace" aria-readonly={stale || undefined} className="relative max-w-full overflow-x-hidden pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">
    {loading && <p role="status" aria-live="polite" className="mb-3 text-sm text-dashboard-light">Refreshing Music…</p>}
    {stale && <p role="status" className="mb-3 rounded-xl border border-dashboard p-3 text-sm text-dashboard-light">Showing saved Music. Changes are unavailable until the connection returns.</p>}
    <section id="music-player-region" aria-label="Music player region" className={`${mobile === "player" ? "block" : "hidden"} sticky top-0 z-20 rounded-2xl border border-dashboard bg-dashboard-sidebar p-4 shadow-lg md:block md:p-5`}>{player}</section>
    <section ref={searchRegion} id="music-search-region" aria-label="Music search region" className={`${mobile === "search" ? "block" : "hidden"} mt-5 rounded-2xl border border-dashboard bg-dashboard-sidebar p-4 md:block md:p-5`}>{search}</section>
    {empty && <section className="mt-5 rounded-2xl border border-dashboard bg-dashboard-sidebar p-6 text-center"><h2 className="text-xl font-semibold">Your queue is ready</h2><p className="mt-2 text-dashboard-light">Find something you love and start listening.</p><button type="button" onClick={() => { setMobile("search"); setFocusSearch(true); }} className="mt-4 min-h-11 min-w-11 rounded-xl bg-dashboard-accent px-4 font-semibold text-[var(--dash-accent-text)]">Add your first song</button></section>}
    <section className={`${mobile === "queue" || mobile === "more" ? "block" : "hidden"} mt-5 md:block`}>
      <div role="tablist" aria-label="Music content" className="hidden gap-2 md:flex">
        {(["queue", "history"] as const).map((value, index) => <button key={value} ref={(node) => { tabs.current[index] = node; }} id={`music-${value}-tab`} role="tab" aria-selected={tab === value} aria-controls={`music-${value}-panel`} tabIndex={tab === value ? 0 : -1} type="button" onClick={() => choose(value)} onKeyDown={(event) => onKey(event, index)} className="min-h-11 min-w-11 rounded-xl px-4 focus-visible:ring-2">{value === "queue" ? "Queue" : "Recently played"}</button>)}
      </div>
      <div role="tabpanel" id={`music-${tab}-panel`} aria-labelledby={`music-${tab}-tab`} className="mt-3 rounded-2xl border border-dashboard bg-dashboard-sidebar p-4 md:p-5">{mobile === "more" || tab === "history" ? history : queue}</div>
    </section>
    <nav aria-label="Music workspace" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-dashboard bg-dashboard-sidebar pb-[env(safe-area-inset-bottom)] md:hidden">
      {(["player", "queue", "search", "more"] as const).map((value) => {
        const controls = value === "player" ? "music-player-region" : value === "search" ? "music-search-region" : value === "queue" ? "music-queue-panel" : "music-history-panel";
        return <button key={value} type="button" aria-controls={controls} aria-current={mobile === value ? "page" : undefined} onClick={() => { setMobile(value); if (value === "queue") choose("queue"); if (value === "more") choose("history"); }} className="min-h-11 min-w-11 px-2 py-3 text-sm capitalize focus-visible:ring-2">{value[0].toUpperCase() + value.slice(1)}</button>;
      })}
    </nav>
  </div>;
}
