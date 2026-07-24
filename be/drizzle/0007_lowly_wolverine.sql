CREATE TABLE "guardian_invites" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"wallet_id" varchar(26) NOT NULL,
	"token" varchar(64) NOT NULL,
	"label" varchar(64) NOT NULL,
	"status" varchar(16) DEFAULT 'sent' NOT NULL,
	"accepted_by_user_id" varchar(64),
	"guardian_address" varchar(56),
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"registered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guardian_invites_status_check" CHECK ("guardian_invites"."status" IN ('sent','accepted','deployed','registered','expired'))
);
--> statement-breakpoint
ALTER TABLE "guardian_invites" ADD CONSTRAINT "guardian_invites_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "guardian_invites_token_uq" ON "guardian_invites" USING btree ("token");--> statement-breakpoint
CREATE INDEX "guardian_invites_wallet_idx" ON "guardian_invites" USING btree ("wallet_id");