CREATE TABLE "care_grants" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"wallet_id" varchar(26) NOT NULL,
	"grantee_ref" varchar(64) NOT NULL,
	"daily_limit" bigint NOT NULL,
	"total_limit" bigint,
	"recipient_allowlist" jsonb NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "care_grants_daily_check" CHECK ("care_grants"."daily_limit" > 0),
	CONSTRAINT "care_grants_total_check" CHECK ("care_grants"."total_limit" IS NULL OR "care_grants"."total_limit" >= "care_grants"."daily_limit")
);
--> statement-breakpoint
CREATE TABLE "inheritance_plans" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"wallet_id" varchar(26) NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"inactivity_period_secs" integer DEFAULT 2592000 NOT NULL,
	"final_timelock_secs" integer DEFAULT 604800 NOT NULL,
	"status" varchar(16) DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inheritance_plans_status_check" CHECK ("inheritance_plans"."status" IN ('draft','active','revoked')),
	CONSTRAINT "inheritance_plans_inactivity_check" CHECK ("inheritance_plans"."inactivity_period_secs" >= 86400),
	CONSTRAINT "inheritance_plans_timelock_check" CHECK ("inheritance_plans"."final_timelock_secs" >= 3600),
	CONSTRAINT "inheritance_plans_version_check" CHECK ("inheritance_plans"."version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "approval_requests" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"intent_id" varchar(26) NOT NULL,
	"intent_version" integer NOT NULL,
	"guardian_id" varchar(26) NOT NULL,
	"guardian_device_id" varchar(26),
	"challenge_hash" varchar(64) NOT NULL,
	"verified_call" boolean DEFAULT false NOT NULL,
	"decision" varchar(16) DEFAULT 'pending' NOT NULL,
	"decided_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "approval_requests_decision_check" CHECK ("approval_requests"."decision" IN ('pending','approved','rejected','expired')),
	CONSTRAINT "approval_requests_version_check" CHECK ("approval_requests"."intent_version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "transaction_intents" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"wallet_id" varchar(26) NOT NULL,
	"client_intent_id" varchar(64) NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" varchar(16) DEFAULT 'owner' NOT NULL,
	"status" varchar(24) DEFAULT 'draft' NOT NULL,
	"operations" jsonb NOT NULL,
	"recipient" varchar(56),
	"amount" bigint,
	"intent_hash" varchar(64),
	"policy_decision" varchar(20),
	"policy_version" integer,
	"policy_reasons" jsonb,
	"risk_context" jsonb,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transaction_intents_status_check" CHECK ("transaction_intents"."status" IN ('draft','validating','review','policy_gate','awaiting_guardian','approved','awaiting_signature','submitting','settled','rejected','expired','cancelled','submit_failed')),
	CONSTRAINT "transaction_intents_created_by_check" CHECK ("transaction_intents"."created_by" IN ('owner','ai')),
	CONSTRAINT "transaction_intents_decision_check" CHECK ("transaction_intents"."policy_decision" IS NULL OR "transaction_intents"."policy_decision" IN ('allow','require_guardian','delay')),
	CONSTRAINT "transaction_intents_amount_check" CHECK ("transaction_intents"."amount" IS NULL OR "transaction_intents"."amount" > 0),
	CONSTRAINT "transaction_intents_version_check" CHECK ("transaction_intents"."version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "families" (
	"id" varchar(26) PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"owner_user_id" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "actor_type" varchar(16);--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "actor_id" varchar(64);--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "device_id" varchar(26);--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "before_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "after_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "recovery_requests" ADD COLUMN "new_device_proof" jsonb;--> statement-breakpoint
ALTER TABLE "recovery_requests" ADD COLUMN "approvals" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "recovery_requests" ADD COLUMN "threshold" integer;--> statement-breakpoint
ALTER TABLE "recovery_requests" ADD COLUMN "veto_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "wallets" ADD COLUMN "family_id" varchar(26);--> statement-breakpoint
ALTER TABLE "care_grants" ADD CONSTRAINT "care_grants_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inheritance_plans" ADD CONSTRAINT "inheritance_plans_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_intent_id_transaction_intents_id_fk" FOREIGN KEY ("intent_id") REFERENCES "public"."transaction_intents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_guardian_id_guardians_id_fk" FOREIGN KEY ("guardian_id") REFERENCES "public"."guardians"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_intents" ADD CONSTRAINT "transaction_intents_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "care_grants_wallet_id_idx" ON "care_grants" USING btree ("wallet_id");--> statement-breakpoint
CREATE INDEX "care_grants_grantee_ref_idx" ON "care_grants" USING btree ("grantee_ref");--> statement-breakpoint
CREATE INDEX "inheritance_plans_wallet_id_idx" ON "inheritance_plans" USING btree ("wallet_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inheritance_plans_wallet_version_uq" ON "inheritance_plans" USING btree ("wallet_id","version");--> statement-breakpoint
CREATE INDEX "approval_requests_intent_id_idx" ON "approval_requests" USING btree ("intent_id");--> statement-breakpoint
CREATE INDEX "approval_requests_guardian_id_idx" ON "approval_requests" USING btree ("guardian_id");--> statement-breakpoint
CREATE INDEX "approval_requests_expires_at_idx" ON "approval_requests" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "approval_requests_intent_guardian_version_uq" ON "approval_requests" USING btree ("intent_id","guardian_id","intent_version");--> statement-breakpoint
CREATE INDEX "transaction_intents_wallet_id_idx" ON "transaction_intents" USING btree ("wallet_id");--> statement-breakpoint
CREATE INDEX "transaction_intents_status_idx" ON "transaction_intents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "transaction_intents_expires_at_idx" ON "transaction_intents" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "transaction_intents_wallet_client_uq" ON "transaction_intents" USING btree ("wallet_id","client_intent_id");--> statement-breakpoint
CREATE INDEX "families_owner_user_id_idx" ON "families" USING btree ("owner_user_id");--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "wallets_family_id_idx" ON "wallets" USING btree ("family_id");--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_type_check" CHECK ("audit_log"."actor_type" IS NULL OR "audit_log"."actor_type" IN ('owner','guardian','system','ai'));--> statement-breakpoint
ALTER TABLE "recovery_requests" ADD CONSTRAINT "recovery_requests_approvals_check" CHECK ("recovery_requests"."approvals" >= 0);--> statement-breakpoint
ALTER TABLE "recovery_requests" ADD CONSTRAINT "recovery_requests_threshold_check" CHECK ("recovery_requests"."threshold" IS NULL OR "recovery_requests"."threshold" >= 1);