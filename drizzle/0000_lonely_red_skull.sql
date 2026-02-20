CREATE TABLE `api_key_files` (
	`api_key_id` integer NOT NULL,
	`file_id` integer NOT NULL,
	PRIMARY KEY(`api_key_id`, `file_id`),
	FOREIGN KEY (`api_key_id`) REFERENCES `api_keys`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `api_key_folders` (
	`api_key_id` integer NOT NULL,
	`folder_id` integer NOT NULL,
	PRIMARY KEY(`api_key_id`, `folder_id`),
	FOREIGN KEY (`api_key_id`) REFERENCES `api_keys`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`folder_id`) REFERENCES `folders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `api_keys` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ime` text NOT NULL,
	`key` text NOT NULL,
	`can_upload` integer DEFAULT false NOT NULL,
	`can_delete` integer DEFAULT false NOT NULL,
	`rate_limit_override` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_ime_unique` ON `api_keys` (`ime`);--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_key_unique` ON `api_keys` (`key`);--> statement-breakpoint
CREATE TABLE `files` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`public_id` text NOT NULL,
	`serverska_putanja` text NOT NULL,
	`folder_id` integer NOT NULL,
	`velicina` integer NOT NULL,
	`public` integer DEFAULT false NOT NULL,
	`rate_limit_override` integer,
	FOREIGN KEY (`folder_id`) REFERENCES `folders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `files_public_id_unique` ON `files` (`public_id`);--> statement-breakpoint
CREATE TABLE `folders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ime` text NOT NULL,
	`quota_max` integer NOT NULL,
	`quota_used` integer DEFAULT 0 NOT NULL,
	`rate_limit_override` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `folders_ime_unique` ON `folders` (`ime`);--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`global_rate_limit` integer NOT NULL,
	`global_default_quota` integer NOT NULL
);
