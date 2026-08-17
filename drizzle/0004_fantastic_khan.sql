ALTER TABLE "hq_state" ADD COLUMN "free_pulls_used_today" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "hq_state" ADD COLUMN "free_pull_date" text;--> statement-breakpoint
ALTER TABLE "hq_state" ADD COLUMN "free_pull_claimed_at" jsonb DEFAULT '{}'::jsonb NOT NULL;