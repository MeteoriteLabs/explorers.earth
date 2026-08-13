import { z } from "zod";
import { EXPECTED_MUSIC_MIGRATION_ID } from "../../shared/music-migration-contract";

const integerString = (name: string, minimum: number, maximum: number) =>
  z.string().regex(/^\d+$/, `${name} must be an integer`).transform(Number).refine((value) => value >= minimum && value <= maximum, `${name} must be between ${minimum} and ${maximum}`);

const booleanString = z.enum(["true", "false"]).transform((value) => value === "true");

export const musicEnvironmentSchema = z.object({
  MUSIC_MODE: z.enum(["fixture", "live"]),
  MUSIC_FIXTURE_VERSION: z.literal("1"),
  STRAPI_FIXTURE_URL: z.literal("http://127.0.0.1:51337", {
    errorMap: () => ({ message: "STRAPI_FIXTURE_URL must exactly target http://127.0.0.1:51337" }),
  }),
  DATABASE_URL_TEST: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  COOKIE_SECRET: z.string().min(32),
  MUSIC_SIGNING_KEY_CURRENT_ID: z.string().min(1),
  MUSIC_SIGNING_KEY_CURRENT_SECRET: z.string().min(32),
  MUSIC_SIGNING_KEY_PREVIOUS_ID: z.string().min(1),
  MUSIC_SIGNING_KEY_PREVIOUS_SECRET: z.string().min(32),
  MUSIC_CONNECT_TIMEOUT_MS: integerString("MUSIC_CONNECT_TIMEOUT_MS", 100, 60_000),
  MUSIC_READ_TIMEOUT_MS: integerString("MUSIC_READ_TIMEOUT_MS", 100, 120_000),
  MUSIC_CIRCUIT_FAILURE_THRESHOLD: integerString("MUSIC_CIRCUIT_FAILURE_THRESHOLD", 1, 100),
  MUSIC_RATE_LIMIT_PER_MINUTE: integerString("MUSIC_RATE_LIMIT_PER_MINUTE", 1, 10_000),
  MUSIC_PROVISIONING_KILL_SWITCH: booleanString,
  MUSIC_PROVISIONING_COHORT: z.string().min(1),
  MUSIC_EXPECTED_MIGRATION_ID: z.literal(EXPECTED_MUSIC_MIGRATION_ID),
  MUSIC_RECONCILIATION_ENABLED: booleanString,
  MUSIC_RECONCILIATION_MAX_ROWS: integerString("MUSIC_RECONCILIATION_MAX_ROWS", 0, 100_000),
}).passthrough().superRefine((environment, context) => {
  let database: URL;
  try {
    database = new URL(environment.DATABASE_URL_TEST);
  } catch {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["DATABASE_URL_TEST"], message: "DATABASE_URL_TEST must be a PostgreSQL URL" });
    return;
  }
  if (database.protocol !== "postgresql:" || database.hostname !== "127.0.0.1" || database.port !== "55432" || database.pathname !== "/music_fixture" || database.search || database.hash) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["DATABASE_URL_TEST"], message: "DATABASE_URL_TEST must exactly target 127.0.0.1:55432/music_fixture" });
  }
  if (!environment.MUSIC_PROVISIONING_KILL_SWITCH) context.addIssue({ code: z.ZodIssueCode.custom, path: ["MUSIC_PROVISIONING_KILL_SWITCH"], message: "C0 requires the provisioning kill switch" });
  if (environment.MUSIC_PROVISIONING_COHORT !== "disabled") context.addIssue({ code: z.ZodIssueCode.custom, path: ["MUSIC_PROVISIONING_COHORT"], message: "C0 requires the disabled cohort" });
  if (environment.MUSIC_RECONCILIATION_ENABLED || environment.MUSIC_RECONCILIATION_MAX_ROWS !== 0) context.addIssue({ code: z.ZodIssueCode.custom, path: ["MUSIC_RECONCILIATION_ENABLED"], message: "C0 requires reconciliation disabled with zero rows" });
});

export function parseMusicEnvironment(input: Record<string, unknown>) {
  return musicEnvironmentSchema.parse(input);
}
