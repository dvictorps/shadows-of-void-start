CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_user_id_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `characters` (
	`id` integer PRIMARY KEY NOT NULL,
	`auth_user_id` text NOT NULL,
	`name` text NOT NULL,
	`class_id` text NOT NULL,
	`level` integer DEFAULT 1 NOT NULL,
	`xp` integer DEFAULT 0 NOT NULL,
	`hardcore` integer DEFAULT false NOT NULL,
	`dead` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`hp_current` real NOT NULL,
	`barrier_current` real DEFAULT 0 NOT NULL,
	`potions` integer DEFAULT 0 NOT NULL,
	`ethereal_incense` integer DEFAULT 0 NOT NULL,
	`rubys` integer DEFAULT 0 NOT NULL,
	`teleport_stones` integer DEFAULT 0 NOT NULL,
	`wind_crystals` integer DEFAULT 0 NOT NULL,
	`current_zone_session` text,
	`current_zone_kills` integer DEFAULT 0 NOT NULL,
	`zone_started_at` integer,
	`camp_thresholds_ms` text,
	`in_camp` integer DEFAULT false NOT NULL,
	`last_camp_index` integer,
	`current_location` text DEFAULT 'city' NOT NULL,
	`travel_destination` text,
	`travel_started_at` integer,
	`travel_arrives_at` integer,
	`unlocked_nodes` text NOT NULL,
	`completed_zones` text NOT NULL,
	`boss_kill_counts` text NOT NULL,
	`total_boss_kills` integer DEFAULT 0 NOT NULL,
	`selected_element` text,
	`last_element_switch_at` integer,
	`active_session_token` text,
	`active_session_at` integer,
	`cached_max_life` real NOT NULL,
	`cached_max_barrier` real DEFAULT 0 NOT NULL,
	`cached_magic_find` real DEFAULT 0 NOT NULL,
	`cached_movement_speed` real DEFAULT 0 NOT NULL,
	FOREIGN KEY (`auth_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `characters_auth_user_id_idx` ON `characters` (`auth_user_id`);--> statement-breakpoint
CREATE TABLE `items` (
	`id` integer PRIMARY KEY NOT NULL,
	`auth_user_id` text NOT NULL,
	`location_kind` text NOT NULL,
	`character_id` integer,
	`zone_session` text,
	`equipped_slot` text,
	`inventory_slot` integer,
	`stash_mode` text,
	`stash_slot` integer,
	`data` text NOT NULL,
	`dropped_at` integer NOT NULL,
	`dropped_from` text,
	`dropped_from_level` integer,
	FOREIGN KEY (`auth_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `items_character_kind_idx` ON `items` (`character_id`,`location_kind`);--> statement-breakpoint
CREATE INDEX `items_stash_idx` ON `items` (`auth_user_id`,`stash_mode`) WHERE location_kind = 'stash';--> statement-breakpoint
CREATE TABLE `leaderboard_snapshot` (
	`category` text NOT NULL,
	`mode` text NOT NULL,
	`entries` text NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`category`, `mode`)
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_user_id_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`role` text DEFAULT 'user' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);