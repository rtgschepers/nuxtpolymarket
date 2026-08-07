CREATE TABLE "hq_fights" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"seed" integer NOT NULL,
	"context" jsonb NOT NULL,
	"outcome" text NOT NULL,
	"resolved_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hq_shop_upgrades" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"upgrade_id" text NOT NULL,
	"level" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "hq_shop_upgrades_unique" UNIQUE("user_id","upgrade_id")
);
--> statement-breakpoint
CREATE TABLE "hq_state" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"last_settled_at" timestamp DEFAULT now() NOT NULL,
	"prestige" integer DEFAULT 0 NOT NULL,
	"world" integer DEFAULT 1 NOT NULL,
	"stage" integer DEFAULT 1 NOT NULL,
	"kill_count" integer DEFAULT 0 NOT NULL,
	"at_boss_gate" boolean DEFAULT false NOT NULL,
	"run_cleared" boolean DEFAULT false NOT NULL,
	"hero_node_id" text DEFAULT 'class_beginner' NOT NULL,
	"hero_level" integer DEFAULT 1 NOT NULL,
	"hero_xp" text DEFAULT '0' NOT NULL,
	"seen_node_ids" jsonb DEFAULT '["class_beginner"]'::jsonb NOT NULL,
	"void_shards" text DEFAULT '0' NOT NULL,
	"formation" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "hq_state_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "hq_fights" ADD CONSTRAINT "hq_fights_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hq_shop_upgrades" ADD CONSTRAINT "hq_shop_upgrades_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hq_state" ADD CONSTRAINT "hq_state_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hq_fights_userId_idx" ON "hq_fights" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "hq_shop_upgrades_userId_idx" ON "hq_shop_upgrades" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "hq_state_userId_idx" ON "hq_state" USING btree ("user_id");