// config/schema.ts
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

export const projectTasks = pgTable("project_tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull().default("pending"),
  orderIndex: integer("order_index").notNull().default(0),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const taskAutomation = pgTable("task_automation", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .unique()
    .references(() => projects.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  isActive: boolean("is_active").default(false).notNull(),
  intervalMinutes: integer("interval_minutes").default(10).notNull(),
  lastRunAt: timestamp("last_run_at"),
  nextTaskId: uuid("next_task_id").references(() => projectTasks.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const bot_deployments = pgTable("bot_deployments", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  platform: text("platform").notNull(),
  apiToken: text("api_token").notNull(),
  webhookUrl: text("webhook_url"),
  botName: text("bot_name"),
  isActive: boolean("is_active").default(true).notNull(),
  deployedAt: timestamp("deployed_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  status: text("status").default("active").notNull(),
  errorMessage: text("error_message"),
  metadata: jsonb("metadata")
    .$type<{
      deployedAt?: string
      projectTitle?: string
    } | null>()
    .default(null),
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
  lastDispense: timestamp("last_dispense"),
  subscriptionTier: text("subscription_tier").default("none").notNull(),
  creditsPerMonth: integer("credits_per_month").default(0).notNull(),
  paypalSubscriptionId: text("paypal_subscription_id"),
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
  subdomain: text("subdomain").notNull(),
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

// ====================
// DATABASE FEATURE TABLES
// ====================

export const projectDatabases = pgTable("project_databases", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .unique()
    .references(() => projects.id, { onDelete: "cascade" }),
  apiKey: text("api_key"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const projectUsers = pgTable(
  "project_users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectDatabaseId: uuid("project_database_id")
      .notNull()
      .references(() => projectDatabases.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    name: text("name"),
    role: text("role").default("user").notNull(),
    passwordHash: text("password_hash").notNull(),
    metadata: jsonb("metadata").$type<{
      avatar?: string
      bio?: string
      settings?: Record<string, any>
    } | null>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueEmailPerProject: sql`UNIQUE(${table.projectDatabaseId}, ${table.email})`,
  }),
)

export const projectTables = pgTable("project_tables", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectDatabaseId: uuid("project_database_id")
    .notNull()
    .references(() => projectDatabases.id, { onDelete: "cascade" }),
  tableName: text("table_name").notNull(),
  columns: jsonb("columns")
    .$type<Array<{ name: string; type: string; nullable?: boolean; default?: any }>>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  queryFile: jsonb("query_file").$type<{
    fileName: string
    operations: Array<{
      name: string
      type: "select" | "insert" | "update" | "delete"
      query: string
      params?: Record<string, string>
    }>
  } | null>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const projectTableRows = pgTable("project_table_rows", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectTableId: uuid("project_table_id")
    .notNull()
    .references(() => projectTables.id, { onDelete: "cascade" }),
  data: jsonb("data").notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const projectDatabaseLogs = pgTable("project_database_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectDatabaseId: uuid("project_database_id")
    .notNull()
    .references(() => projectDatabases.id, { onDelete: "cascade" }),
  level: text("level").notNull().default("info"),
  message: text("message").notNull(),
  details: jsonb("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const projectQueryFiles = pgTable("project_query_files", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectDatabaseId: uuid("project_database_id")
    .notNull()
    .references(() => projectDatabases.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  content: text("content").notNull(),
  tableId: uuid("table_id").references(() => projectTables.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const templates = pgTable("templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .unique()
    .references(() => projects.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  tags: jsonb("tags").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  mainImage: text("main_image").notNull(),
  images: jsonb("images").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  domain: text("domain").notNull(),
  creatorId: text("creator_id").notNull(),
  cardDesign: text("card_design").default("none").notNull(),
  views: integer("views").default(0).notNull(),
  clones: integer("clones").default(0).notNull(),
  likes: integer("likes").default(0).notNull(),
  isFeatured: boolean("is_featured").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const templateLikes = pgTable("template_likes", {
  id: uuid("id").defaultRandom().primaryKey(),
  templateId: uuid("template_id")
    .notNull()
    .references(() => templates.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const projectShares = pgTable("project_shares", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  ownerId: text("owner_id").notNull(),
  shareToken: text("share_token").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
})

export const projectCollaborators = pgTable("project_collaborators", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull(),
  userId: text("user_id").notNull(),
  invitedBy: text("invited_by").notNull(),
  role: text("role").default("viewer").notNull(),
  status: text("status").default("pending").notNull(),
  joinedAt: timestamp("joined_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const projectLogs = pgTable("project_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: text("project_id").notNull(),
  level: text("level").notNull().$type<"info" | "warn" | "error" | "success">(),
  message: text("message").notNull(),
  details: jsonb("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

/**
 * Stores Supabase credentials for each AI-generated project
 * These are auto-provisioned when a project needs database functionality
 */
export const projectSupabase = pgTable("project_supabase", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .unique()
    .references(() => projects.id, { onDelete: "cascade" }),
  supabaseProjectRef: text("supabase_project_ref").notNull(),
  supabaseUrl: text("supabase_url").notNull(),
  anonKey: text("anon_key").notNull(),
  serviceRoleKey: text("service_role_key").notNull(),
  dbPassword: text("db_password").notNull(),
  region: text("region").notNull().default("us-east-1"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

/**
 * Stores global Supabase connection for each user (not per project)
 * This allows the database connection to persist across all projects
 */
export const userSupabaseConnections = pgTable("user_supabase_connections", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().unique(),
  accessToken: text("access_token").notNull(),
  selectedProjectRef: text("selected_project_ref"),
  selectedProjectName: text("selected_project_name"),
  supabaseUrl: text("supabase_url"),
  anonKey: text("anon_key"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export type ProjectSupabase = typeof projectSupabase.$inferSelect
export type NewProjectSupabase = typeof projectSupabase.$inferInsert

export type UserSupabaseConnection = typeof userSupabaseConnections.$inferSelect
export type NewUserSupabaseConnection = typeof userSupabaseConnections.$inferInsert

// ====================
// TYPE INFERENCES
// ====================

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
export type BotDeployment = typeof bot_deployments.$inferSelect
export type NewBotDeployment = typeof bot_deployments.$inferInsert
export type Project = typeof projects.$inferSelect
export type NewProject = typeof projects.$inferInsert

// Database feature types
export type ProjectDatabase = typeof projectDatabases.$inferSelect
export type NewProjectDatabase = typeof projectDatabases.$inferInsert
export type ProjectUser = typeof projectUsers.$inferSelect
export type NewProjectUser = typeof projectUsers.$inferInsert
export type ProjectTable = typeof projectTables.$inferSelect
export type NewProjectTable = typeof projectTables.$inferInsert
export type ProjectTableRow = typeof projectTableRows.$inferSelect
export type NewProjectTableRow = typeof projectTableRows.$inferInsert
export type ProjectDatabaseLog = typeof projectDatabaseLogs.$inferSelect
export type NewProjectDatabaseLog = typeof projectDatabaseLogs.$inferInsert
export type ProjectQueryFile = typeof projectQueryFiles.$inferSelect
export type NewProjectQueryFile = typeof projectQueryFiles.$inferInsert

export type Template = typeof templates.$inferSelect
export type NewTemplate = typeof templates.$inferInsert
export type TemplateLike = typeof templateLikes.$inferSelect
export type NewTemplateLike = typeof templateLikes.$inferInsert
export type ProjectShare = typeof projectShares.$inferSelect
export type NewProjectShare = typeof projectShares.$inferInsert
export type ProjectCollaborator = typeof projectCollaborators.$inferSelect
export type NewProjectCollaborator = typeof projectCollaborators.$inferInsert
export type ProjectLogs = typeof projectLogs.$inferInsert