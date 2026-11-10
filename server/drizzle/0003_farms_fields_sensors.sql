CREATE TABLE "farms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"region" text DEFAULT 'South Africa' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farm_id" uuid NOT NULL,
	"name" text NOT NULL,
	"area_ha" real DEFAULT 1 NOT NULL,
	"soil" "soil" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sensor_readings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"field_id" uuid NOT NULL,
	"scenario_id" uuid NOT NULL,
	"week" integer NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"soil_moisture_pct" real NOT NULL,
	"rainfall_mm" real NOT NULL,
	"temperature_c" real NOT NULL,
	"source" text DEFAULT 'synthetic' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scenarios" ADD COLUMN "field_id" uuid;--> statement-breakpoint
ALTER TABLE "farms" ADD CONSTRAINT "farms_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fields" ADD CONSTRAINT "fields_farm_id_farms_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sensor_readings" ADD CONSTRAINT "sensor_readings_field_id_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sensor_readings" ADD CONSTRAINT "sensor_readings_scenario_id_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "farms_owner_idx" ON "farms" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "fields_farm_idx" ON "fields" USING btree ("farm_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sensor_readings_scenario_week_idx" ON "sensor_readings" USING btree ("scenario_id","week");--> statement-breakpoint
CREATE INDEX "sensor_readings_field_idx" ON "sensor_readings" USING btree ("field_id");--> statement-breakpoint
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_field_id_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."fields"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE VIEW "public"."runs" AS (select "id", "scenario_id", "learner_id", "mode", "params", "decisions", "created_at" from "attempts");--> statement-breakpoint
CREATE VIEW "public"."scores" AS (select "id", "scenario_id", "learner_id", "total_score", "irrigation_score", "yield_tons_per_ha", "water_used_mm", "profit", "created_at" from "attempts");