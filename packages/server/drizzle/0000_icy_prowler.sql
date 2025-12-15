CREATE TYPE "public"."event_type" AS ENUM('up', 'down', 'created', 'updated', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."target_status" AS ENUM('up', 'down', 'degraded', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."target_type" AS ENUM('http', 'tcp', 'icmp', 'dns', 'docker', 'postgres', 'redis');--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_id" uuid NOT NULL,
	"type" "event_type" NOT NULL,
	"message" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metrics" (
	"time" timestamp with time zone DEFAULT now() NOT NULL,
	"target_id" uuid NOT NULL,
	"status" "target_status" NOT NULL,
	"response_time_ms" integer,
	"status_code" integer,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "target_current_status" (
	"target_id" uuid PRIMARY KEY NOT NULL,
	"current_status" "target_status" DEFAULT 'unknown' NOT NULL,
	"last_checked_at" timestamp with time zone,
	"last_response_time_ms" integer,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid,
	"name" text NOT NULL,
	"type" "target_type" NOT NULL,
	"config" jsonb NOT NULL,
	"interval_ms" integer DEFAULT 60000 NOT NULL,
	"timeout_ms" integer DEFAULT 5000 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"failure_threshold" integer DEFAULT 2 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"events" text[] NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_target_id_targets_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."targets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metrics" ADD CONSTRAINT "metrics_target_id_targets_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."targets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "target_current_status" ADD CONSTRAINT "target_current_status_target_id_targets_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."targets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_target_id_idx" ON "events" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "events_created_at_idx" ON "events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "events_type_idx" ON "events" USING btree ("type");--> statement-breakpoint
CREATE INDEX "metrics_target_id_time_idx" ON "metrics" USING btree ("target_id","time");--> statement-breakpoint
CREATE INDEX "metrics_time_idx" ON "metrics" USING btree ("time");--> statement-breakpoint
CREATE INDEX "target_current_status_idx" ON "target_current_status" USING btree ("current_status");--> statement-breakpoint
CREATE INDEX "targets_owner_id_idx" ON "targets" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "targets_enabled_idx" ON "targets" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "webhook_configs_owner_id_idx" ON "webhook_configs" USING btree ("owner_id");