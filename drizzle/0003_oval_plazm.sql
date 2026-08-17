CREATE TABLE "hq_loadouts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"slot_index" integer NOT NULL,
	"name" text DEFAULT 'Loadout' NOT NULL,
	"party_champion_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"formation" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"equipped_skill_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"equipped_artifact_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"equipped_gear" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "hq_loadouts_unique" UNIQUE("user_id","slot_index")
);
--> statement-breakpoint
ALTER TABLE "hq_state" ADD COLUMN "equipped_skill_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "hq_state" ADD COLUMN "equipped_artifact_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "hq_state" ADD COLUMN "equipped_gear" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "hq_loadouts" ADD CONSTRAINT "hq_loadouts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hq_loadouts_userId_idx" ON "hq_loadouts" USING btree ("user_id");