ALTER TYPE "public"."daily_report_status" ADD VALUE 'APPROVED';--> statement-breakpoint
DROP INDEX "daily_reports_project_date_unique";--> statement-breakpoint
ALTER TABLE "daily_reports" ADD COLUMN "review_remarks" text;--> statement-breakpoint
ALTER TABLE "daily_reports" ADD COLUMN "reviewed_by" text;--> statement-breakpoint
ALTER TABLE "daily_reports" ADD COLUMN "reviewed_at" timestamp;--> statement-breakpoint
ALTER TABLE "daily_reports" ADD CONSTRAINT "daily_reports_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "daily_reports_project_date_unique" ON "daily_reports" USING btree ("project_id","report_date") WHERE "daily_reports"."deleted_at" is null;