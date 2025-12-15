CREATE TYPE "public"."delivery_status" AS ENUM('pending', 'success', 'failed');--> statement-breakpoint
ALTER TYPE "public"."event_type" ADD VALUE 'degraded' BEFORE 'created';--> statement-breakpoint
ALTER TYPE "public"."event_type" ADD VALUE 'timeout' BEFORE 'created';--> statement-breakpoint
ALTER TYPE "public"."event_type" ADD VALUE 'error' BEFORE 'created';--> statement-breakpoint
ALTER TYPE "public"."event_type" ADD VALUE 'paused' BEFORE 'created';--> statement-breakpoint
ALTER TYPE "public"."event_type" ADD VALUE 'resumed' BEFORE 'created';--> statement-breakpoint
ALTER TYPE "public"."event_type" ADD VALUE 'certificate_expiring' BEFORE 'created';--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"webhook_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"status" "delivery_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"next_retry_at" timestamp with time zone,
	"response_code" integer,
	"response_body" text,
	"response_time_ms" integer,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_id_webhook_configs_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "public"."webhook_configs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "webhook_deliveries_webhook_id_idx" ON "webhook_deliveries" USING btree ("webhook_id");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_status_retry_idx" ON "webhook_deliveries" USING btree ("status","next_retry_at");