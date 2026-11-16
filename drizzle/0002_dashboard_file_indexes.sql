CREATE INDEX IF NOT EXISTS files_folder_idx ON files(folder_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS api_key_files_file_idx ON api_key_files(file_id);
