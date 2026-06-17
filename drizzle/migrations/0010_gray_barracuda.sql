CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_key" text NOT NULL,
	"recipient_id" text NOT NULL,
	"channel" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'QUEUED' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"next_attempt_at" timestamp,
	"idempotency_key" text NOT NULL,
	"resend_message_id" text,
	"entity_type" text,
	"entity_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"sent_at" timestamp,
	"delivered_at" timestamp,
	"read_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "notification_settings" (
	"event_key" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"channels" jsonb DEFAULT '["IN_APP"]'::jsonb NOT NULL,
	"recipient_rule" text,
	"mode" text DEFAULT 'IMMEDIATE' NOT NULL,
	"digest_window" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_user_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_idempotency_idx" ON "notifications" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "notifications_recipient_idx" ON "notifications" USING btree ("recipient_id","status","created_at");--> statement-breakpoint
CREATE INDEX "notifications_drain_idx" ON "notifications" USING btree ("status","next_attempt_at");