ALTER TABLE `characters` ADD `zone_bag` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `items` DROP COLUMN `zone_session`;