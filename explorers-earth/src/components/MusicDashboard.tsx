import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent, type RefObject } from "react";
import { Copy, ListMusic, Plus, Settings2 } from "lucide-react";
import { toast } from "sonner";
import type { TunesDashboardData } from "../hooks/useTunesDashboard";
import { musicWorkspaceClient } from "../hooks/useTunesDashboard";
import type { MusicPlaylist, MusicPublicationMode } from "../features/music/musicWorkspaceClient";
import { MusicClientError } from "../lib/localTunesApiClient";
import {
  completeMusicPublicationCommand,
  getOrCreateMusicPublicationCommand,
  type MusicPublicationOwnerScope,
} from "../features/music/musicPublicationCommandRegistry";

interface MusicDashboardProps {
  data: TunesDashboardData;
  scope: MusicPublicationOwnerScope;
  readOnly?: boolean;
}

const buttonClass = "min-h-11 min-w-11 rounded-xl px-4 text-sm font-semibold outline-none ring-offset-2 ring-offset-dashboard-bg focus-visible:ring-2 focus-visible:ring-dashboard-accent disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none";

function operationKey(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function WorkspaceDialog({
  title,
  description,
  children,
  onClose,
  opener,
  closeDisabled = false,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  onClose: () => void;
  opener: RefObject<HTMLButtonElement>;
  closeDisabled?: boolean;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const close = () => {
    if (closeDisabled) return;
    onClose();
  };

  useEffect(() => {
    const root = dialog.current;
    const first = root?.querySelector<HTMLElement>("[data-autofocus]");
    first?.focus();
    return () => { opener.current?.focus(); };
  }, [opener]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(dialog.current?.querySelectorAll<HTMLElement>(
      "button:not([disabled]), input:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])",
    ) ?? []);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/70 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onKeyDown={onKeyDown}
        className="dashboard-theme dashboard-theme-dark max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-dashboard bg-dashboard-sidebar p-5 shadow-2xl sm:p-6"
      >
        <h2 id={titleId} className="text-xl font-semibold text-dashboard">{title}</h2>
        <p id={descriptionId} className="mt-2 text-base text-dashboard-light">{description}</p>
        {children}
      </div>
    </div>
  );
}

function CreatePlaylistDialog({ onClose, opener, onCreated }: { onClose: () => void; opener: RefObject<HTMLButtonElement>; onCreated: () => Promise<unknown> }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await musicWorkspaceClient.createPlaylist(name.trim(), description.trim() || null, operationKey("playlist-create"));
      await onCreated();
      toast.success("Playlist created.");
      onClose();
    } catch {
      toast.error("Music is temporarily unavailable.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <WorkspaceDialog title="Create playlist" description="Name a playlist for the music you want to keep together." onClose={onClose} opener={opener}>
      <form onSubmit={submit} className="mt-5 space-y-4">
        <label className="block text-sm text-dashboard-light">
          Playlist name
          <input data-autofocus value={name} onChange={(event) => setName(event.target.value)} maxLength={120} required className="mt-2 min-h-11 w-full rounded-xl border border-dashboard bg-dashboard-muted px-3 text-dashboard outline-none focus-visible:ring-2 focus-visible:ring-dashboard-accent" />
        </label>
        <label className="block text-sm text-dashboard-light">
          Description <span className="text-dashboard-muted">(optional)</span>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} rows={3} className="mt-2 w-full rounded-xl border border-dashboard bg-dashboard-muted p-3 text-dashboard outline-none focus-visible:ring-2 focus-visible:ring-dashboard-accent" />
        </label>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className={`${buttonClass} bg-dashboard-muted text-dashboard`}>Cancel</button>
          <button type="submit" disabled={saving || !name.trim()} className={`${buttonClass} bg-dashboard-accent text-[var(--dash-accent-text)]`}>{saving ? "Creating…" : "Create playlist"}</button>
        </div>
      </form>
    </WorkspaceDialog>
  );
}

function RenamePlaylistDialog({
  playlist,
  onClose,
  opener,
  onRenamed,
}: {
  playlist: MusicPlaylist;
  onClose: () => void;
  opener: RefObject<HTMLButtonElement>;
  onRenamed: () => Promise<unknown>;
}) {
  const [name, setName] = useState(playlist.name);
  const [description, setDescription] = useState(playlist.description ?? "");
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await musicWorkspaceClient.renamePlaylist(
        playlist.id,
        name.trim(),
        description.trim() || null,
        operationKey("playlist-rename"),
      );
      await onRenamed();
      toast.success("Playlist renamed.");
      onClose();
    } catch {
      toast.error("Music is temporarily unavailable.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <WorkspaceDialog title="Rename playlist" description="Update this playlist name and description." onClose={onClose} opener={opener} closeDisabled={saving}>
      <form onSubmit={submit} className="mt-5 space-y-4">
        <label className="block text-sm text-dashboard-light">
          Playlist name
          <input data-autofocus value={name} onChange={(event) => setName(event.target.value)} maxLength={120} required className="mt-2 min-h-11 w-full rounded-xl border border-dashboard bg-dashboard-muted px-3 text-dashboard outline-none focus-visible:ring-2 focus-visible:ring-dashboard-accent" />
        </label>
        <label className="block text-sm text-dashboard-light">
          Description <span className="text-dashboard-muted">(optional)</span>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} rows={3} className="mt-2 w-full rounded-xl border border-dashboard bg-dashboard-muted p-3 text-dashboard outline-none focus-visible:ring-2 focus-visible:ring-dashboard-accent" />
        </label>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={saving} className={`${buttonClass} bg-dashboard-muted text-dashboard`}>Cancel</button>
          <button type="submit" disabled={saving || !name.trim()} className={`${buttonClass} bg-dashboard-accent text-[var(--dash-accent-text)]`}>{saving ? "Saving…" : "Save playlist"}</button>
        </div>
      </form>
    </WorkspaceDialog>
  );
}

const publicationCopy: Record<MusicPublicationMode, string> = {
  private: "Only you can open this Music workspace.",
  unlisted: "Anyone with the private link can view shared playlists. The page won’t appear in search.",
  public: "Anyone can view shared playlists, and the page can appear in search.",
};

function SharingDialog({ data, scope, onClose, opener }: { data: TunesDashboardData; scope: MusicPublicationOwnerScope; onClose: () => void; opener: RefObject<HTMLButtonElement> }) {
  const current = data.dashboard?.publication;
  const [mode, setMode] = useState<MusicPublicationMode>(current?.mode ?? "private");
  const [capability, setCapability] = useState<string>();
  const [saving, setSaving] = useState(false);
  const publicSlug = current?.publicSlug ?? "";
  const base = `${window.location.origin}/music/share/${encodeURIComponent(publicSlug)}`;
  const shareLink = mode === "public" ? base : mode === "unlisted" && capability ? `${base}#access=${capability}` : undefined;
  const save = async () => {
    setSaving(true);
    const command = getOrCreateMusicPublicationCommand(scope, mode);
    try {
      const result = await musicWorkspaceClient.setPublication(mode, command.key);
      completeMusicPublicationCommand(scope, mode, command.key);
      setCapability("capability" in result ? result.capability : undefined);
      await data.refetch();
      toast.success(mode === "public" ? "Music is public." : mode === "unlisted" ? "Private link created." : "Music is private.");
      if (mode !== "unlisted") onClose();
    } catch (cause) {
      if (
        cause instanceof MusicClientError
        && (cause.code === "REQUEST_INVALID" || cause.upstreamCode === "PUBLICATION_REPLAY_EXPIRED")
      ) {
        completeMusicPublicationCommand(scope, mode, command.key);
      }
      toast.error("Music is temporarily unavailable.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <WorkspaceDialog title="Music sharing" description="Choose who can view the playlists you share." onClose={onClose} opener={opener} closeDisabled={saving}>
      <fieldset className="mt-5 space-y-2">
        <legend className="sr-only">Visibility mode</legend>
        {(["private", "unlisted", "public"] as const).map((value, index) => (
          <label key={value} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-dashboard bg-dashboard-bg/40 px-3 text-dashboard focus-within:ring-2 focus-within:ring-dashboard-accent">
            <input data-autofocus={index === 0 || undefined} type="radio" name="music-publication" value={value} checked={mode === value} disabled={saving} onChange={() => { setMode(value); setCapability(undefined); }} className="h-5 w-5 accent-[var(--dash-accent)]" />
            <span>{value[0].toUpperCase() + value.slice(1)}</span>
          </label>
        ))}
      </fieldset>
      <div className="mt-4 rounded-xl bg-dashboard-muted p-4">
        <p className="text-base text-dashboard-light">{publicationCopy[mode]}</p>
        {mode === "unlisted" && !shareLink && <p className="mt-2 text-base text-dashboard-muted">Save to create a new private link. Creating another link replaces the previous one.</p>}
        {shareLink && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-2">
              <input readOnly aria-label="Music share link" value={shareLink} className="min-h-11 min-w-0 flex-1 rounded-xl border border-dashboard bg-dashboard-bg px-3 text-base text-dashboard" />
              <button type="button" aria-label="Copy Music link" onClick={() => void navigator.clipboard.writeText(shareLink)} className={`${buttonClass} bg-dashboard-bg text-dashboard`}><Copy className="h-4 w-4" /></button>
            </div>
            <a href={shareLink} target="_blank" rel="noopener noreferrer" aria-label="Preview public Music page" className={`${buttonClass} inline-flex items-center border border-dashboard bg-dashboard-bg text-dashboard`}>Preview</a>
          </div>
        )}
      </div>
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} disabled={saving} className={`${buttonClass} bg-dashboard-muted text-dashboard`}>Cancel</button>
        <button type="button" onClick={() => void save()} disabled={saving} className={`${buttonClass} bg-dashboard-accent text-[var(--dash-accent-text)]`}>{saving ? "Saving…" : "Save sharing"}</button>
      </div>
    </WorkspaceDialog>
  );
}

function PlaylistPanel({ playlist, readOnly, onChanged, announce }: { playlist: MusicPlaylist; readOnly: boolean; onChanged: () => Promise<unknown>; announce: (message: string) => void }) {
  const [renameOpen, setRenameOpen] = useState(false);
  const renameOpener = useRef<HTMLButtonElement>(null);
  const setVisible = async () => {
    try {
      await musicWorkspaceClient.setPlaylistVisibility(playlist.id, !playlist.isVisibleToGuests, operationKey("playlist-visibility"));
      await onChanged();
    } catch { toast.error("Music is temporarily unavailable."); }
  };
  const move = async (songId: number, to: number, title: string) => {
    if (to < 0 || to >= playlist.songs.length) return;
    try {
      await musicWorkspaceClient.reorderPlaylistSong(playlist.id, songId, to, operationKey("playlist-reorder"));
      announce(`${title} moved to position ${to + 1}.`);
      await onChanged();
    } catch { toast.error("Music is temporarily unavailable."); }
  };
  return (
    <section role="tabpanel" aria-label={playlist.name} className="rounded-2xl border border-dashboard bg-dashboard-sidebar p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><h3 className="font-semibold text-dashboard">{playlist.name}</h3>{playlist.description && <p className="mt-1 text-sm text-dashboard-muted">{playlist.description}</p>}</div>
        <div className="flex flex-wrap gap-2">
          <button ref={renameOpener} type="button" onClick={() => setRenameOpen(true)} disabled={readOnly} className={`${buttonClass} bg-dashboard-muted text-dashboard`}>Rename playlist</button>
          <button type="button" onClick={() => void setVisible()} disabled={readOnly} aria-pressed={playlist.isVisibleToGuests} className={`${buttonClass} bg-dashboard-muted text-dashboard`}>
            {playlist.isVisibleToGuests ? "Shared" : "Private"}
          </button>
        </div>
      </div>
      {playlist.songs.length === 0 ? <p className="mt-6 text-sm text-dashboard-muted">This playlist is empty.</p> : (
        <ol className="mt-5 space-y-2">
          {playlist.songs.map((song, index) => (
            <li key={song.id} className="flex items-center gap-3 rounded-xl bg-dashboard-muted/60 p-2">
              <img src={song.thumbnailUrl} alt="" className="h-11 w-11 rounded-lg object-cover" />
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-dashboard">{song.title}</p><p className="truncate text-xs text-dashboard-muted">{song.artist}</p></div>
              <div className="flex gap-1">
                <button type="button" aria-label={`Move ${song.title} up`} disabled={readOnly || index === 0} onClick={() => void move(song.id, index - 1, song.title)} className={`${buttonClass} bg-dashboard-bg px-2 text-dashboard`}>↑</button>
                <button type="button" aria-label={`Move ${song.title} down`} disabled={readOnly || index === playlist.songs.length - 1} onClick={() => void move(song.id, index + 1, song.title)} className={`${buttonClass} bg-dashboard-bg px-2 text-dashboard`}>↓</button>
              </div>
            </li>
          ))}
        </ol>
      )}
      {renameOpen && (
        <RenamePlaylistDialog
          playlist={playlist}
          opener={renameOpener}
          onClose={() => setRenameOpen(false)}
          onRenamed={onChanged}
        />
      )}
    </section>
  );
}

export default function MusicDashboard({ data, scope, readOnly = false }: MusicDashboardProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [sharingOpen, setSharingOpen] = useState(false);
  const [activeId, setActiveId] = useState<number | undefined>(data.playlists[0]?.id);
  const [announcement, setAnnouncement] = useState("");
  const createOpener = useRef<HTMLButtonElement>(null);
  const sharingOpener = useRef<HTMLButtonElement>(null);
  const activeIndex = Math.max(0, data.playlists.findIndex((playlist) => playlist.id === activeId));
  const active = data.playlists[activeIndex];

  useEffect(() => {
    if (!data.playlists.some((playlist) => playlist.id === activeId)) setActiveId(data.playlists[0]?.id);
  }, [activeId, data.playlists]);

  const tabKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!data.playlists.length || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? data.playlists.length - 1
      : (index + (event.key === "ArrowRight" ? 1 : -1) + data.playlists.length) % data.playlists.length;
    setActiveId(data.playlists[next].id);
    document.getElementById(`music-playlist-tab-${data.playlists[next].id}`)?.focus();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        <button ref={sharingOpener} type="button" disabled={readOnly} onClick={() => setSharingOpen(true)} className={`${buttonClass} w-full bg-dashboard-muted text-dashboard sm:w-auto`}><Settings2 className="mr-2 inline h-4 w-4" />Sharing settings</button>
        {data.playlists.length > 0 && <button ref={createOpener} type="button" onClick={() => setCreateOpen(true)} disabled={readOnly} className={`${buttonClass} w-full bg-dashboard-accent text-[var(--dash-accent-text)] sm:w-auto`}><Plus className="mr-2 inline h-4 w-4" />Create playlist</button>}
      </div>

      {data.playlists.length === 0 ? (
        <section className="rounded-2xl border border-dashboard bg-dashboard-sidebar px-5 py-12 text-center sm:px-8">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-dashboard-muted text-dashboard-accent"><ListMusic className="h-6 w-6" /></div>
          <h2 className="mt-4 text-xl font-semibold text-dashboard">Create your first playlist</h2>
          <p className="mx-auto mt-2 max-w-md text-base text-dashboard-muted">Build a playlist to collect and share the music you love.</p>
          <button ref={createOpener} type="button" onClick={() => setCreateOpen(true)} disabled={readOnly} className={`${buttonClass} mt-6 w-full bg-dashboard-accent text-[var(--dash-accent-text)] sm:w-auto`}>Create playlist</button>
        </section>
      ) : (
        <>
          <div role="tablist" aria-label="Music playlists" className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:thin]">
            {data.playlists.map((playlist, index) => (
              <button id={`music-playlist-tab-${playlist.id}`} key={playlist.id} role="tab" aria-selected={playlist.id === active?.id} tabIndex={playlist.id === active?.id ? 0 : -1} onClick={() => setActiveId(playlist.id)} onKeyDown={(event) => tabKey(event, index)} className={`${buttonClass} shrink-0 ${playlist.id === active?.id ? "bg-dashboard-accent text-[var(--dash-accent-text)]" : "bg-dashboard-muted text-dashboard"}`}>{playlist.name}</button>
            ))}
          </div>
          {active && <PlaylistPanel playlist={active} readOnly={readOnly} onChanged={data.refetch} announce={setAnnouncement} />}
        </>
      )}

      <p className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</p>
      {createOpen && <CreatePlaylistDialog onClose={() => setCreateOpen(false)} opener={createOpener} onCreated={data.refetch} />}
      {sharingOpen && <SharingDialog data={data} scope={scope} onClose={() => setSharingOpen(false)} opener={sharingOpener} />}
    </div>
  );
}
