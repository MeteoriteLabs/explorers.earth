import { pgTable, text, uuid, bigint, boolean, timestamp, jsonb, integer, smallint, primaryKey, uniqueIndex, index, customType } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { auth_user } from "./authSchema";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });

export const creatorAccounts = pgTable("creator_accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  handle: text("handle"),
  handleKey: text("handle_key").generatedAlwaysAs(sql`lower(handle)`),
  displayName: text("display_name"),
  accountType: text("account_type"),
  onboardingStatus: text("onboarding_status").notNull().default("incomplete"),
  status: text("status").notNull().default("active"),
  publicProfile: boolean("public_profile").notNull().default(true),
  autoPinning: boolean("auto_pinning").notNull().default(true),
  locale: text("locale").notNull().default("en"),
  mobileNumber: text("mobile_number"),
  mobileNumberVisible: boolean("mobile_number_visible").notNull().default(false),
  bioPlain: text("bio_plain"),
  bioRich: jsonb("bio_rich"),
  primaryAddress: jsonb("primary_address"),
  additionalAddresses: jsonb("additional_addresses").notNull().default([]),
  publicAddress: jsonb("public_address"),
  profilePlaceDetails: jsonb("profile_place_details"),
  revision: bigint("revision", { mode: "number" }).notNull().default(1),
  suspendedAt: timestamp("suspended_at", { withTimezone: true }),
  deletionRequestedAt: timestamp("deletion_requested_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const accountMemberships = pgTable("account_memberships", {
  accountId: uuid("account_id").notNull().references(() => creatorAccounts.id),
  userId: text("user_id").notNull().references(() => auth_user.id),
  role: text("role").notNull().default("owner"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [primaryKey({ columns: [table.accountId, table.userId] })]);

export const initialAccountBindings = pgTable("initial_account_bindings", {
  userId: text("user_id").primaryKey().references(() => auth_user.id),
  accountId: uuid("account_id").notNull().unique().references(() => creatorAccounts.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userSecurityState = pgTable("user_security_state", {
  userId: text("user_id").primaryKey().references(() => auth_user.id),
  sessionVersion: bigint("session_version", { mode: "number" }).notNull().default(1),
  blockedAt: timestamp("blocked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const accountCategorySettings = pgTable("account_category_settings", {
  accountId: uuid("account_id").notNull().references(() => creatorAccounts.id),
  category: text("category").notNull(),
  isPublic: boolean("is_public").notNull().default(false),
  displayOrder: integer("display_order").notNull(),
  pinnedOrder: integer("pinned_order"),
}, (table) => [primaryKey({ columns: [table.accountId, table.category] })]);

export const accountPresentation = pgTable("account_presentation", {
  accountId: uuid("account_id").primaryKey().references(() => creatorAccounts.id),
  schemaVersion: smallint("schema_version").notNull().default(1),
  themeSettings: jsonb("theme_settings").notNull().default({}),
  socialLinks: jsonb("social_links").notNull().default([]),
  businessDetails: jsonb("business_details").notNull().default({}),
});

export const accountRecoveryProofs = pgTable("account_recovery_proofs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().references(() => auth_user.id),
  accountId: uuid("account_id").notNull().references(() => creatorAccounts.id),
  tokenHash: bytea("token_hash").notNull(),
  purpose: text("purpose").notNull().default("account-recovery"),
  authenticatedAt: timestamp("authenticated_at", { withTimezone: true }).notNull(),
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
}, (table) => [
  uniqueIndex("account_recovery_token_hash_uq").on(table.tokenHash),
  index("account_recovery_expiry_idx").on(table.expiresAt, table.id),
  index("account_recovery_account_user_idx").on(table.accountId, table.userId),
]);
