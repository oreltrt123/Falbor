import { pgTable, text, timestamp, uuid, jsonb, boolean, integer } from "drizzle-orm/pg-core"

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  isGithubClone: boolean("is_github_clone").default(false).notNull(),
  githubUrl: text("github_url"),
  sandboxId: text("sandbox_id"),
  selectedModel: text("selected_model").default("gemini").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const messages = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // 'user' or 'assistant'
  content: text("content").notNull(),
  hasArtifact: boolean("has_artifact").default(false).notNull(),
  thinking: text("thinking"),
  searchQueries: jsonb("search_queries").$type<{ query: string; results: string }[] | null>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const files = pgTable("files", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  messageId: uuid("message_id").references(() => messages.id, { onDelete: "set null" }),
  path: text("path").notNull(), // e.g., "app/page.tsx" or "components/" for folders
  content: text("content").notNull(), // Empty string for folders
  language: text("language").notNull(), // e.g., "typescript", "javascript", "folder"
  type: text("type").notNull().default("file"), // "file" or "folder"
  isLocked: boolean("is_locked").default(false).notNull(), // Lock status to prevent editing
  parentPath: text("parent_path"), // Parent folder path for hierarchy
  additions: integer("additions").default(0).notNull(),
  deletions: integer("deletions").default(0).notNull(),
  metadata: jsonb("metadata").$type<{
    size?: number
    lastModifiedBy?: string
    isCollapsed?: boolean
    order?: number
  }>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const artifacts = pgTable("artifacts", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  messageId: uuid("message_id")
    .notNull()
    .references(() => messages.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  fileIds: jsonb("file_ids").$type<string[]>().notNull(), // Array of file IDs
  previewUrl: text("preview_url"), // E2B sandbox preview URL
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const giftEvents = pgTable("gift_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  amount: integer("amount").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const userCredits = pgTable("user_credits", {
  userId: text("user_id").primaryKey(),
  credits: integer("credits").notNull().default(10), // Default to 10 initial credits
  lastRegenTime: timestamp("last_regen_time").defaultNow().notNull(), // Timestamp for last regeneration
  lastClaimedGiftId: uuid("last_claimed_gift_id").references(() => giftEvents.id),
  lastMonthlyClaim: timestamp("last_monthly_claim"),
})

export type Project = typeof projects.$inferSelect
export type NewProject = typeof projects.$inferInsert
export type Message = typeof messages.$inferSelect
export type NewMessage = typeof messages.$inferInsert
export type File = typeof files.$inferSelect
export type NewFile = typeof files.$inferInsert
export type Artifact = typeof artifacts.$inferSelect
export type NewArtifact = typeof artifacts.$inferInsert
export type GiftEvent = typeof giftEvents.$inferSelect
export type NewGiftEvent = typeof giftEvents.$inferInsert
export type UserCredits = typeof userCredits.$inferSelect
export type NewUserCredits = typeof userCredits.$inferInsert
