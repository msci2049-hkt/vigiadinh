CREATE TABLE "wallet_policies" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"wallet_id" varchar(26) NOT NULL,
	"per_tx_limit" bigint NOT NULL,
	"daily_limit" bigint NOT NULL,
	"version" integer NOT NULL,
	"status" varchar(16) DEFAULT 'active' NOT NULL,
	"effective_at" timestamp with time zone NOT NULL,
	"created_by" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wallet_policies_status_check" CHECK ("wallet_policies"."status" IN ('active','pending','cancelled','superseded')),
	CONSTRAINT "wallet_policies_limits_check" CHECK ("wallet_policies"."per_tx_limit" > 0 AND "wallet_policies"."daily_limit" >= "wallet_policies"."per_tx_limit")
);
--> statement-breakpoint
ALTER TABLE "wallet_policies" ADD CONSTRAINT "wallet_policies_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "wallet_policies_wallet_id_idx" ON "wallet_policies" USING btree ("wallet_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_policies_wallet_version_uq" ON "wallet_policies" USING btree ("wallet_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_policies_wallet_active_uq" ON "wallet_policies" USING btree ("wallet_id") WHERE status = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_policies_wallet_pending_uq" ON "wallet_policies" USING btree ("wallet_id") WHERE status = 'pending';