import { useState } from "react";
import type { MusicGuestControls as GuestControlsValue } from "../musicWorkspaceClient";

const definitions: Array<{ key: keyof GuestControlsValue; label: string; description: string }> = [
  { key: "allowSongRequests", label: "Allow song requests", description: "Guests with access can search and request songs." },
  { key: "allowGuestPlayOnDevice", label: "Allow playback on guest devices", description: "Guests can use playback controls on their own device." },
  { key: "allowPlaylistSharing", label: "Show shared playlists", description: "Playlists marked Shared appear on the guest page." },
  { key: "allowRecentlyPlayedVisibility", label: "Show recently played", description: "Guests can see your recently played history." },
];

export function MusicGuestControls({ value, onSave, readOnly = false }: { value: GuestControlsValue; onSave: (value: GuestControlsValue) => Promise<unknown>; readOnly?: boolean }) {
  const [current, setCurrent] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const change = async (key: keyof GuestControlsValue) => {
    if (readOnly || saving) return;
    const previous = current;
    const next = { ...current, [key]: !current[key] };
    setCurrent(next); setSaving(true); setError("");
    try { await onSave(next); }
    catch { setCurrent(previous); setError("Guest controls could not be saved. Try again."); }
    finally { setSaving(false); }
  };
  return <section aria-labelledby="music-guest-controls-heading" className="space-y-3">
    <div><h2 id="music-guest-controls-heading" className="text-lg font-semibold text-dashboard">Guest controls</h2><p className="mt-1 text-sm text-dashboard-muted">Choose what visitors can do on your shared Music page.</p></div>
    {definitions.map((definition) => <div key={definition.key} className="flex min-h-14 items-center justify-between gap-4 rounded-xl border border-dashboard bg-dashboard-bg/40 p-3">
      <div><p className="font-medium text-dashboard">{definition.label}</p><p className="text-sm text-dashboard-muted">{definition.description}</p></div>
      <button type="button" role="switch" aria-label={definition.label} aria-checked={current[definition.key]} disabled={readOnly || saving} onClick={() => void change(definition.key)} className="min-h-11 min-w-11 shrink-0 rounded-full border border-dashboard px-3">{current[definition.key] ? "On" : "Off"}</button>
    </div>)}
    {saving && <p role="status" className="text-sm text-dashboard-muted">Saving guest controls…</p>}
    {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
  </section>;
}
