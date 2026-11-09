CREATE TYPE "public"."climate" AS ENUM('dry', 'normal', 'wet');--> statement-breakpoint
CREATE TYPE "public"."code_purpose" AS ENUM('verify_email', 'reset_password');--> statement-breakpoint
CREATE TYPE "public"."crop" AS ENUM('maize', 'tomato', 'wheat', 'potato', 'spinach');--> statement-breakpoint
CREATE TYPE "public"."difficulty" AS ENUM('beginner', 'intermediate', 'advanced');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('learner', 'trainer');--> statement-breakpoint
CREATE TYPE "public"."soil" AS ENUM('sandy', 'loam', 'clay');--> statement-breakpoint
CREATE TABLE "attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scenario_id" uuid NOT NULL,
	"learner_id" uuid NOT NULL,
	"decisions" jsonb NOT NULL,
	"result" jsonb NOT NULL,
	"total_score" real NOT NULL,
	"irrigation_score" real NOT NULL,
	"yield_tons_per_ha" real NOT NULL,
	"water_used_mm" real NOT NULL,
	"profit" real NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"purpose" "code_purpose" NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scenarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trainer_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"learning_goals" text DEFAULT '' NOT NULL,
	"crop" "crop" NOT NULL,
	"soil" "soil" NOT NULL,
	"climate" "climate" NOT NULL,
	"difficulty" "difficulty" DEFAULT 'beginner' NOT NULL,
	"weeks" integer NOT NULL,
	"avg_temperature_c" real NOT NULL,
	"rainfall_mm" jsonb NOT NULL,
	"temperature_c" jsonb NOT NULL,
	"start_moisture_pct" real NOT NULL,
	"budget" real NOT NULL,
	"water_allowance_mm" real NOT NULL,
	"pest_weeks" jsonb NOT NULL,
	"image_url" text,
	"image_public_id" text,
	"is_published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'learner' NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"token_version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_scenario_id_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_learner_id_users_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_codes" ADD CONSTRAINT "email_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_trainer_id_users_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attempts_learner_idx" ON "attempts" USING btree ("learner_id");--> statement-breakpoint
CREATE INDEX "attempts_scenario_idx" ON "attempts" USING btree ("scenario_id");--> statement-breakpoint
CREATE INDEX "email_codes_user_purpose_idx" ON "email_codes" USING btree ("user_id","purpose");--> statement-breakpoint
CREATE INDEX "scenarios_trainer_idx" ON "scenarios" USING btree ("trainer_id");--> statement-breakpoint
CREATE INDEX "scenarios_published_idx" ON "scenarios" USING btree ("is_published");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");