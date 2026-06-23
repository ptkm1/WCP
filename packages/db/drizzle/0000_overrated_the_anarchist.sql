CREATE TABLE `activity_events` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`event_type` text NOT NULL,
	`payload_json` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `artifacts` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`repository_id` text,
	`type` text NOT NULL,
	`title` text,
	`external_id` text,
	`url` text,
	`metadata_json` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`repository_id`) REFERENCES `repositories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `daily_plan_items` (
	`id` text PRIMARY KEY NOT NULL,
	`daily_plan_id` text NOT NULL,
	`work_item_id` text NOT NULL,
	`position` integer NOT NULL,
	`is_committed` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`daily_plan_id`) REFERENCES `daily_plans`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`work_item_id`) REFERENCES `work_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `daily_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`plan_date` text NOT NULL,
	`summary` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `entity_links` (
	`id` text PRIMARY KEY NOT NULL,
	`from_entity_type` text NOT NULL,
	`from_entity_id` text NOT NULL,
	`to_entity_type` text NOT NULL,
	`to_entity_id` text NOT NULL,
	`link_type` text NOT NULL,
	`score` real,
	`source_type` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `environment_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`organization_id` text,
	`name` text NOT NULL,
	`provider_type` text,
	`provider_host` text,
	`ssh_host_alias` text,
	`ssh_key_path_ref` text,
	`git_user_name` text,
	`git_user_email` text,
	`branch_pattern` text,
	`pr_convention` text,
	`commit_convention` text,
	`notes_json` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `knowledge_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`note_type` text NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`source_type` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`organization_id` text,
	`name` text NOT NULL,
	`description` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `repositories` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`organization_id` text,
	`project_id` text,
	`name` text NOT NULL,
	`local_path` text,
	`provider_type` text,
	`provider_host` text,
	`remote_url` text,
	`default_branch` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `repository_identities` (
	`id` text PRIMARY KEY NOT NULL,
	`repository_id` text NOT NULL,
	`environment_profile_id` text,
	`git_user_name` text,
	`git_user_email` text,
	`ssh_host_alias` text,
	`ssh_key_fingerprint` text,
	`provider_username` text,
	`provider_account_label` text,
	`enforce_pre_push_check` integer DEFAULT true NOT NULL,
	`last_validated_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`repository_id`) REFERENCES `repositories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`environment_profile_id`) REFERENCES `environment_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `session_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`work_item_id` text,
	`organization_id` text,
	`project_id` text,
	`repository_id` text,
	`branch_name` text,
	`started_at` text NOT NULL,
	`ended_at` text,
	`goal` text,
	`decisions` text,
	`result` text,
	`links_json` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`work_item_id`) REFERENCES `work_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`repository_id`) REFERENCES `repositories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `work_item_dependencies` (
	`id` text PRIMARY KEY NOT NULL,
	`from_work_item_id` text NOT NULL,
	`to_work_item_id` text NOT NULL,
	`dependency_type` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`from_work_item_id`) REFERENCES `work_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_work_item_id`) REFERENCES `work_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `work_item_repositories` (
	`work_item_id` text NOT NULL,
	`repository_id` text NOT NULL,
	PRIMARY KEY(`work_item_id`, `repository_id`),
	FOREIGN KEY (`work_item_id`) REFERENCES `work_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`repository_id`) REFERENCES `repositories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `work_items` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`organization_id` text,
	`project_id` text,
	`primary_repository_id` text,
	`title` text NOT NULL,
	`description` text,
	`status` text NOT NULL,
	`priority` integer DEFAULT 3 NOT NULL,
	`urgency` integer,
	`effort` integer,
	`scheduled_for` text,
	`started_at` text,
	`completed_at` text,
	`blocked_reason` text,
	`resume_summary` text,
	`source_type` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`primary_repository_id`) REFERENCES `repositories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `repository_identities_repository_id_unique` ON `repository_identities` (`repository_id`);