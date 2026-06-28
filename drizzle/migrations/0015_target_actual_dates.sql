ALTER TABLE "tasks" RENAME COLUMN "start_date" TO "target_start_date";--> statement-breakpoint
ALTER TABLE "tasks" RENAME COLUMN "due_date" TO "target_end_date";--> statement-breakpoint
ALTER TABLE "tasks" RENAME COLUMN "completed_date" TO "actual_end_date";--> statement-breakpoint
ALTER TABLE "phases" RENAME COLUMN "start_date" TO "target_start_date";--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "actual_start_date" date;--> statement-breakpoint
ALTER TABLE "phases" ADD COLUMN "actual_start_date" date;--> statement-breakpoint
ALTER TABLE "phases" ADD COLUMN "actual_end_date" date;
