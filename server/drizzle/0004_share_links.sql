ALTER TABLE "attempts" ADD COLUMN "share_token" text;--> statement-breakpoint
CREATE UNIQUE INDEX "attempts_share_token_idx" ON "attempts" USING btree ("share_token");