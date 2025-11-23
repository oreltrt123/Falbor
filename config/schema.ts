import { pgTable, text, timestamp, uuid, jsonb, boolean, integer, serial } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { check } from "drizzle-orm/pg-core"

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  coverImage: text("cover_image"),
  isPublic: boolean("is_public").default(false).notNull(),
  isGithubClone: boolean("is_github_clone").default(false).notNull(),
  githubUrl: text("github_url"),
  deploymentConfig: jsonb("deployment_config")
    .$type<{
      platform?: "vercel" | "netlify"
      apiKey?: string
      vercelProjectId?: string
      deploymentUrl?: string
      lastDeployedAt?: string
    } | null>()
    .default(null),
  sandboxId: text("sandbox_id"),
  selectedModel: text("selected_model").default("gemini").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  isAutomated: boolean("is_automated").default(false).notNull(),
})

export const favorites = pgTable("favorites", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const messages = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  hasArtifact: boolean("has_artifact").default(false).notNull(),
  thinking: text("thinking"),
  searchQueries: jsonb("search_queries").$type<{ query: string; results: string }[] | null>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  isAutomated: boolean("is_automated").default(false).notNull(),
})

export const files = pgTable("files", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  messageId: uuid("message_id").references(() => messages.id, { onDelete: "set null" }),
  path: text("path").notNull(),
  content: text("content").notNull(),
  language: text("language").notNull(),
  type: text("type").notNull().default("file"),
  isLocked: boolean("is_locked").default(false).notNull(),
  parentPath: text("parent_path"),
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
  fileIds: jsonb("file_ids").$type<string[]>().notNull(),
  previewUrl: text("preview_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const giftEvents = pgTable("gift_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  amount: integer("amount").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const userCredits = pgTable("user_credits", {
  userId: text("user_id").primaryKey(),
  credits: integer("credits").notNull().default(10),
  lastRegenTime: timestamp("last_regen_time").defaultNow().notNull(),
  lastClaimedGiftId: uuid("last_claimed_gift_id").references(() => giftEvents.id),
  lastMonthlyClaim: timestamp("last_monthly_claim"),
  isPremium: boolean("is_premium").default(false).notNull(),
  lastPremiumDispense: timestamp("last_premium_dispense"),
  stripeCustomerId: text("stripe_customer_id"),
})

export const userModelConfigs = pgTable("user_model_configs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().unique(),
  enabledModels: jsonb("enabled_models")
    .$type<string[]>()
    .notNull()
    .default(["gemini", "claude", "gpt", "deepseek", "gptoss", "runware"]),
  modelApiKeys: jsonb("model_api_keys")
    .$type<{
      gemini?: string
      claude?: string
      gpt?: string
      deepseek?: string
      gptoss?: string
      runware?: string
    } | null>()
    .default(null),
  customCreditsAdded: integer("custom_credits_added").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const deployments = pgTable("deployments", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  deploymentUrl: text("deployment_url").notNull(),
  customDomain: text("custom_domain"),
  isPublic: boolean("is_public").default(true).notNull(),
  showBranding: boolean("show_branding").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const figmaTokens = pgTable("figma_tokens", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  expiresAt: timestamp("expires_at").notNull(),
})

export const userAutomations = pgTable(
  "user_automations",
  {
    userId: text("user_id").primaryKey(),
    selectedModel: text("selected_model").default("gemini").notNull(),
    maxMessages: integer("max_messages").default(2).notNull(),
    isActive: boolean("is_active").default(false).notNull(),
    activatedAt: timestamp("activated_at"),
    nextRunAt: timestamp("next_run_at"),
    lastRun: timestamp("last_run"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [check("max_messages_check", sql`${table.maxMessages} >= 2`)],
)

export const serverConnections = pgTable("server_connections", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  provider: text("provider").notNull(),
  accessToken: text("access_token").notNull(),
  projectRef: text("project_ref").notNull(),
  projectName: text("project_name"),
  databaseUrl: text("database_url"),
  apiUrl: text("api_url"),
  isActive: boolean("is_active").default(true).notNull(),
  schema: jsonb("schema").$type<{
    tables?: Array<{
      name: string
      columns: Array<{ name: string; type: string; nullable: boolean }>
      rowCount?: number
    }>
  } | null>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const userCustomKnowledge = pgTable("user_custom_knowledge", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().unique(),
  promptName: text("prompt_name").notNull(),
  promptContent: text("prompt_content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export type Project = typeof projects.$inferSelect
export type NewProject = typeof projects.$inferInsert
export type Favorite = typeof favorites.$inferSelect
export type NewFavorite = typeof favorites.$inferInsert
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
export type Deployment = typeof deployments.$inferSelect
export type NewDeployment = typeof deployments.$inferInsert
export type ServerConnection = typeof serverConnections.$inferSelect
export type NewServerConnection = typeof serverConnections.$inferInsert
export type UserAutomation = typeof userAutomations.$inferSelect
export type NewUserAutomation = typeof userAutomations.$inferInsert
export type UserCustomKnowledge = typeof userCustomKnowledge.$inferSelect
export type NewUserCustomKnowledge = typeof userCustomKnowledge.$inferInsert
export type UserModelConfig = typeof userModelConfigs.$inferSelect
export type NewUserModelConfig = typeof userModelConfigs.$inferInsert