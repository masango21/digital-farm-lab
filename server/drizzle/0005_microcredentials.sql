CREATE TYPE "public"."delivery_status" AS ENUM('pending', 'sent', 'failed');--> statement-breakpoint
CREATE TABLE "credential_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learner_id" uuid NOT NULL,
	"scenario_id" uuid NOT NULL,
	"attempt_id" uuid NOT NULL,
	"type" text DEFAULT 'microcredential.earned' NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "delivery_status" DEFAULT 'pending' NOT NULL,
	"delivery_attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "scenarios" ADD COLUMN "agrilearn_module_code" text;--> statement-breakpoint
ALTER TABLE "credential_events" ADD CONSTRAINT "credential_events_learner_id_users_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credential_events" ADD CONSTRAINT "credential_events_scenario_id_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credential_events" ADD CONSTRAINT "credential_events_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "credential_events_learner_scenario_idx" ON "credential_events" USING btree ("learner_id","scenario_id");--> statement-breakpoint
CREATE INDEX "credential_events_status_idx" ON "credential_events" USING btree ("status");