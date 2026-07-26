ALTER TABLE "notifications" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "claimed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "last_error" varchar(256);--> statement-breakpoint
CREATE INDEX "notifications_dispatch_idx" ON "notifications" USING btree ("status","claimed_at");