import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export interface MusicWorkspaceShellProps {
  player: ReactNode; search: ReactNode; queue: ReactNode; history: ReactNode;
  guestControls?: ReactNode; playlists?: ReactNode;
  loading?: boolean; stale?: boolean; empty?: boolean;
}

export function MusicWorkspaceShell({ player, search, queue, history, guestControls, playlists, loading = false, stale = false, empty = false }: MusicWorkspaceShellProps) {
  const definitions = [{ value: "queue", label: "Queue" }, { value: "guest-controls", label: "Guest controls" }, { value: "history", label: "Recent" }, { value: "playlists", label: "Playlists" }] as const;
  type Tab = typeof definitions[number]["value"];
  const [tab, setTab] = useState<Tab>("queue");
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const searchRegion = useRef<HTMLElement>(null);
  const choose = (next: Tab, focus = false) => { setTab(next); if (focus) tabs.current[definitions.findIndex(({ value }) => value === next)]?.focus(); };
  const onKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? definitions.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + definitions.length) % definitions.length;
    choose(definitions[nextIndex].value, true);
  };
  const panel = tab === "queue" ? queue : tab === "guest-controls" ? guestControls : tab === "history" ? history : playlists;
  return <div role="region" aria-label="Music workspace" aria-readonly={stale || undefined} className="relative max-w-full overflow-x-hidden pb-4 md:pb-0">
    {loading && <p role="status" aria-live="polite" className="mb-3 text-sm text-dashboard-light">Refreshing Music…</p>}
    {stale && <p role="status" className="mb-3 rounded-xl border border-dashboard p-3 text-sm text-dashboard-light">Showing saved Music. Changes are unavailable until the connection returns.</p>}
    <section ref={searchRegion} id="music-search-region" aria-label="Music search region" className="rounded-2xl border border-dashboard bg-dashboard-sidebar p-4 md:p-5">{search}</section>
    <section id="music-player-region" aria-label="Music player region" className="sticky top-16 z-20 mt-5 rounded-2xl border border-dashboard bg-dashboard-sidebar p-4 shadow-lg md:static md:p-5">{player}</section>
    {empty && <section className="mt-5 rounded-2xl border border-dashboard bg-dashboard-sidebar p-6 text-center"><h2 className="text-xl font-semibold">Your queue is ready</h2><p className="mt-2 text-dashboard-light">Find something you love and start listening.</p><button type="button" onClick={() => searchRegion.current?.querySelector<HTMLElement>('input[type="search"], input, button, [tabindex]:not([tabindex="-1"])')?.focus()} className="mt-4 min-h-11 min-w-11 rounded-xl bg-dashboard-accent px-4 font-semibold text-[var(--dash-accent-text)]">Add your first song</button></section>}
    <section className="mt-5">
      <div role="tablist" aria-label="Music content" className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:thin]">
        {definitions.map(({ value, label }, index) => <button key={value} ref={(node) => { tabs.current[index] = node; }} id={`music-${value}-tab`} role="tab" aria-selected={tab === value} aria-controls={`music-${value}-panel`} tabIndex={tab === value ? 0 : -1} type="button" onClick={() => choose(value)} onKeyDown={(event) => onKey(event, index)} className="min-h-11 min-w-11 shrink-0 rounded-xl px-4 focus-visible:ring-2">{label}</button>)}
      </div>
      <div role="tabpanel" id={`music-${tab}-panel`} aria-labelledby={`music-${tab}-tab`} className="mt-3 rounded-2xl border border-dashboard bg-dashboard-sidebar p-4 md:p-5">{panel}</div>
    </section>
  </div>;
}
