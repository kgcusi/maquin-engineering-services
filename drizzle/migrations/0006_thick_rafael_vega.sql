ALTER TABLE "employees" ADD COLUMN "position" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "employment_type" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "date_hired" date;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "rate" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "rate_unit" text DEFAULT 'DAILY' NOT NULL;