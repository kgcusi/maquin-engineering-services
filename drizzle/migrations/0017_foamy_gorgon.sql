CREATE TYPE "public"."inspection_attempt_outcome" AS ENUM('REQUESTED', 'PASSED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."inspection_item_result" AS ENUM('PASS', 'FAIL', 'NA');--> statement-breakpoint
CREATE TABLE "inspection_checklist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"checklist_id" uuid NOT NULL,
	"label" text NOT NULL,
	"guidance" text,
	"sequence" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inspection_checklists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"category" text,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "inspection_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inspection_id" uuid NOT NULL,
	"attempt_no" integer NOT NULL,
	"outcome" "inspection_attempt_outcome" NOT NULL,
	"remarks" text,
	"recorded_by_id" text,
	"recorded_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inspection_item_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"label" text NOT NULL,
	"result" "inspection_item_result" NOT NULL,
	"remarks" text,
	"sequence" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inspections" ADD COLUMN "checklist_id" uuid;--> statement-breakpoint
ALTER TABLE "inspection_checklist_items" ADD CONSTRAINT "inspection_checklist_items_checklist_id_inspection_checklists_id_fk" FOREIGN KEY ("checklist_id") REFERENCES "public"."inspection_checklists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_checklists" ADD CONSTRAINT "inspection_checklists_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_attempts" ADD CONSTRAINT "inspection_attempts_inspection_id_inspections_id_fk" FOREIGN KEY ("inspection_id") REFERENCES "public"."inspections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_attempts" ADD CONSTRAINT "inspection_attempts_recorded_by_id_user_id_fk" FOREIGN KEY ("recorded_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_item_results" ADD CONSTRAINT "inspection_item_results_attempt_id_inspection_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."inspection_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inspection_checklist_items_checklist_idx" ON "inspection_checklist_items" USING btree ("checklist_id","sequence");--> statement-breakpoint
CREATE INDEX "inspection_checklists_name_idx" ON "inspection_checklists" USING btree ("name");--> statement-breakpoint
CREATE INDEX "inspection_attempts_inspection_idx" ON "inspection_attempts" USING btree ("inspection_id","attempt_no");--> statement-breakpoint
CREATE INDEX "inspection_item_results_attempt_idx" ON "inspection_item_results" USING btree ("attempt_id","sequence");--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_checklist_id_inspection_checklists_id_fk" FOREIGN KEY ("checklist_id") REFERENCES "public"."inspection_checklists"("id") ON DELETE set null ON UPDATE no action;