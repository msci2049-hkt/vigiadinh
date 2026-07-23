CREATE TABLE "guardians" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"wallet_id" varchar(26) NOT NULL,
	"user_id" varchar(64),
	"onchain_key" varchar(56),
	"status" varchar(16) DEFAULT 'invited' NOT NULL,
	"last_seen_at" timestamp with time zone,
	"last_manual_confirm_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guardians_status_check" CHECK ("guardians"."status" IN ('invited','active','slow','offline','removed'))
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"wallet_id" varchar(26) NOT NULL,
	"kind" varchar(64) NOT NULL,
	"payload" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "heartbeats" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"wallet_id" varchar(26) NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "heirs" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"wallet_id" varchar(26) NOT NULL,
	"heir_ref" varchar(64) NOT NULL,
	"bps" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "heirs_bps_check" CHECK ("heirs"."bps" BETWEEN 0 AND 10000)
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"template_key" varchar(64) NOT NULL,
	"params" jsonb,
	"channel" varchar(16) NOT NULL,
	"status" varchar(16) DEFAULT 'queued' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_status_check" CHECK ("notifications"."status" IN ('queued','sent','failed')),
	CONSTRAINT "notifications_channel_check" CHECK ("notifications"."channel" IN ('push','email','sse'))
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"owner_id" varchar(64) NOT NULL,
	"kind" varchar(16) NOT NULL,
	"platform" varchar(32),
	"push_token" varchar(512),
	"fingerprint_hash" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "devices_kind_check" CHECK ("devices"."kind" IN ('owner','guardian'))
);
--> statement-breakpoint
CREATE TABLE "presence_pings" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"guardian_id" varchar(26) NOT NULL,
	"device_id" varchar(26),
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"acked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"price" integer NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"status" varchar(16) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recovery_requests" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"wallet_id" varchar(26) NOT NULL,
	"new_owner" varchar(56) NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"risk_score" integer,
	"signals" jsonb,
	"tx_hash" varchar(64),
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	CONSTRAINT "recovery_requests_status_check" CHECK ("recovery_requests"."status" IN ('pending','ready','executed','vetoed','expired')),
	CONSTRAINT "recovery_requests_risk_check" CHECK ("recovery_requests"."risk_score" IS NULL OR ("recovery_requests"."risk_score" >= 0 AND "recovery_requests"."risk_score" <= 100))
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"stellar_address" varchar(56) NOT NULL,
	"contract_id" varchar(56),
	"threshold" integer DEFAULT 2 NOT NULL,
	"timelock_secs" integer DEFAULT 86400 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wallets_threshold_check" CHECK ("wallets"."threshold" >= 1),
	CONSTRAINT "wallets_timelock_check" CHECK ("wallets"."timelock_secs" >= 0)
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"impersonated_by" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"role" text DEFAULT 'user',
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "guardians" ADD CONSTRAINT "guardians_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heartbeats" ADD CONSTRAINT "heartbeats_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heirs" ADD CONSTRAINT "heirs_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presence_pings" ADD CONSTRAINT "presence_pings_guardian_id_guardians_id_fk" FOREIGN KEY ("guardian_id") REFERENCES "public"."guardians"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presence_pings" ADD CONSTRAINT "presence_pings_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recovery_requests" ADD CONSTRAINT "recovery_requests_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "guardians_wallet_id_idx" ON "guardians" USING btree ("wallet_id");--> statement-breakpoint
CREATE INDEX "guardians_user_id_idx" ON "guardians" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_log_wallet_id_idx" ON "audit_log" USING btree ("wallet_id");--> statement-breakpoint
CREATE INDEX "audit_log_kind_idx" ON "audit_log" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "heartbeats_wallet_id_idx" ON "heartbeats" USING btree ("wallet_id");--> statement-breakpoint
CREATE INDEX "heirs_wallet_id_idx" ON "heirs" USING btree ("wallet_id");--> statement-breakpoint
CREATE INDEX "notifications_user_id_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notifications_status_idx" ON "notifications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "devices_owner_id_idx" ON "devices" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "presence_pings_guardian_id_idx" ON "presence_pings" USING btree ("guardian_id");--> statement-breakpoint
CREATE INDEX "presence_pings_device_id_idx" ON "presence_pings" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "presence_pings_sent_at_idx" ON "presence_pings" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "products_status_idx" ON "products" USING btree ("status");--> statement-breakpoint
CREATE INDEX "recovery_requests_wallet_id_idx" ON "recovery_requests" USING btree ("wallet_id");--> statement-breakpoint
CREATE INDEX "recovery_requests_status_idx" ON "recovery_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "wallets_user_id_idx" ON "wallets" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wallets_stellar_address_uq" ON "wallets" USING btree ("stellar_address");--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");