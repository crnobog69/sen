import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const folders = sqliteTable('folders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ime: text('ime').notNull().unique(),
  quotaMax: integer('quota_max').notNull(),
  quotaUsed: integer('quota_used').notNull().default(0),
  rateLimitOverride: integer('rate_limit_override')
});

export const files = sqliteTable('files', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  publicId: text('public_id').notNull().unique(),
  serverskaPutanja: text('serverska_putanja').notNull(),
  folderId: integer('folder_id').notNull().references(() => folders.id, { onDelete: 'cascade' }),
  velicina: integer('velicina').notNull(),
  contentHash: text('content_hash'),
  public: integer('public', { mode: 'boolean' }).notNull().default(false),
  rateLimitOverride: integer('rate_limit_override')
});

export const apiKeys = sqliteTable('api_keys', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ime: text('ime').notNull().unique(),
  key: text('key').notNull().unique(),
  canUpload: integer('can_upload', { mode: 'boolean' }).notNull().default(false),
  canDelete: integer('can_delete', { mode: 'boolean' }).notNull().default(false),
  rateLimitOverride: integer('rate_limit_override')
});

export const apiKeyFolders = sqliteTable(
  'api_key_folders',
  {
    apiKeyId: integer('api_key_id').notNull().references(() => apiKeys.id, { onDelete: 'cascade' }),
    folderId: integer('folder_id').notNull().references(() => folders.id, { onDelete: 'cascade' })
  },
  (table) => ({
    pk: primaryKey({ columns: [table.apiKeyId, table.folderId] })
  })
);

export const apiKeyFiles = sqliteTable(
  'api_key_files',
  {
    apiKeyId: integer('api_key_id').notNull().references(() => apiKeys.id, { onDelete: 'cascade' }),
    fileId: integer('file_id').notNull().references(() => files.id, { onDelete: 'cascade' })
  },
  (table) => ({
    pk: primaryKey({ columns: [table.apiKeyId, table.fileId] })
  })
);

export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey(),
  globalRateLimit: integer('global_rate_limit').notNull(),
  globalDefaultQuota: integer('global_default_quota').notNull()
});

export type Folder = typeof folders.$inferSelect;
export type FileRow = typeof files.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
export type Settings = typeof settings.$inferSelect;
