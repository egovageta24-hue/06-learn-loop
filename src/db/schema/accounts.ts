import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { userRole, userStatus } from "./enums";

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Always stored lower-cased. */
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    role: userRole("role").notNull().default("learner"),
    status: userStatus("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("users_org_idx").on(t.orgId, t.role)],
);
