CREATE TABLE "hq_collection" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"system" text NOT NULL,
	"content_id" text NOT NULL,
	"star" integer DEFAULT 0 NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"dupe_progress" integer DEFAULT 0 NOT NULL,
	"acquired_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "hq_collection_unique" UNIQUE("user_id","system","content_id")
);
--> statement-breakpoint
ALTER TABLE "hq_state" ADD COLUMN "party_champion_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "hq_state" ADD COLUMN "forge_seals" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "hq_state" ADD COLUMN "guild_seals" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "hq_state" ADD COLUMN "skill_seals" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "hq_state" ADD COLUMN "excavation_seals" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "hq_state" ADD COLUMN "gear_essence" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "hq_state" ADD COLUMN "champion_essence" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "hq_state" ADD COLUMN "skill_essence" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "hq_state" ADD COLUMN "artifact_essence" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "hq_state" ADD COLUMN "gacha_levels" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "hq_state" ADD COLUMN "gacha_progress" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "hq_state" ADD COLUMN "seal_ladder_purchased_today" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "hq_state" ADD COLUMN "seal_ladder_date" text;--> statement-breakpoint
ALTER TABLE "hq_state" ADD COLUMN "last_seal_grant_at" timestamp;--> statement-breakpoint
ALTER TABLE "hq_collection" ADD CONSTRAINT "hq_collection_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hq_collection_userId_system_idx" ON "hq_collection" USING btree ("user_id","system");