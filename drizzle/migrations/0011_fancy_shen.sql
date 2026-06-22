ALTER TABLE "clients" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;