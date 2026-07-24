CREATE TABLE "recovery_device_requests" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"wallet_id" varchar(26) NOT NULL,
	"verifier" varchar(56) NOT NULL,
	"key_base64" varchar(160) NOT NULL,
	"fingerprint" varchar(64) NOT NULL,
	"status" varchar(16) DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recovery_device_requests_status_check" CHECK ("recovery_device_requests"."status" IN ('open','withdrawn','superseded'))
);
--> statement-breakpoint
ALTER TABLE "recovery_device_requests" ADD CONSTRAINT "recovery_device_requests_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recovery_device_requests_wallet_id_idx" ON "recovery_device_requests" USING btree ("wallet_id");