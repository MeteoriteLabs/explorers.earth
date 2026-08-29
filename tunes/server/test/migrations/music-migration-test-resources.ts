interface EndablePool {
  end(): Promise<void>;
}

interface ReleasableClient {
  release(destroy?: boolean): void;
}

interface ConnectablePool<Client extends ReleasableClient> {
  connect(): Promise<Client>;
}

export function nextSyntheticMusicMigrationId(
  migrationIds: readonly string[],
  suffix: string,
): string {
  if (!/^[a-z][a-z0-9_]*$/.test(suffix)) throw new Error("synthetic migration suffix is invalid");
  const sequences = migrationIds.map((id) => {
    const match = /^(\d{4})_[a-z0-9_]+$/.exec(id);
    if (!match) throw new Error("migration inventory contains an invalid ID");
    return Number(match[1]);
  });
  if (sequences.length === 0) throw new Error("migration inventory is empty");
  const next = Math.max(...sequences) + 1;
  if (next > 9_999) throw new Error("synthetic migration sequence is exhausted");
  return `${String(next).padStart(4, "0")}_${suffix}`;
}

export class MusicMigrationTestResources {
  private readonly pools = new Set<EndablePool>();

  trackPool<Pool extends EndablePool>(pool: Pool): Pool {
    this.pools.add(pool);
    return pool;
  }

  async closePool(pool: EndablePool): Promise<void> {
    if (!this.pools.delete(pool)) return;
    await pool.end();
  }

  async closeAllPools(): Promise<void> {
    const pools = Array.from(this.pools);
    for (const pool of pools) this.pools.delete(pool);
    const results = await Promise.allSettled(pools.map(async (pool) => { await pool.end(); }));
    const failures = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
    if (failures.length === 1) throw failures[0].reason;
    if (failures.length > 1) throw new AggregateError(
      failures.map(({ reason }) => reason),
      "multiple migration test pools failed to close",
    );
  }

  async runWithCleanup<Result>(run: () => Promise<Result>): Promise<Result> {
    try {
      return await run();
    } finally {
      await this.closeAllPools();
    }
  }

  async withClient<Client extends ReleasableClient, Result>(
    pool: ConnectablePool<Client>,
    run: (client: Client) => Promise<Result>,
  ): Promise<Result> {
    const client = await pool.connect();
    let failed = true;
    try {
      const result = await run(client);
      failed = false;
      return result;
    } finally {
      client.release(failed || undefined);
    }
  }
}
