CREATE TYPE "public"."run_mode" AS ENUM('weekly', 'experiment');--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "mode" "run_mode" DEFAULT 'weekly' NOT NULL;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "params" jsonb;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "baseline" jsonb;