import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";

export interface ObjectStorage {
  readonly environment: "local";
  put(key: string, bytes: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

export class LocalObjectStorage implements ObjectStorage {
  readonly environment = "local" as const;
  private readonly root: string;
  constructor(root = process.env.EXPLORERS_MEDIA_LOCAL_ROOT ?? join(tmpdir(), "explorers-private-media")) {
    this.root = resolve(root);
  }
  private path(key: string): string {
    if (!/^local\/[0-9a-f-]{36}\/[0-9a-f-]{36}$/.test(key)) throw new Error("Invalid media storage key");
    const path = resolve(this.root, ...key.split("/"));
    if (!path.startsWith(this.root + sep)) throw new Error("Invalid media storage path");
    return path;
  }
  async put(key: string, bytes: Buffer): Promise<void> {
    const path = this.path(key);
    await mkdir(resolve(path, ".."), { recursive: true, mode: 0o700 });
    await writeFile(path, bytes, { flag: "wx", mode: 0o600 });
  }
  async get(key: string): Promise<Buffer> { return readFile(this.path(key)); }
  async delete(key: string): Promise<void> { await rm(this.path(key), { force: true }); }
}
