CREATE TABLE "indexer_checkpoint" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"cursor" varchar(128),
	"ledger_seq" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "indexer_events" (
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"ledger" integer NOT NULL,
	"contract_id" varchar(56) NOT NULL,
	"kind" varchar(64) NOT NULL,
	"payload" jsonb,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "indexer_events_contract_id_idx" ON "indexer_events" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "indexer_events_ledger_idx" ON "indexer_events" USING btree ("ledger");